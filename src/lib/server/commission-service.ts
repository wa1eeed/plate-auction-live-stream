/**
 * عمولة المنصّة وضريبتها.
 *
 * المنصّة لا تمرّ بها قيمة اللوحة — السداد بين البائع والمشتري خارجها — لكنها
 * تستحقّ أجر وساطتها. ولذلك تُقتطع العمولة من **المحفظة** لا من ثمن اللوحة،
 * وتُقيَّد في حساب الإيرادات بقيد مقابل لكل ريال يخرج.
 *
 * والاقتطاع لا يُسقط الصفقة: مشترٍ أتمّ سداده خارج المنصّة لا تُعلَّق صفقته
 * لأن محفظته لا تكفي عمولتها. يُقيَّد المبلغ **مستحقًّا** ويظهر للإدارة
 * للتحصيل، فلا يضيع الإيراد ولا تتعطّل الصفقة.
 */
import { computeCommission, type CommissionBreakdown, type Order } from '@/lib/domain/types'
import { availableBalance } from '@/lib/domain/types'
import { formatAmount, type Halalas } from '@/lib/domain/money'
import type { AuctionStore } from '@/lib/store/types'
import { getStore } from '@/lib/store'
import { notify } from './notification-service'
import { issueCommissionInvoice } from './invoice-service'

export type OrderCommission = {
  seller: CommissionBreakdown
  buyer: CommissionBreakdown
  total: Halalas
}

/** ما تستحقّه المنصّة على صفقة — بلا اقتطاع، للعرض قبل الالتزام. */
export async function quoteCommission(amount: Halalas): Promise<OrderCommission> {
  const settings = await getStore().getCommissionSettings()
  return computeCommission(settings, amount)
}

/**
 * عمولة مشترٍ **حُصّلت خارج المحفظة** — ضمن دفعة ببطاقة أو حوالة.
 *
 * المبالغ مجمّدة على سجلّ الدفعة لا مُعاد حسابها، فيُقيَّد الإيراد بما دُفع
 * فعلًا وإن تغيّرت الإعدادات بين البدء والتأكيد.
 */
export type ExternalBuyerCollection = {
  paymentId: string
  buyer: CommissionBreakdown
}

/**
 * يقتطع عمولة **المشتري** عند وصول ماله.
 *
 * يُستدعى مرّة واحدة: وجود قيد إيراد على الصفقة يمنع التكرار، فلا تُقتطع
 * عمولة مرّتين لو أُعيد تعليم الصفقة مكتملة.
 *
 * و`external` يعني أنها **وصلت المنصّة أصلًا** ضمن دفعته الخارجية: تُقيَّد
 * إيرادًا ولا تُخصم من محفظته ثانيةً.
 *
 * وعمولة **البائع** ليست هنا: تُخصم من عائده لحظة الإفراج
 * (`releaseOrderEscrow`) لا من محفظته — فهو لا يملك رصيدًا ليدفع عمولة بيعٍ
 * لم يقبض ثمنه بعد.
 */
export async function chargeOrderCommission(
  order: Order,
  adminId: string | null,
  external: ExternalBuyerCollection | null = null,
): Promise<OrderCommission> {
  const store = getStore()
  const settings = await store.getCommissionSettings()
  const computed = computeCommission(settings, order.amount)
  // المجمَّد يسبق المحسوب: هو ما دفعه المشتري فعلًا
  const commission: OrderCommission = external
    ? { ...computed, buyer: external.buyer, total: computed.seller.total + external.buyer.total }
    : computed
  if (commission.total <= 0) return commission

  const existing = await store.listPlatformEntries({ orderId: order.id })
  if (existing.some((entry) => entry.type.startsWith('commission_'))) return commission

  await chargeSide(store, {
    order,
    adminId,
    userId: order.buyerId,
    side: 'buyer',
    breakdown: commission.buyer,
    // حُصّلت خارج المحفظة: تُقيَّد إيرادًا بلا خصم ثانٍ
    collectedExternally: external,
  })

  const listing = await store.getListing(order.listingId)
  await issueCommissionInvoice(store, {
    order,
    kind: 'buyer_commission',
    customerId: order.buyerId,
    breakdown: commission.buyer,
    vatRate: settings.vatEnabled ? settings.vatPercent : 0,
    plateLabel: listing ? `${listing.arabicLetters} ${listing.plateNumbers}` : 'اللوحة',
  })

  return commission
}

