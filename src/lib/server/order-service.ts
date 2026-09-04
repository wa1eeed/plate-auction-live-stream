/**
 * إغلاق الصفقات — المسار الوحيد لاكتمالها.
 *
 * الاكتمال ليس تغيير حالة، بل أربعة آثار مالية تقع معًا: خصم عربون المشتري من
 * قيمة الصفقة، وفكّ عرابين بقيّة المزايدين، واقتطاع عمولة المنصّة وضريبتها.
 * كانت هذه الآثار على مسار الإدارة وحده، فبقي مسار البائع يغيّر الحالة ويترك
 * العرابين محجوزة إلى الأبد. توحيدهما هنا يجعل نسيان أحدها مستحيلًا.
 */
import type { Order } from '@/lib/domain/types'
import { getStore } from '@/lib/store'
import type { AuctionStore } from '@/lib/store/types'
import type { AccountOrder } from '@/lib/domain/types'
import { ServiceError, listAccountOrders, releaseLosingDeposits } from './market-service'
import { settleOrderDeposit } from './wallet-service'
import {
  chargeOrderCommission,
  type ExternalBuyerCollection,
} from './commission-service'
import { notify } from './notification-service'
import { sweepEscrow } from './escrow-service'

/** الآثار المالية لاكتمال صفقة — يستدعيها مسار البائع ومسار الإدارة معًا. */
export async function applyOrderCompletion(
  store: AuctionStore,
  order: Order,
  adminId: string | null,
  /** عمولة مشترٍ حُصّلت خارج المحفظة — تُقيَّد إيرادًا بلا خصم ثانٍ */
  external: ExternalBuyerCollection | null = null,
): Promise<void> {
  await settleOrderDeposit(order.id, adminId)
  /*
   * اكتمال الصفقة هو اللحظة التي يُضمن فيها البيع فعلًا، فعندها — لا قبلها —
   * تعود عرابين بقيّة المزايدين. قبل ذلك تبقى محجوزة تحسّبًا لتخلّف الفائز
   * وإعادة الإرساء على من يليه.
   */
  await releaseLosingDeposits(store, order.listingId, order.buyerId, 'اكتملت الصفقة وأُغلق المزاد')
  await chargeOrderCommission(order, adminId, external)
}

/** البائع يعلّم صفقته مكتملة أو ملغاة. */
export async function updateOrderStatus(input: {
  orderId: string
  userId: string
  status: 'completed' | 'cancelled'
}): Promise<Order> {
  const store = getStore()
  const order = await store.getOrder(input.orderId)
  if (!order) throw new ServiceError('الطلب غير موجود', 404, 'ORDER_NOT_FOUND')
  if (order.sellerId !== input.userId) {
    throw new ServiceError('البائع وحده يستطيع تحديث حالة الطلب', 403, 'FORBIDDEN')
  }
  if (order.status !== 'awaiting_settlement') {
    throw new ServiceError('حالة الطلب محدّثة مسبقًا', 409, 'ORDER_CLOSED')
  }

  /*
   * لا إتمام قبل وصول المال.
   *
   * كان البائع يعلّم صفقة **لم يدفع فيها المشتري ريالًا** مكتملةً، فيجري
   * `applyOrderCompletion` فيُخصم عربون المشتري ويُقيَّد إيراد على بيع لم
   * يُسدَّد. أي أنّ البائع يقبض العربون ويُغلق الصفقة بلا ثمن.
   *
   * والدليل على السداد دفعةٌ مختومة على هذه الصفقة — لا كلمة البائع.
   */
  /*
   * لم يعد للبائع «تمّت الصفقة».
   *
   * الإتمام صار **إفراجًا** يقع بعد نقل الملكية وتأكيد المشتري أو انقضاء
   * مهلته. وإبقاء الزرّ بيد البائع يعني أن يُغلق صفقةً على مالٍ لم يستحقّه بعد.
   */
  if (input.status === 'completed') {
    throw new ServiceError(
      'الإتمام يقع بتحويل المبلغ بعد نقل الملكية — ارفع إثبات النقل لتتحقّق منه الإدارة',
      409,
      'USE_TRANSFER_FLOW',
    )
  }
  return store.updateOrderStatus(order.id, input.status, Date.now())
}

