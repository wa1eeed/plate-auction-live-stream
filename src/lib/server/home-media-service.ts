import { getStore } from '@/lib/store'
import { UPLOAD_LIMITS as SHARED_LIMITS } from '@/lib/domain/upload-limits'
import { ServiceError } from './market-service'
import {
  bannerRatioError,
  contentTypeOf,
  isStagingKey,
  stagingKey,
  getMedia,
  isAllowedMime,
  isMp4,
  platformKey,
  probeImage,
  userFileKey,
  type AllowedMime,
} from './media'
import type { Banner, BannerView, Story, StoryView } from '@/lib/domain/types'
import type { NewBanner, NewStory } from '@/lib/store/types'

/**
 * حدودُ الرفع — تُقاس على البايتات المقروءة لا على ما أعلنه المتصفّح.
 *
 * و`content-length` يُصدَّق ابتداءً لردٍّ سريع، ثمّ **تُقاس البايتات بعد
 * قراءتها**: الترويسة يكتبها العميل، ومن أراد إغراق القرص كتب فيها ما شاء.
 */
export const UPLOAD_LIMITS = SHARED_LIMITS satisfies Record<AllowedMime, number>

export type UploadPurpose = 'banner' | 'story' | 'poster' | 'user-file'

/**
 * يرفع ملفًّا **بعد أن يقرأ بايتاته ويحكم عليها**.
 *
 * والرفع يمرّ بالخادم ولا يُوقَّع رابطٌ للمتصفّح ليرفع مباشرةً إلى R2. وهو
 * قرارٌ مقصود: التوقيعُ المسبق أخفُّ على الخادم، لكنّه يعني أنّ **الخادم لا
 * يرى ما رُفع أبدًا** — فلا نسبةَ بنرٍ تُفرض، ولا نوعَ ملفٍّ يُتحقَّق منه،
 * ويصير التحقّق كلُّه في المتصفّح، أي لا تحقّق. والملفّات هنا ميغاباياتٌ
 * معدودة من الإدارة وحدها، فالثمن مقبول والمكسب حقيقيّ.
 */
export async function uploadMedia(input: {
  purpose: UploadPurpose
  declaredMime: string
  bytes: Uint8Array
  /** لملفّات المستخدمين وحدها — تُحدِّد البادئة الخاصّة */
  ownerId?: string
}): Promise<{ key: string; width: number | null; height: number | null }> {
  const { purpose, declaredMime, bytes } = input

  if (!isAllowedMime(declaredMime)) {
    throw new ServiceError('صيغة غير مدعومة', 415, 'MEDIA_TYPE')
  }
  if (bytes.byteLength === 0) {
    throw new ServiceError('الملفّ فارغ', 422, 'MEDIA_EMPTY')
  }
  const limit = UPLOAD_LIMITS[declaredMime]
  if (bytes.byteLength > limit) {
    throw new ServiceError(
      `الملفّ ${Math.round(bytes.byteLength / 1024)} كيلوبايت، والحدّ ${Math.round(limit / 1024)}`,
      413,
      'MEDIA_TOO_LARGE',
    )
  }

  const { width, height } = inspectHead(declaredMime, bytes, purpose)

  const key =
    purpose === 'user-file'
      ? userFileKey(
          input.ownerId ?? (() => { throw new ServiceError('لا صاحب للملفّ', 400, 'MEDIA_OWNER') })(),
          declaredMime,
        )
      : platformKey(declaredMime)

  await getMedia().put(key, bytes, declaredMime)
  return { key, width, height }
}

/**
 * الحكمُ على البايتات — **دالّةٌ واحدة يقرؤها المساران**.
 *
 * والرفعُ صار طريقين: عبر الخادم، ومباشرةً إلى R2 ثمّ تأكيدٌ يقرأ الرأس.
 * ولو كُتبت الحراسةُ في كلٍّ منهما لانحرفتا — فتُشدَّد نسبةُ البنر في طريقٍ
 * وتُنسى في الآخر، ويصير البابُ المفتوح هو الذي لا أحدَ ينظر إليه.
 *
 * **وتكفيها الرؤوس**: نوعُ الصورة وأبعادُها في أوّلها، و`ftyp` في أوّل اثني
 * عشر بايتًا من MP4، و`%PDF-` في خمسة. فما يُمرَّر هنا إمّا الملفُّ كلُّه
 * (الطريق القديم) أو أوّلُ ربع ميغابايت منه (الطريق الجديد) — والحكمُ واحد.
 */
