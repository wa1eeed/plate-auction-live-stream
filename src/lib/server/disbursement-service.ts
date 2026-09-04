/**
 * أوامر الصرف — ما بين قرار الإدارة وخروج المال من البنك.
 *
 * القرار يُقيَّد في المحفظة فورًا: من استحقّ مالًا يراه في رصيده في لحظته، ولا
 * ينتظر أن يفتح محاسبٌ لوحته. لكنّ **خروج المال من حساب المنصّة** فعلٌ آخر له
 * مستفيد وآيبان ومرجع حوالة ومن أذن به ومن نفّذه — وهذا ما يحمله أمر الصرف.
 *
 * وتنفيذه يخصم من المحفظة قيدَ سحبٍ مقابلًا، فيُغلق الدفتر: ما دخل بقيد يخرج
 * بقيد، ولا يبقى في محفظةٍ رصيدٌ صُرف نظيره فعلًا.
 */

import { formatAmount, type Halalas } from '@/lib/domain/money'
import { availableBalance, type Disbursement, type Order } from '@/lib/domain/types'
import type { AuctionStore } from '@/lib/store/types'
import { getStore } from '@/lib/store'
import { notify } from './notification-service'

export type RaiseDisbursementInput = {
  order: Order
  kind: Disbursement['kind']
  beneficiaryId: string
  /** صافي ما يُصرف */
  amount: Halalas
  commissionAmount?: Halalas
  vatAmount?: Halalas
  adminId: string | null
  note?: string | null
}

/**
 * يُصدر أمر صرف عن قرار وقع.
 *
 * لا يُصدَر مرّتان لصفقة ونوع: إعادة تشغيل الإجراء لا تُنتج التزامين على مال
 * واحد. ويُرجع `null` إن كان المبلغ صفرًا — لا ورقة صرف بلا مصروف.
 */
export async function raiseDisbursement(
  store: AuctionStore,
  input: RaiseDisbursementInput,
): Promise<Disbursement | null> {
  if (input.amount <= 0) return null

  const existing = await store.listDisbursements({ orderId: input.order.id })
  if (existing.some((row) => row.kind === input.kind && row.status !== 'cancelled')) return null

  const beneficiary = await store.findUser(input.beneficiaryId)
  if (!beneficiary) return null

  const listing = await store.getListing(input.order.listingId)
  const plateLabel = listing
    ? `${listing.arabicLetters} ${listing.plateNumbers}`
    : 'اللوحة'

  const payout = beneficiary.payout
  const created = await store.createDisbursement({
    kind: input.kind,
    orderId: input.order.id,
    orderReference: input.order.reference,
    listingId: input.order.listingId,
    plateLabel,
    beneficiaryId: beneficiary.id,
    beneficiaryName: beneficiary.displayName,
    beneficiaryReference: beneficiary.reference,
    grossAmount: input.order.amount,
    commissionAmount: input.commissionAmount ?? 0,
    vatAmount: input.vatAmount ?? 0,
    amount: input.amount,
    // لقطة لا مرجع: تحويلٌ إلى آيبان تغيّر بعد إصدار الأمر تحويلٌ إلى غير من صدر له
    bankName: payout.bankName || null,
    bankIban: payout.iban || null,
    bankAccountName: payout.accountName || null,
    note: input.note ?? null,
    createdByAdminId: input.adminId,
  })

  await store.appendAudit({
    actorId: input.adminId,
    action: 'disbursement.raise',
    entityType: 'disbursement',
    entityId: created.id,
    beforeData: null,
    afterData: { kind: created.kind, amount: created.amount, orderId: created.orderId },
  })

  return created
}

export type PayDisbursementInput = {
  id: string
  /** مرجع الحوالة كما ورد من البنك */
  paymentReference: string
  adminId: string
  note?: string | null
}

