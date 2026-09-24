import { getStore } from '@/lib/store'
import { ServiceError } from './market-service'
import {
  availableBalance,
  isClosedListing,
  OPEN_ORDER_STATUSES,
  type User,
} from '@/lib/domain/types'

/**
 * **حذفُ الحساب تعطيلٌ لا محو.**
 *
 * آبل تشترط أن يستطيع المستخدم حذف حسابه من داخل التطبيق، ورفضُ ذلك سببُ
 * ردٍّ معروف. ومحوُ الصفّ محوٌ لتاريخٍ ماليّ تقابله صفقاتٌ وقيودُ محفظةٍ
 * وفواتير — فتصير طلباتٌ بلا مشترٍ، وقيودٌ بلا صاحب، وفاتورةٌ ضريبية بلا
 * طرف. فيُعطَّل الحساب: لا يدخل صاحبُه ولا يُتعامل به، ويبقى ما يشير إليه
 * سليمًا، وتُعيده الإدارة متى طلب.
 */

/** عائقٌ يمنع التعطيل — ونصُّه يقول لصاحبه ما يفعله لا أنّه ممنوع. */
export type DeletionBlocker = { kind: string; detail: string }

/**
 * ما يمنع تعطيل الحساب — **والمنعُ حمايةٌ للطرف الآخر لا للمنصّة**.
 *
 * فمن باع لوحةً وقبض ثمنها ولم ينقل ملكيّتها بعدُ، تعطيلُه يترك المشتري
 * بمالٍ محجوزٍ وبائعٍ لا يُبلَغ. ومن له رصيدٌ في محفظته، تعطيلُه يحبس مالَه
 * عنده. فتُعدّ العوائقُ كلُّها ويُقال له بأيّها يبدأ.
 */
export async function accountDeletionBlockers(userId: string): Promise<DeletionBlocker[]> {
  const store = getStore()
  const blockers: DeletionBlocker[] = []

  /* ١) صفقاتٌ لم يستقرّ مالُها — شراءً أو بيعًا */
  const [asBuyer, asSeller] = await Promise.all([
    store.listOrders({ buyerId: userId }),
    store.listOrders({ sellerId: userId }),
  ])
  const open = [...asBuyer, ...asSeller].filter((order) =>
    OPEN_ORDER_STATUSES.includes(order.status),
  )
  if (open.length > 0) {
    blockers.push({
      kind: 'open_orders',
      detail: `لديك ${open.length} صفقة لم تكتمل بعد — أكملها أو راجع خدمة العملاء`,
    })
  }

  /* ٢) إعلاناتٌ ما زالت قائمة — مسودّةً أو مجدولةً أو معروضة */
  const listings = await store.listListings({ sellerId: userId, includeDrafts: true })
  const live = listings.filter((listing) => !isClosedListing(listing.status))
  if (live.length > 0) {
    blockers.push({
      kind: 'live_listings',
      detail: `لديك ${live.length} إعلان قائم — أغلقها أو ألغِها أوّلًا`,
    })
  }

  /*
   * ٣) مالٌ في المحفظة — **رصيدًا كان أو محجوزًا**.
   *
   * والمحجوز أشدّ: هو عربونٌ أو ثمنٌ في عهدة المنصّة، وتعطيلُ صاحبه يقطع
   * الطريق إلى ردّه.
   */
  const wallet = await store.getWallet(userId)
  if (wallet.held > 0) {
    blockers.push({
      kind: 'held_funds',
      detail: 'لديك مبلغ محجوز في صفقة جارية — ينتهي الحجز بانتهائها',
    })
  } else if (availableBalance(wallet) > 0) {
    blockers.push({
      kind: 'wallet_balance',
      detail: 'لديك رصيد في المحفظة — اسحبه قبل حذف الحساب',
    })
  }

  /* ٤) مزايداتٌ قائمة على مزادٍ لم يُغلق — فقد يرسو عليه وهو معطَّل */
  const bids = await store.listBidsByBidder(userId)
  if (bids.length > 0) {
    const ids = [...new Set(bids.map((bid) => bid.listingId))]
    const bidded = await Promise.all(ids.map((id) => store.getListing(id)))
    const running = bidded.filter((listing) => listing && !isClosedListing(listing.status))
    if (running.length > 0) {
      blockers.push({
        kind: 'live_bids',
        detail: `لك مزايدات في ${running.length} مزاد لم ينتهِ — انتظر انتهاءها`,
      })
    }
  }

  return blockers
}

/**
 * يعطّل الحساب بطلب صاحبه — **أو يردّ بالعوائق**.
 *
 * ويُعاد فحصُ العوائق هنا لا في الواجهة وحدها: بين عرضها وضغطه على التأكيد
 * قد تُفتح صفقة، فالفحصُ عند الفعل هو الحارس.
 */
export async function requestAccountDeletion(userId: string): Promise<User> {
  const store = getStore()
  const user = await store.findUser(userId)
  if (!user) throw new ServiceError('المستخدم غير موجود', 404, 'USER_NOT_FOUND')
  if (user.disabledAt) return user

  const blockers = await accountDeletionBlockers(userId)
  if (blockers.length > 0) {
    throw new ServiceError(blockers[0].detail, 409, 'ACCOUNT_HAS_OPEN_ACTIVITY')
  }

  return store.updateUser(userId, {
    disabledAt: new Date().toISOString(),
    disabledReason: 'self_requested',
  })
}

/** تُعيد الإدارةُ تفعيلَ حسابٍ معطَّل — ويُقيَّد في سجلّ التدقيق. */
export async function reactivateUser(userId: string, adminId: string): Promise<User> {
  const store = getStore()
  const before = await store.findUser(userId)
  if (!before) throw new ServiceError('المستخدم غير موجود', 404, 'USER_NOT_FOUND')
  if (!before.disabledAt) return before

  const after = await store.updateUser(userId, { disabledAt: null, disabledReason: null })
  await store.appendAudit({
    actorId: adminId,
    action: 'user.reactivate',
    entityType: 'user',
    entityId: userId,
    beforeData: { disabledAt: before.disabledAt, disabledReason: before.disabledReason },
    afterData: { disabledAt: null },
  })
  return after
}

/**
 * رسالةُ الحساب المعطَّل — **واحدةٌ في كلّ موضع**.
 *
 * تُقرأ عند الدخول وعند كلّ طلبٍ بجلسةٍ قديمة. ولو كُتبت في كلّ موضعٍ
 * لاختلفت، فقرأ الواحدُ نصّين لحالةٍ واحدة.
 */
export const DISABLED_ACCOUNT_MESSAGE =
  'حسابك معطَّل وقيد الحذف — للاستفسار تواصل مع خدمة العملاء'