function inspectHead(
  declaredMime: AllowedMime,
  head: Uint8Array,
  purpose: UploadPurpose,
): { width: number | null; height: number | null } {
  if (declaredMime === 'video/mp4') {
    if (!isMp4(head)) throw new ServiceError('الملفّ ليس فدّيو MP4', 422, 'MEDIA_MISMATCH')
    return { width: null, height: null }
  }
  if (declaredMime === 'application/pdf') {
    const magic = String.fromCharCode(...head.slice(0, 5))
    if (magic !== '%PDF-') throw new ServiceError('الملفّ ليس PDF', 422, 'MEDIA_MISMATCH')
    return { width: null, height: null }
  }

  const probe = probeImage(head)
  if (!probe) throw new ServiceError('الملفّ ليس صورةً صالحة', 422, 'MEDIA_MISMATCH')
  if (probe.mime !== declaredMime) {
    throw new ServiceError(`الملفّ ${probe.mime} لا ${declaredMime}`, 422, 'MEDIA_MISMATCH')
  }
  if (purpose === 'banner') {
    const ratio = bannerRatioError(probe)
    if (ratio) throw new ServiceError(ratio, 422, 'MEDIA_RATIO')
  }
  return { width: probe.width, height: probe.height }
}

/* ------------------------------------------------- الرفع المباشر إلى المخزن */

/**
 * مدّةُ رابط الرفع — تكفي لرفعٍ بطيء ولا تكفي لأن يُتداول.
 *
 * وربعُ ساعةٍ ليس اعتباطًا: مئةُ ميغابايت على وصلةٍ متواضعة تقارب العشر
 * دقائق، وما زاد على ذلك رابطُ كتابةٍ يعيش بلا حاجة.
 */
const UPLOAD_URL_TTL_SECONDS = 15 * 60

/**
 * ما يُقرأ من رأس الملفّ للحكم عليه.
 *
 * وربعُ ميغابايت سخاءٌ مقصود: أبعادُ JPEG تقع بعد EXIF، وEXIF قد تحمل صورةً
 * مصغَّرة تبلغ عشرات الكيلوبايتات. فيُؤخذ هامشٌ يفوق أيَّ رأسٍ معقول، ويبقى
 * ما يُنقل جزءًا من ألفٍ من ملفٍّ كبير.
 */
const HEAD_BYTES = 256 * 1024

/**
 * يوقّع رابطًا يرفع إليه **المتصفّح مباشرةً**، أو `null` لمحرّكٍ لا يدعمه.
 *
 * والحجمُ المعلن يُفحص هنا رفقًا لا حراسةً: يمنع رفعًا محكومًا بالفشل قبل أن
 * يبدأ. والحراسةُ الحقيقية في `confirmUpload` — على الحجم الذي يراه المخزن.
 */
export async function signUpload(input: {
  purpose: UploadPurpose
  declaredMime: string
  declaredSize: number
}): Promise<{ key: string; url: string } | null> {
  const { declaredMime, declaredSize } = input
  if (!isAllowedMime(declaredMime)) {
    throw new ServiceError('صيغة غير مدعومة', 415, 'MEDIA_TYPE')
  }
  if (!Number.isFinite(declaredSize) || declaredSize <= 0) {
    throw new ServiceError('الملفّ فارغ', 422, 'MEDIA_EMPTY')
  }
  const limit = UPLOAD_LIMITS[declaredMime]
  if (declaredSize > limit) {
    throw new ServiceError(
      `الملفّ ${Math.round(declaredSize / 1024)} كيلوبايت، والحدّ ${Math.round(limit / 1024)}`,
      413,
      'MEDIA_TOO_LARGE',
    )
  }

  const key = stagingKey(declaredMime)
  const url = await getMedia().signedUpload({
    key,
    contentType: declaredMime,
    expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
  })
  return url ? { key, url } : null
}

/**
 * يُصدّق ما رفعه المتصفّح — **ولا يُنقل إلى موضعه إلّا بعد أن يُقرأ**.
 *
 * وهنا تقع كلُّ الحراسة التي كانت تقع وقت المرور بالخادم: الحجمُ الحقيقيّ
 * كما يراه المخزن لا كما ادّعاه العميل، والنوعُ بالبايتات لا بالترويسة،
 * ونسبةُ البنر. وما سقط في شيءٍ منها **يُمحى من الحجر** ولا يُترك.
 *
 * والنقلُ آخرُ ما يقع: ما دام في `staging/` فهو في حاويةٍ لا نطاقَ لها، ولا
 * يبلغه أحد. فإن صحّ انتقل إلى موضعه، وإن لم يصحّ لم يكن له موضعٌ قطّ.
 */
