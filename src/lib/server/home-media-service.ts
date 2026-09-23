import { getStore } from '@/lib/store'
import { ServiceError } from './market-service'
import {
  bannerRatioError,
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
export const UPLOAD_LIMITS = {
  'image/jpeg': 4 * 1024 * 1024,
  'image/png': 4 * 1024 * 1024,
  'image/webp': 4 * 1024 * 1024,
  'video/mp4': 24 * 1024 * 1024,
  'application/pdf': 8 * 1024 * 1024,
} as const satisfies Record<AllowedMime, number>

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

  /*
   * النوعُ المعلن يُطابَق بالبايتات — فما سُمّي صورةً وليس صورةً يُردّ.
   *
   * وهي الحراسة التي تمنع رفع HTML باسم `.png` ثمّ تقديمه من نطاقٍ يثق
   * به المتصفّح. و`nosniff` تحمي من جانبٍ آخر، والاثنتان معًا لا واحدة.
   */
  let width: number | null = null
  let height: number | null = null

  if (declaredMime === 'video/mp4') {
    if (!isMp4(bytes)) throw new ServiceError('الملفّ ليس فدّيو MP4', 422, 'MEDIA_MISMATCH')
  } else if (declaredMime === 'application/pdf') {
    const head = String.fromCharCode(...bytes.slice(0, 5))
    if (head !== '%PDF-') throw new ServiceError('الملفّ ليس PDF', 422, 'MEDIA_MISMATCH')
  } else {
    const probe = probeImage(bytes)
    if (!probe) throw new ServiceError('الملفّ ليس صورةً صالحة', 422, 'MEDIA_MISMATCH')
    if (probe.mime !== declaredMime) {
      throw new ServiceError(`الملفّ ${probe.mime} لا ${declaredMime}`, 422, 'MEDIA_MISMATCH')
    }
    if (purpose === 'banner') {
      const ratio = bannerRatioError(probe)
      if (ratio) throw new ServiceError(ratio, 422, 'MEDIA_RATIO')
    }
    width = probe.width
    height = probe.height
  }

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