/**
 * تذكيرات مهلة السداد.
 *
 * المصادرة بعد إنذار لا مفاجأة: من يفوز بلوحة ثم ينشغل يومين لا يستحقّ أن
 * يكتشف تخلّفه من إشعار مصادرة. تذكيران قبل الانقضاء ثم إعلان بانقضائها،
 * وكلٌّ يُرسَل مرّة واحدة — `remindersSent` على الصفقة يمنع التكرار.
 *
 * لا مؤقّت في الخلفية: المسح يجري على مسارات القراءة كما يجري إنهاء المزادات،
 * فلا يعتمد النظام على عملية حيّة لا تنجو من إعادة تشغيل.
 */
const REMINDERS = [
  { marker: '24h', beforeMs: 24 * 3_600_000, title: 'باقٍ يوم على مهلة سدادك' },
  { marker: '6h', beforeMs: 6 * 3_600_000, title: 'باقٍ ٦ ساعات على مهلة سدادك' },
] as const

export async function sendPaymentReminders(store: AuctionStore): Promise<number> {
  const orders = (await store.listOrders({})).filter(
    (order) => order.status === 'awaiting_settlement',
  )
  const now = Date.now()
  let sent = 0

  for (const order of orders) {
    if (!order.paymentDueAt) continue
    const due = Date.parse(order.paymentDueAt)
    const listing = await store.getListing(order.listingId)
    const plate = listing ? `${listing.arabicLetters} ${listing.plateNumbers}` : 'لوحتك'

    for (const reminder of REMINDERS) {
      const opensAt = due - reminder.beforeMs
      if (now < opensAt || now >= due) continue
      if (order.remindersSent.includes(reminder.marker)) continue

      await store.markOrderReminded(order.id, reminder.marker)
      await notify(store, {
        userId: order.buyerId,
        type: 'payment_due_soon',
        title: reminder.title,
        body: `أتمّ سداد «${plate}» قبل انقضاء المهلة، وإلا تعرّض عربونك للمصادرة.`,
        href: '/account/purchases',
        listingId: order.listingId,
      })
      sent += 1
    }

    if (now >= due && !order.remindersSent.includes('overdue')) {
      await store.markOrderReminded(order.id, 'overdue')
      await notify(store, {
        userId: order.buyerId,
        type: 'payment_overdue',
        title: 'انتهت مهلة سدادك',
        body: `لم يكتمل سداد «${plate}» — يحقّ للإدارة مصادرة عربونك وإعادة الإرساء على غيرك.`,
        href: '/account/purchases',
        listingId: order.listingId,
      })
      await notify(store, {
        userId: order.sellerId,
        type: 'payment_overdue',
        title: 'مشتري لوحتك تجاوز مهلة السداد',
        body: `«${plate}» — تتابع الإدارة الصفقة.`,
        href: '/account/sales',
        listingId: order.listingId,
      })
      sent += 1
    }
  }
  return sent
}


/**
 * مشتريات المستخدم ومبيعاته.
 *
 * تمرّ من هنا لا من `market-service` مباشرة كي يجري مسح التذكيرات قبل القراءة:
 * الصفحة التي يفتحها المشتري هي أنسب لحظة لتذكيره بمهلة توشك أن تنقضي.
 */
export async function getPurchases(userId: string): Promise<AccountOrder[]> {
  await sendPaymentReminders(getStore())
  await sweepEscrow(getStore())
  return listAccountOrders(userId, 'buyer')
}

export async function getSales(userId: string): Promise<AccountOrder[]> {
  await sendPaymentReminders(getStore())
  await sweepEscrow(getStore())
  return listAccountOrders(userId, 'seller')
}
