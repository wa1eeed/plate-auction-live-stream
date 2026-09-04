import {
  ORDER_STATUS_LABELS,
  computeCommission,
  isEscrowHeld,
  isFinalOrderStatus,
  type CommissionBreakdown,
  type Listing,
  type Order,
} from '@/lib/domain/types'
import { formatAmount, type Halalas } from '@/lib/domain/money'
import { getStore } from '@/lib/store'
import type { AuctionStore } from '@/lib/store/types'
import { ServiceError, releaseLosingDeposits } from './market-service'
import { settleOrderDeposit } from './wallet-service'
import { chargeOrderCommission, type ExternalBuyerCollection } from './commission-service'
import { notify } from './notification-service'
import { issueCommissionInvoice } from './invoice-service'
import { raiseDisbursement } from './disbursement-service'

const HOUR = 3_600_000

/**
 * الضمان: المنصّة تحجز مال المشتري حتى تُنقل الملكية.
 *
 * القاعدة الحاكمة: **المال لا يخرج إلا إلى طرفٍ أدّى.** فالمؤقّت التلقائي
 * يُفرج للبائع بعد أن رفع إثباته وسكت المشتري، ولا يُكافئ صامتًا لم يفعل شيئًا:
 * انقضاء مهلة النقل لا ينقل مالًا، بل يفتح للمشتري حقّ طلب الاسترداد.
 */

/**
 * تحصيل الضمان — تُستدعى لحظة وصول المال أيًّا كانت وسيلته.
 *
 * تحلّ محلّ `applyOrderCompletion` القديمة: كانت تُنهي الصفقة عند وصول المال،
 * فيُقيَّد الإيراد ويُخصم العربون **قبل أن ينتقل شيء**. الآن تُحصّل وتحجز،
 * والإفراج مرحلة مستقلّة.
 */
export async function captureOrderEscrow(
  store: AuctionStore,
  order: Order,
  adminId: string | null,
  external: ExternalBuyerCollection | null = null,
): Promise<Order> {
  if (isEscrowHeld(order.status)) return order

  const listing = await store.getListing(order.listingId)
  if (!listing) throw new ServiceError('الإعلان غير موجود', 404, 'LISTING_NOT_FOUND')

  // عربون المشتري جزء من الثمن، فيُخصم الآن ويصير ضمن الأمانة
  await settleOrderDeposit(order.id, adminId)

  /*
   * وعرابين بقيّة المزايدين تعود **هنا**.
   *
   * كانت تُفكّ عند «الاكتمال»؛ والمشتري أدّى ما عليه بالسداد، فسقط احتمال
   * إعادة الإرساء ولا وجه لتجميد مال غيره أيامًا إضافية.
   */
  await releaseLosingDeposits(store, order.listingId, order.buyerId, 'سُدّدت الصفقة وأُغلق المزاد')

  // عمولة المشتري تُقتطع عند التحصيل — دفعها ضمن ما سدّده
  await chargeOrderCommission(order, adminId, external)

  const now = Date.now()
  const updated = await store.updateOrder(order.id, {
    status: 'escrow_held',
    paidAt: new Date(now).toISOString(),
    escrowAmount: order.amount,
    transferDueAt: new Date(now + listing.escrowTransferWindowHours * HOUR).toISOString(),
  })

  const plate = `${listing.arabicLetters} ${listing.plateNumbers}`
  await notify(store, {
    userId: order.sellerId,
    type: 'order_awaiting_transfer',
    title: 'وصل مال المشتري — انقل الملكية',
    body: `${formatAmount(order.amount)} ريال محجوزة لصالحك عن «${plate}». انقل الملكية وارفع إثباتها خلال ${listing.escrowTransferWindowHours} ساعة ليصلك المبلغ.`,
    href: '/account/sales',
    listingId: order.listingId,
  })
  await notify(store, {
    userId: order.buyerId,
    type: 'order_escrow_held',
    title: 'حُجز مبلغك حتى نقل الملكية',
    body: `${formatAmount(order.amount)} ريال محفوظة لدى المنصّة عن «${plate}»، ولا تُفرج للبائع إلا بعد نقل الملكية.`,
    href: '/account/purchases',
    listingId: order.listingId,
  })
  return updated
}