/**
 * يُقفل أمر الصرف بعد تنفيذ الحوالة.
 *
 * والخصم من المحفظة هو نصف القيد الثاني: المستفيد قبض ماله في حسابه البنكي،
 * فبقاؤه في محفظته أيضًا يعني رصيدًا يستطيع إنفاقه مرّتين. ويُخصم **المتاح
 * فقط**: ما زاد عن الرصيد لا يُقيَّد سالبًا، بل يُترك ويُسجَّل في ملاحظة —
 * وحالةٌ كهذه تعني خللًا يُراجَع لا رصيدًا يُصحَّح آليًّا.
 */
export async function payDisbursement(input: PayDisbursementInput): Promise<Disbursement> {
  const store = getStore()
  const order = await store.getDisbursement(input.id)
  if (!order) throw new Error('أمر الصرف غير موجود')
  if (order.status === 'paid') return order
  if (order.status === 'cancelled') throw new Error('أمر الصرف مُلغى — لا يُصرف')

  const reference = input.paymentReference.trim()
  if (!reference) throw new Error('مرجع الحوالة مطلوب لإقفال أمر الصرف')

  const wallet = await store.getWallet(order.beneficiaryId)
  const debit = Math.min(order.amount, availableBalance(wallet))
  let ledgerEntryId: string | null = null
  if (debit > 0) {
    const posted = await store.postLedgerEntry({
      userId: order.beneficiaryId,
      type: 'withdrawal',
      amount: debit,
      listingId: order.listingId,
      depositId: null,
      orderId: order.orderId,
      note: `صُرف إلى حسابك البنكي — أمر الصرف ${order.reference}`,
      actorAdminId: input.adminId,
    })
    ledgerEntryId = posted.entry.id
  }

  const paid = await store.updateDisbursement(order.id, {
    status: 'paid',
    paidAt: new Date().toISOString(),
    paidByAdminId: input.adminId,
    paymentReference: reference,
    ledgerEntryId,
    note:
      debit < order.amount
        ? `${input.note ? `${input.note} — ` : ''}صُرف ${formatAmount(order.amount)} والمخصوم من المحفظة ${formatAmount(debit)}`
        : (input.note ?? order.note),
  })

  await notify(store, {
    userId: order.beneficiaryId,
    type: 'order_released',
    title: 'حُوّل المبلغ إلى حسابك البنكي',
    body: `${formatAmount(order.amount)} ريال عن «${order.plateLabel}» — مرجع الحوالة ${reference}.`,
    href: '/account/wallet',
    listingId: order.listingId,
  })

  await store.appendAudit({
    actorId: input.adminId,
    action: 'disbursement.pay',
    entityType: 'disbursement',
    entityId: order.id,
    beforeData: { status: order.status },
    afterData: { status: 'paid', paymentReference: reference, debit },
  })

  return paid
}

/**
 * يُلغي أمر صرف لم يُنفَّذ.
 *
 * المستفيد يبقى رصيده في محفظته: الإلغاء يُسقط **الحوالة** لا الاستحقاق —
 * ومن اختار ترك ماله في المنصّة لا يُنقص منه شيء.
 */
export async function cancelDisbursement(input: {
  id: string
  reason: string
  adminId: string
}): Promise<Disbursement> {
  const store = getStore()
  const order = await store.getDisbursement(input.id)
  if (!order) throw new Error('أمر الصرف غير موجود')
  if (order.status === 'paid') throw new Error('أمر صرف مُنفَّذ لا يُلغى — قيّد تسوية مقابلة')
  if (order.status === 'cancelled') return order

  const reason = input.reason.trim()
  if (!reason) throw new Error('سبب الإلغاء مطلوب')

  const cancelled = await store.updateDisbursement(order.id, {
    status: 'cancelled',
    cancelledAt: new Date().toISOString(),
    cancelledByAdminId: input.adminId,
    cancelReason: reason,
  })

  await store.appendAudit({
    actorId: input.adminId,
    action: 'disbursement.cancel',
    entityType: 'disbursement',
    entityId: order.id,
    beforeData: { status: order.status },
    afterData: { status: 'cancelled', reason },
  })

  return cancelled
}

/** أمر صرف لا يُنفَّذ حتى يكتمل حساب مستفيده. */
export function isPayable(order: Disbursement): boolean {
  return order.status === 'pending' && Boolean(order.bankIban && order.bankAccountName)
}