export async function confirmUpload(input: {
  key: string
  purpose: UploadPurpose
  ownerId?: string
}): Promise<{ key: string; width: number | null; height: number | null }> {
  const { key, purpose } = input
  const media = getMedia()

  if (!isStagingKey(key)) throw new ServiceError('مفتاح غير صالح', 400, 'MEDIA_KEY')

  /*
   * النوعُ يُشتقّ من المفتاح الذي **نحن** أنشأناه، ثمّ يُقابَل بما سجّله
   * المخزن. والثاني موثوقٌ لأنّ التوقيع شمله: R2 يردّ ما كُتب بنوعٍ سواه.
   */
  const declaredMime = contentTypeOf(key)
  if (!isAllowedMime(declaredMime)) throw new ServiceError('مفتاح غير صالح', 400, 'MEDIA_KEY')

  try {
    const info = await media.head(key)
    if (!info) throw new ServiceError('لم يصل الملفّ إلى المخزن', 404, 'MEDIA_MISSING')

    if (info.size === 0) throw new ServiceError('الملفّ فارغ', 422, 'MEDIA_EMPTY')
    const limit = UPLOAD_LIMITS[declaredMime]
    if (info.size > limit) {
      throw new ServiceError(
        `الملفّ ${Math.round(info.size / 1024)} كيلوبايت، والحدّ ${Math.round(limit / 1024)}`,
        413,
        'MEDIA_TOO_LARGE',
      )
    }

    const head = await media.readRange(key, HEAD_BYTES)
    if (!head || head.byteLength === 0) {
      throw new ServiceError('تعذّرت قراءة الملفّ', 422, 'MEDIA_UNREADABLE')
    }
    const { width, height } = inspectHead(declaredMime, head, purpose)

    const target =
      purpose === 'user-file'
        ? userFileKey(
            input.ownerId ?? (() => { throw new ServiceError('لا صاحب للملفّ', 400, 'MEDIA_OWNER') })(),
            declaredMime,
          )
        : platformKey(declaredMime)

    await media.move(key, target)
    return { key: target, width, height }
  } catch (error) {
    /*
     * ما لم يُصدَّق يُمحى — **ولا يُترك في الحجر ينتظر دورةَ الحياة**.
     *
     * وقاعدةُ الحياة شبكةُ أمانٍ لما انقطع اتّصالُه، لا بديلٌ عن التنظيف.
     * وفشلُ المحو لا يُخفي سببَ الردّ: الأوّل عارضٌ يُكنس بعد يوم، والثاني
     * هو ما ينتظره من رفع.
     */
    await media.remove(key).catch(() => undefined)
    throw error
  }
}

/* ----------------------------------------------------------------- القراءة */

/**
 * ما تُرسله الرئيسية — **روابطُ لا مفاتيح**، ومرشَّحًا بالوقت في الخادم.
 *
 * و`nowMs` يُمرَّر ولا يُقرأ هنا: الصفحة تُرسم بوقت الطلب، والفحص يحتاج أن
 * يضع اللحظة بيده ليقيس بنرًا انتهى.
 */
export async function liveBanners(nowMs: number): Promise<BannerView[]> {
  const media = getMedia()
  const rows = await getStore().listBanners({ liveAt: nowMs })
  return rows.map((row) => ({
    id: row.id,
    alt: row.alt,
    linkUrl: row.linkUrl,
    width: row.width,
    height: row.height,
    imageUrl: media.publicUrl(row.imageKey),
  }))
}

export async function liveStories(nowMs: number): Promise<StoryView[]> {
  const media = getMedia()
  const rows = await getStore().listStories({ liveAt: nowMs })
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    alt: row.alt,
    linkUrl: row.linkUrl,
    mediaKind: row.mediaKind,
    durationSeconds: row.durationSeconds,
    mediaUrl: media.publicUrl(row.mediaKey),
    posterUrl: row.posterKey ? media.publicUrl(row.posterKey) : null,
  }))
}