/** يُرجع الصفقة إن كان الفاعل طرفها المتوقّع وحالتها تسمح. */
async function requireOrder(
  orderId: string,
  expect: { userId?: string; role?: 'buyer' | 'seller'; statuses: Order['status'][] },
): Promise<{ order: Order; listing: Listing; store: AuctionStore }> {
  const store = getStore()
  const order = await store.getOrder(orderId)
  if (!order) throw new ServiceError('الصفقة غير موجودة', 404, 'ORDER_NOT_FOUND')

  if (expect.userId && expect.role) {
    const owner = expect.role === 'buyer' ? order.buyerId : order.sellerId
    if (owner !== expect.userId) {
      throw new ServiceError('هذه الصفقة ليست لك', 403, 'NOT_YOUR_ORDER')
    }
  }
  if (!expect.statuses.includes(order.status)) {
    throw new ServiceError(
      `لا يقبل هذا الإجراء صفقة حالتها «${ORDER_STATUS_LABELS[order.status]}»`,
      409,
      'ORDER_STATE_INVALID',
    )
  }
  const listing = await store.getListing(order.listingId)
  if (!listing) throw new ServiceError('الإعلان غير موجود', 404, 'LISTING_NOT_FOUND')
  return { order, listing, store }
}

/** البائع يرفع إثبات نقل الملكية، فتراجعه الإدارة قبل تحويل المبلغ له. */
export async function submitTransferProof(input: {
  orderId: string
  sellerId: string
  note: string
}): Promise<Order> {
  const { order, listing, store } = await requireOrder(input.orderId, {
    userId: input.sellerId,
    role: 'seller',
    statuses: ['escrow_held'],
  })

  const now = Date.now()
  const confirmDueAt = new Date(now + listing.escrowReviewWindowHours * HOUR).toISOString()
  const updated = await store.updateOrder(order.id, {
    status: 'ownership_transferred',
    transferProofNote: input.note,
    transferProofAt: new Date(now).toISOString(),
    confirmDueAt,
  })

  /*
   * يُخبَر المشتري ولا يُطالَب.
   *
   * الإفراج قرار إدارة، فلا يُقال له «أكّد وإلا أُفرج تلقائيًا» — ذلك يُحمّله
   * مسؤوليةً ليست له. ويُذكَّر بأن بابه مفتوح إن كان لديه ما يقوله.
   */
  await notify(store, {
    userId: order.buyerId,
    type: 'order_awaiting_confirmation',
    title: 'نُقلت ملكية لوحتك — تتحقّق الإدارة',
    body: 'رفع البائع إثبات نقل الملكية، وتراجعه الإدارة قبل تحويل المبلغ له. لا مطلوب منك، ولك أن ترفع استفسارًا قبل التحويل.',
    href: '/account/purchases',
    listingId: order.listingId,
  })
  return updated
}

/**
 * استفسار أو اعتراض من أحد الطرفين — مفتوحٌ حتى يقع الإفراج.
 *
 * وله أثران بحسب موضع المال:
 *  • **والمال محجوز** — يُجمَّد الإفراج (`disputed`) حتى تفصل الإدارة.
 *  • **وقبل السداد** — يُسجَّل ويُرفع إلى الإدارة بلا تجميد: تحويل صفقة لم
 *    يصل مالها إلى `disputed` يمنع صاحبها من السداد، فيُعاقَب على سؤاله.
 */
export async function openDispute(input: {
  orderId: string
  userId: string
  reason: string
}): Promise<Order> {
  const store = getStore()
  const order = await store.getOrder(input.orderId)
  if (!order) throw new ServiceError('الصفقة غير موجودة', 404, 'ORDER_NOT_FOUND')
  if (order.buyerId !== input.userId && order.sellerId !== input.userId) {
    throw new ServiceError('هذه الصفقة ليست لك', 403, 'NOT_YOUR_ORDER')
  }
  if (isFinalOrderStatus(order.status)) {
    throw new ServiceError(
      `لا اعتراض على صفقة حالتها «${ORDER_STATUS_LABELS[order.status]}»`,
      409,
      'ORDER_STATE_INVALID',
    )
  }
  if (order.status === 'disputed') {
    throw new ServiceError('على هذه الصفقة اعتراض قائم قيد المراجعة', 409, 'ALREADY_DISPUTED')
  }

  // التجميد للمال المحجوز وحده — والتسجيل يقع في الحالين
  const freeze = isEscrowHeld(order.status)
  const updated = await store.updateOrder(order.id, {
    ...(freeze ? { status: 'disputed' as const } : {}),
    disputedAt: new Date().toISOString(),
    disputeReason: input.reason,
    disputedBy: input.userId,
  })

  // يُنبَّه الطرف الآخر — لا يُترك يكتشف توقّف صفقته بنفسه
  const other = input.userId === order.buyerId ? order.sellerId : order.buyerId
  await notify(store, {
    userId: other,
    type: 'order_disputed',
    title: 'رُفع اعتراض على صفقتك',
    body: freeze
      ? `${input.reason} — توقّف الإفراج حتى تفصل الإدارة.`
      : `${input.reason} — رُفع إلى الإدارة، والصفقة تمضي في مسارها.`,
    href: order.buyerId === other ? '/account/purchases' : '/account/sales',
    listingId: order.listingId,
  })
  return updated
}