async function chargeSide(
  store: AuctionStore,
  input: {
    order: Order
    adminId: string | null
    userId: string
    side: 'seller' | 'buyer'
    breakdown: CommissionBreakdown
    collectedExternally?: ExternalBuyerCollection | null
  },
): Promise<void> {
  const { breakdown, collectedExternally } = input
  if (breakdown.total <= 0) return

  const wallet = await store.getWallet(input.userId)
  // المتاح لا الكلي: المحجوز عربونًا ليس مالًا حرًّا.
  // والمُحصَّل خارجًا وصل المنصّة فعلًا، فهو «مدفوع» مهما كان الرصيد.
  const affordable = collectedExternally ? true : availableBalance(wallet) >= breakdown.total

  const label = input.side === 'seller' ? 'البائع' : 'المشتري'
  const parts: { type: 'commission' | 'vat'; amount: Halalas; note: string }[] = [
    { type: 'commission', amount: breakdown.base, note: `عمولة المنصّة على صفقتك` },
  ]
  if (breakdown.vat > 0) {
    parts.push({ type: 'vat', amount: breakdown.vat, note: 'ضريبة القيمة المضافة على العمولة' })
  }

  const settledAt = new Date().toISOString()
  for (const part of parts) {
    let ledgerEntryId: string | null = null
    if (affordable && !collectedExternally) {
      const posted = await store.postLedgerEntry({
        userId: input.userId,
        type: part.type,
        amount: part.amount,
        listingId: input.order.listingId,
        depositId: null,
        orderId: input.order.id,
        note: part.note,
        actorAdminId: input.adminId,
      })
      ledgerEntryId = posted.entry.id
    }

    await store.appendPlatformEntry({
      paymentId: collectedExternally?.paymentId ?? null,
      type:
        part.type === 'vat'
          ? input.side === 'seller'
            ? 'vat_seller'
            : 'vat_buyer'
          : input.side === 'seller'
            ? 'commission_seller'
            : 'commission_buyer',
      amount: part.amount,
      userId: input.userId,
      orderId: input.order.id,
      listingId: input.order.listingId,
      depositId: null,
      settled: affordable,
      ledgerEntryId,
      note: collectedExternally
        ? `${part.note} — حُصّلت خارج المحفظة`
        : affordable
          ? part.note
          : `${part.note} — مستحقّة على ${label}`,
      settledAt: affordable ? settledAt : null,
    })
  }

  await notify(store, {
    userId: input.userId,
    type: affordable ? 'commission_charged' : 'commission_due',
    title: affordable ? 'اقتُطعت عمولة المنصّة' : 'عمولة مستحقّة عليك',
    body: affordable
      ? `${formatAmount(breakdown.total)} ريال على صفقتك المكتملة.`
      : `${formatAmount(breakdown.total)} ريال عمولة على صفقتك — اشحن رصيدك لتسويتها.`,
    href: '/account/wallet',
    listingId: input.order.listingId,
  })
}

/** تحصيل عمولة مستحقّة بعد أن صار في المحفظة ما يكفيها. */
export async function settlePlatformEntry(input: {
  entryId: string
  adminId: string
}): Promise<void> {
  const store = getStore()
  const entries = await store.listPlatformEntries({ settled: false })
  const entry = entries.find((row) => row.id === input.entryId)
  if (!entry || !entry.userId || entry.reversedAt) return

  const posted = await store.postLedgerEntry({
    userId: entry.userId,
    type: entry.type.startsWith('vat_') ? 'vat' : 'commission',
    amount: entry.amount,
    listingId: entry.listingId,
    depositId: null,
    orderId: entry.orderId,
    note: 'تحصيل عمولة مستحقّة',
    actorAdminId: input.adminId,
  })
  await store.updatePlatformEntry(entry.id, {
    settled: true,
    ledgerEntryId: posted.entry.id,
    settledAt: new Date().toISOString(),
  })
  await store.appendAudit({
    actorId: input.adminId,
    action: 'platform.settle',
    entityType: 'platform_entry',
    entityId: entry.id,
    beforeData: { settled: false },
    afterData: { settled: true, amount: entry.amount },
  })
}