/* --------------------------------------------------------------- الإدارة */

type Audited = { adminId: string }

async function audit(input: {
  adminId: string
  action: string
  entityType: 'banner' | 'story'
  entityId: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
}) {
  await getStore().appendAudit({
    actorId: input.adminId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    beforeData: input.before,
    afterData: input.after,
  })
}

export const listBannersForAdmin = () => getStore().listBanners()
export const listStoriesForAdmin = () => getStore().listStories()

export async function createBanner(input: NewBanner & Audited): Promise<Banner> {
  const { adminId, ...fields } = input
  const row = await getStore().createBanner(fields)
  await audit({
    adminId,
    action: 'banner.create',
    entityType: 'banner',
    entityId: row.id,
    before: null,
    after: { title: row.title, published: row.published, endsAt: row.endsAt },
  })
  return row
}

export async function updateBanner(
  id: string,
  patch: Partial<NewBanner>,
  adminId: string,
): Promise<Banner> {
  const store = getStore()
  const before = await store.getBanner(id)
  if (!before) throw new ServiceError('البنر غير موجود', 404, 'BANNER_NOT_FOUND')

  const row = await store.updateBanner(id, patch)
  /*
   * الصورة القديمة تُحذف **بعد** نجاح الكتابة.
   *
   * وبترتيبٍ معكوس يبقى صفٌّ يشير إلى ملفٍّ محذوف إن سقطت الكتابة — وبنرٌ
   * بصورةٍ مفقودة أسوأ من ملفٍّ زائدٍ في الحاوية.
   */
  if (patch.imageKey && patch.imageKey !== before.imageKey) {
    await getMedia().remove(before.imageKey).catch(() => undefined)
  }
  await audit({
    adminId,
    action: 'banner.update',
    entityType: 'banner',
    entityId: id,
    before: { title: before.title, published: before.published, endsAt: before.endsAt },
    after: { title: row.title, published: row.published, endsAt: row.endsAt },
  })
  return row
}

export async function deleteBanner(id: string, adminId: string): Promise<void> {
  const store = getStore()
  const before = await store.getBanner(id)
  if (!before) throw new ServiceError('البنر غير موجود', 404, 'BANNER_NOT_FOUND')

  await store.deleteBanner(id)
  await getMedia().remove(before.imageKey).catch(() => undefined)
  await audit({
    adminId,
    action: 'banner.delete',
    entityType: 'banner',
    entityId: id,
    before: { title: before.title },
    after: null,
  })
}

export async function createStory(input: NewStory & Audited): Promise<Story> {
  const { adminId, ...fields } = input
  const row = await getStore().createStory(fields)
  await audit({
    adminId,
    action: 'story.create',
    entityType: 'story',
    entityId: row.id,
    before: null,
    after: { title: row.title, kind: row.mediaKind, endsAt: row.endsAt },
  })
  return row
}

export async function updateStory(
  id: string,
  patch: Partial<NewStory>,
  adminId: string,
): Promise<Story> {
  const store = getStore()
  const before = await store.getStory(id)
  if (!before) throw new ServiceError('الستوري غير موجود', 404, 'STORY_NOT_FOUND')

  const row = await store.updateStory(id, patch)
  const media = getMedia()
  if (patch.mediaKey && patch.mediaKey !== before.mediaKey) {
    await media.remove(before.mediaKey).catch(() => undefined)
  }
  if (patch.posterKey !== undefined && before.posterKey && patch.posterKey !== before.posterKey) {
    await media.remove(before.posterKey).catch(() => undefined)
  }
  await audit({
    adminId,
    action: 'story.update',
    entityType: 'story',
    entityId: id,
    before: { title: before.title, published: before.published, endsAt: before.endsAt },
    after: { title: row.title, published: row.published, endsAt: row.endsAt },
  })
  return row
}

export async function deleteStory(id: string, adminId: string): Promise<void> {
  const store = getStore()
  const before = await store.getStory(id)
  if (!before) throw new ServiceError('الستوري غير موجود', 404, 'STORY_NOT_FOUND')

  await store.deleteStory(id)
  const media = getMedia()
  await media.remove(before.mediaKey).catch(() => undefined)
  if (before.posterKey) await media.remove(before.posterKey).catch(() => undefined)
  await audit({
    adminId,
    action: 'story.delete',
    entityType: 'story',
    entityId: id,
    before: { title: before.title },
    after: null,
  })
}