/**
 * الإفراج للبائع: عائده = قيمة الصفقة ناقص عمولته وضريبتها.
 *
 * العمولة تُخصم **من العائد** لا من محفظته: البائع لا يملك رصيدًا ليدفع عمولة
 * بيعٍ لم يقبض ثمنه بعد، فاقتطاعها من محفظته كان يُنتج «عمولة مستحقّة» على من
 * تستحقّ له المنصّة مالًا.
 */
export async function releaseOrderEscrow(
  order: Order,
  by: { by: 'admin'; adminId: string | null },
): Promise<Order> {
  const store = getStore()
  // الإفراج مرّة واحدة: قيد العائد هو الختم
  if (order.payoutLedgerEntryId) return order

  const listing = await store.getListing(order.listingId)
  const settings = await store.getCommissionSettings()
  const commission = computeCommission(settings, order.amount)
  const dues: CommissionBreakdown = commission.seller
  const payout: Halalas = Math.max(0, order.amount - dues.total)

  const plate = listing ? `${listing.arabicLetters} ${listing.plateNumbers}` : 'اللوحة'
  const posted = await store.postLedgerEntry({
    userId: order.sellerId,
    type: 'sale_proceeds',
    amount: payout,
    listingId: order.listingId,
    depositId: null,
    orderId: order.id,
    note:
      dues.total > 0
        ? `عائد بيع «${plate}» بعد خصم عمولة المنصّة وضريبتها`
        : `عائد بيع «${plate}»`,
    actorAdminId: by.adminId,
  })

  // عمولة البائع تُقيَّد إيرادًا محصَّلًا — اقتُطعت من العائد قبل قيده
  if (dues.total > 0) {
    const at = new Date().toISOString()
    const parts: { type: 'commission_seller' | 'vat_seller'; amount: Halalas }[] = [
      { type: 'commission_seller', amount: dues.base },
    ]
    if (dues.vat > 0) parts.push({ type: 'vat_seller', amount: dues.vat })
    for (const part of parts) {
      if (part.amount <= 0) continue
      await store.appendPlatformEntry({
        paymentId: null,
        type: part.type,
        amount: part.amount,
        userId: order.sellerId,
        orderId: order.id,
        listingId: order.listingId,
        depositId: null,
        settled: true,
        ledgerEntryId: posted.entry.id,
        note: 'اقتُطعت من عائد البيع',
        settledAt: at,
      })
    }
  }

  const now = new Date().toISOString()
  const updated = await store.updateOrder(order.id, {
    status: 'completed',
    payoutLedgerEntryId: posted.entry.id,
    releasedAt: now,
    completedAt: now,
  })

  await notify(store, {
    userId: order.sellerId,
    type: 'order_released',
    title: 'وصلك مبلغ الصفقة',
    body: `${formatAmount(payout)} ريال في محفظتك عن «${plate}» — بعد تحقّق الإدارة من نقل الملكية.`,
    href: '/account/wallet',
    listingId: order.listingId,
  })
  /*
   * الفوترة وأمر الصرف بعد القيد لا قبله.
   *
   * القيد هو الفعل الذي لا رجعة فيه؛ وما بعده — فاتورةٌ وورقةُ صرف — يلحق
   * به. وتقديمهما عليه يترك فاتورةً لعمولةٍ لم تُقتطع لو تعثّر القيد.
   */
  await issueCommissionInvoice(store, {
    order: updated,
    kind: 'seller_commission',
    customerId: order.sellerId,
    breakdown: dues,
    vatRate: settings.vatEnabled ? settings.vatPercent : 0,
    plateLabel: plate,
  })

  await raiseDisbursement(store, {
    order: updated,
    kind: 'seller_payout',
    beneficiaryId: order.sellerId,
    amount: payout,
    commissionAmount: dues.base,
    vatAmount: dues.vat,
    adminId: by.adminId,
    note: 'عائد بيع بعد خصم عمولة المنصّة وضريبتها',
  })

  await store.appendAudit({
    actorId: by.adminId,
    action: 'order.release',
    entityType: 'order',
    entityId: order.id,
    beforeData: { status: order.status },
    afterData: { status: 'completed', payout, dues: dues.total, by: by.by },
  })
  return updated
}

