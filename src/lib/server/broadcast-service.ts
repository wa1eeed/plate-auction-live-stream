import { parseReference } from '@/lib/domain/reference'
import { ServiceError } from '@/lib/server/market-service'
import { notify } from '@/lib/server/notification-service'
import { getStore } from '@/lib/store'
import type { BroadcastAudience } from '@/lib/domain/types'

/**
 * البثّ الإداريّ — رسالةٌ تكتبها الإدارة وتصل شريحةً من المستخدمين.
 *
 * وهو الإشعار الوحيد الذي **لا يولّده حدث**: بقيّةُ الإشعارات أثرُ فعلٍ وقع —
 * مزايدةٌ تُجووِزت، أو مهلةٌ توشك — وهذا يقع بإرادة مرسله. ولذلك يُحاط
 * بحرّاسٍ لا تحتاجها الأخرى:
 *
 * 1. **يُقيَّد في سجلّ التدقيق** بمرسله ونصّه وعدد من بلغهم.
 * 2. **مهلةٌ بين بثٍّ وبثّ** تمنع التكرار بضغطةٍ مزدوجة.
 * 3. **الشريحة من حالةٍ قائمة** لا من فلترٍ حرّ يكتبه المرسل.
 * 4. **الوجهة مسارٌ داخليّ** لا رابط خارجيّ.
 *
 * وما يُرسَل لا يُسترَدّ: يصل جهازًا مقفلًا ويبقى في سجلّ صاحبه.
 */

/** أقلّ ما بين بثّين — يمنع التكرار العرضيّ لا الاستعمال المشروع. */
const COOLDOWN_MS = 60_000

let lastBroadcastAt = 0

export type BroadcastInput = {
  title: string
  body: string
  /** مسارٌ داخليّ يبدأ بـ`/` — أو لا وجهة */
  href: string | null
  audience: BroadcastAudience
  /** رقم عضويّة المستهدَف — لشريحة `user` وحدها */
  reference?: string | null
  adminId: string
}

/** يحسب الشريحة — ويُستعمل للعرض قبل الإرسال وللإرسال نفسه. */
async function resolveAudience(
  audience: BroadcastAudience,
  reference?: string | null,
): Promise<string[]> {
  const store = getStore()

  if (audience === 'user') {
    const handle = reference?.trim()
    if (!handle) throw new ServiceError('حدّد المستخدم برقم عضويّته', 400, 'NO_TARGET')
    /*
     * الرقم المرجعيّ أوّلًا والمعرّف الداخليّ بعده — كما في صفحات الإدارة.
     * الأدمن يُملي `U26-00003` لا `usr_…`، والثاني يبقى مقبولًا لروابط محفوظة.
     */
    const parsed = parseReference(handle)
    const user =
      parsed?.kind === 'user'
        ? (await store.listUsers()).find((row) => row.reference === parsed.canonical) ?? null
        : await store.findUser(handle)
    if (!user) throw new ServiceError('لا مستخدم بهذا الرقم', 404, 'USER_NOT_FOUND')
    return [user.id]
  }

  if (audience === 'all') {
    return (await store.listUsers()).map((user) => user.id)
  }

  /*
   * «قائم» يعني `active` لا `sold` ولا `cancelled`.
   *
   * فمن زايد على مزادٍ انتهى قبل شهر ليس «مزايدًا نشطًا»، وبثٌّ يبلغه يُقرأ
   * ضجيجًا من منصّةٍ لم يعد فيها شيءٌ ينتظره.
   */
  const listings = (await store.listListings({})).filter((row) => row.status === 'active')
  const listingIds = new Set(listings.map((row) => row.id))

  if (audience === 'active_sellers') {
    return Array.from(new Set(listings.map((row) => row.sellerId)))
  }

  const bids = await store.listAllBids()
  return Array.from(
    new Set(bids.filter((bid) => listingIds.has(bid.listingId)).map((bid) => bid.bidderId)),
  )
}

/** عدد من ستبلغهم الرسالة — يُعرض قبل الإرسال فلا يُرسَل في العمياء. */
export async function countAudience(
  audience: BroadcastAudience,
  reference?: string | null,
): Promise<number> {
  return (await resolveAudience(audience, reference)).length
}

export async function sendBroadcast(input: BroadcastInput): Promise<{ delivered: number }> {
  /*
   * الوجهة مسارٌ داخليّ وحده.
   *
   * رابطٌ خارجيّ في إشعارٍ من المنصّة يُقرأ توصيةً منها، ويُفتح في غلافٍ بلا
   * شريط عنوان — وهو باب تصيّدٍ تفتحه المنصّة على مستخدميها بيدها.
   */
  const href = input.href?.trim() || null
  if (href && !href.startsWith('/')) {
    throw new ServiceError('الوجهة يجب أن تكون مسارًا داخليًّا يبدأ بـ/', 400, 'BAD_HREF')
  }

  /*
   * المهلة **بعد** فحص المدخلات لا قبله.
   *
   * وإلّا قيل لمن أخطأ في الوجهة «انتظر ٦٠ ثانية» — فيظنّ رسالته بُثّت وهي
   * لم تُقبل أصلًا، ويعيدها بعد المهلة فتصل مرّتين في حسبانه.
   */
  const now = Date.now()
  if (now - lastBroadcastAt < COOLDOWN_MS) {
    const wait = Math.ceil((COOLDOWN_MS - (now - lastBroadcastAt)) / 1000)
    throw new ServiceError(`انتظر ${wait} ثانية قبل بثٍّ آخر`, 429, 'BROADCAST_COOLDOWN')
  }

  const store = getStore()
  const userIds = await resolveAudience(input.audience, input.reference)
  if (userIds.length === 0) {
    throw new ServiceError('لا أحد في هذه الشريحة', 400, 'EMPTY_AUDIENCE')
  }

  lastBroadcastAt = now

  for (const userId of userIds) {
    await notify(store, {
      userId,
      type: 'broadcast',
      title: input.title,
      body: input.body,
      href,
      listingId: null,
    })
  }

  await store.appendAudit({
    actorId: input.adminId,
    action: 'broadcast.send',
    entityType: 'broadcast',
    entityId: String(now),
    beforeData: null,
    // النصّ يُقيَّد كاملًا: ما وصل ألفَ جهازٍ يجب أن يُعرف بعدُ ما كان
    afterData: {
      audience: input.audience,
      reference: input.reference ?? null,
      delivered: userIds.length,
      title: input.title,
      body: input.body,
      href,
    },
  })

  return { delivered: userIds.length }
}