/** الاسترداد للمشتري — قرار إدارة، أو انقضاء مهلة النقل بطلبه. */
export async function refundOrderEscrow(
  order: Order,
  input: { reason: string; adminId: string | null },
): Promise<Order> {
  const store = getStore()
  if (!isEscrowHeld(order.status)) {
    throw new ServiceError(
      `لا استرداد لصفقة حالتها «${ORDER_STATUS_LABELS[order.status]}»`,
      409,
      'ORDER_STATE_INVALID',
    )
  }

  const listing = await store.getListing(order.listingId)
  const plate = listing ? `${listing.arabicLetters} ${listing.plateNumbers}` : 'اللوحة'

  /*
   * يُردّ ما دخل المنصّة: قيمة الصفقة وعمولة المشتري وضريبتها.
   * وقيود الإيراد المقابلة تُوسَم مُبطَلة ولا تُحذف — الدفتر يروي ما حدث.
   */
  const revenue = await store.listPlatformEntries({ orderId: order.id })
  const buyerRevenue = revenue.filter(
    (row) => !row.reversedAt && (row.type === 'commission_buyer' || row.type === 'vat_buyer'),
  )
  const fees = buyerRevenue.reduce((sum, row) => sum + row.amount, 0)

  await store.postLedgerEntry({
    userId: order.buyerId,
    type: 'purchase_refund',
    amount: order.escrowAmount + fees,
    listingId: order.listingId,
    depositId: null,
    orderId: order.id,
    note: `استرداد «${plate}» — ${input.reason}`,
    actorAdminId: input.adminId,
  })
  for (const row of buyerRevenue) {
    await store.updatePlatformEntry(row.id, {
      reversedAt: new Date().toISOString(),
      reversalReason: input.reason,
    })
  }

  const updated = await store.updateOrder(order.id, {
    status: 'refunded',
    completedAt: new Date().toISOString(),
  })

  /*
   * أمرُ صرفٍ للمشتري كذلك.
   *
   * المبلغ عاد إلى محفظته قيدًا، لكن إخراجه إلى حسابه البنكي التزامٌ على
   * المنصّة لا يُقفل إلا بحوالة ومرجعها. ومن آثر ترك رصيده في المحفظة
   * أُلغي أمره بسببه — لا يُنقص ذلك من رصيده شيئًا.
   */
  await raiseDisbursement(store, {
    order: updated,
    kind: 'buyer_refund',
    beneficiaryId: order.buyerId,
    amount: order.escrowAmount + fees,
    adminId: input.adminId,
    note: input.reason,
  })

  await notify(store, {
    userId: order.buyerId,
    type: 'order_refunded',
    title: 'عاد مبلغ صفقتك إليك',
    body: `${formatAmount(order.escrowAmount + fees)} ريال عادت إلى رصيدك عن «${plate}» — ${input.reason}.`,
    href: '/account/wallet',
    listingId: order.listingId,
  })
  await notify(store, {
    userId: order.sellerId,
    type: 'order_refunded',
    title: 'عاد مبلغ صفقة لوحتك إلى المشتري',
    body: `«${plate}» — ${input.reason}.`,
    href: '/account/sales',
    listingId: order.listingId,
  })
  await store.appendAudit({
    actorId: input.adminId,
    action: 'order.refund',
    entityType: 'order',
    entityId: order.id,
    beforeData: { status: order.status },
    afterData: { status: 'refunded', amount: order.escrowAmount + fees, reason: input.reason },
  })
  return updated
}

/**
 * تذكير الإدارة بما ينتظر تحقّقها — بلا تحريك مال.
 *
 * كان هنا **إفراج تلقائي** بانقضاء مهلة تأكيد المشتري. وقد صار الإفراج قرار
 * إدارة، فبقاء التلقائي يعني أن يخرج المال بلا قرارٍ من أحد — وهو نقضٌ
 * للنموذج نفسه. فما بقي إلا التذكير: من رفع إثباته لا يُترك ينتظر بلا أجل،
 * والمهلة صارت **مهلة مراجعة** يُقاس بها تأخّر الإدارة لا صمت المشتري.
 */
export async function sweepEscrow(store: AuctionStore): Promise<number> {
  const orders = (await store.listOrders({})).filter(
    (order) => order.status === 'ownership_transferred' && order.confirmDueAt,
  )
  const now = Date.now()
  let reminded = 0

  for (const order of orders) {
    const due = Date.parse(order.confirmDueAt!)
    if (now < due || order.remindersSent.includes('review_due')) continue

    await store.markOrderReminded(order.id, 'review_due')
    // البائع صاحب المال المنتظِر — يُخبَر أن صفقته تجاوزت مهلة المراجعة
    await notify(store, {
      userId: order.sellerId,
      type: 'order_awaiting_confirmation',
      title: 'صفقتك تجاوزت مهلة مراجعة الإدارة',
      body: 'رُفع إثبات نقلك وتنتظر تحقّق الإدارة — تابعها إن طال الانتظار.',
      href: '/account/sales',
      listingId: order.listingId,
    })
    reminded += 1
  }
  return reminded
}
