import {
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  availableBalance,
  computeCommission,
  type AccountOrder,
  type PaymentMethod,
  type PublicPaymentOptions,
} from '@/lib/domain/types'
import type { Halalas } from '@/lib/domain/money'
import { formatAmount } from '@/lib/domain/money'
import { buildOrderSettlement, buildOrderTimeline } from '@/lib/domain/order-timeline'
import { getStore } from '@/lib/store'
import { ServiceError } from './market-service'
import { getPublicPaymentOptions } from './payment-service'
import { createCharge, isTapError } from './tap-client'
import { appUrl } from '@/lib/config'
import { captureOrderEscrow } from './escrow-service'
import { notify } from './notification-service'

/** خيار دفع معروض في صفحة السداد — ومعه سبب تعطيله إن كان معطّلًا. */
export type CheckoutMethod = {
  method: PaymentMethod
  label: string
  available: boolean
  hint: string
}

export type CheckoutView = {
  order: AccountOrder
  sellerName: string
  plateLabel: string
  /** رصيد المشتري المتاح — يقرّر إمكان الدفع من المحفظة */
  availableBalance: Halalas
  methods: CheckoutMethod[]
  payment: PublicPaymentOptions
}

/**
 * صفحة السداد لصفقة واحدة.
 *
 * مقصورة على **مشتري الصفقة**: مبالغها وعمولتها شأنه وحده، ورؤيتها من غيره
 * تكشف ما دفعه ولمن.
 */
export async function getCheckoutView(orderId: string, userId: string): Promise<CheckoutView> {
  const store = getStore()
  const order = await store.getOrder(orderId)
  if (!order) throw new ServiceError('الصفقة غير موجودة', 404, 'ORDER_NOT_FOUND')
  if (order.buyerId !== userId) {
    throw new ServiceError('هذه الصفقة ليست لك', 403, 'NOT_YOUR_ORDER')
  }

  const listing = await store.getListing(order.listingId)
  if (!listing) throw new ServiceError('الإعلان غير موجود', 404, 'LISTING_NOT_FOUND')

  const [seller, wallet, commissionSettings, options] = await Promise.all([
    store.findUser(order.sellerId),
    store.getWallet(userId),
    store.getCommissionSettings(),
    getPublicPaymentOptions(),
  ])

  const deposit = order.depositId ? await store.getDeposit(order.depositId) : null
  const commission = computeCommission(commissionSettings, order.amount)
  const settlement = buildOrderSettlement(
    order,
    deposit ? { amount: deposit.amount, status: deposit.status } : null,
    commission.buyer,
    'buyer',
  )

  const available = availableBalance(wallet)
  const methods: CheckoutMethod[] = [
    {
      method: 'wallet',
      label: PAYMENT_METHOD_LABELS.wallet,
      available: available >= settlement.net && settlement.net > 0,
      hint:
        available >= settlement.net
          ? `رصيدك المتاح ${formatAmount(available)} ريال — يُخصم فورًا وتكتمل الصفقة`
          : `رصيدك المتاح ${formatAmount(available)} ريال ولا يكفي المطلوب`,
    },
    {
      method: 'tap',
      label: PAYMENT_METHOD_LABELS.tap,
      available: options.tapEnabled,
      hint: options.tapEnabled
        ? 'تحويل إلى صفحة الدفع الآمنة ثم العودة'
        : 'غير مفعّلة حاليًا',
    },
    {
      method: 'bank_transfer',
      label: PAYMENT_METHOD_LABELS.bank_transfer,
      available: options.bankTransferEnabled,
      hint: options.bankTransferEnabled
        ? 'تظهر لك بيانات الحساب، وتُعتمد بعد تحقّق الإدارة'
        : 'غير مفعّلة حاليًا',
    },
  ]

  return {
    order: {
      ...order,
      plate: {
        plateType: listing.plateType,
        arabicLetters: listing.arabicLetters,
        latinLetters: listing.latinLetters,
        plateNumbers: listing.plateNumbers,
        emblem: listing.emblem,
        customEmblemUrl: listing.customEmblemUrl,
      },
      counterpartName: seller?.displayName ?? 'مستخدم',
      settlement,
      timeline: buildOrderTimeline(order, settlement, Date.now(), 'buyer'),
    },
    sellerName: seller?.displayName ?? 'مستخدم',
    plateLabel: `${listing.arabicLetters} ${listing.plateNumbers}`,
    availableBalance: available,
    methods,
    payment: options,
  }
}

export type CheckoutResult = {
  paymentReference: string
  /** Tap وحدها — رابط صفحة الدفع المستضافة */
  redirectUrl: string | null
  /** هل اكتملت الصفقة فورًا؟ الدفع من المحفظة وحده يفعل ذلك */
  settled: boolean
}

/**
 * يبدأ سداد صفقة.
 *
 * المحفظة تُسوّي فورًا لأن المال داخل المنصّة أصلًا؛ وغيرها يُنشئ عملية معلّقة
 * تُعتمد بتأكيد الإدارة أو ردّ البوابة — فلا تُعلَّم صفقة مسدّدة قبل وصول مالها.
 */
export async function startOrderPayment(input: {
  orderId: string
  userId: string
  method: PaymentMethod
}): Promise<CheckoutResult> {
  const store = getStore()
  const view = await getCheckoutView(input.orderId, input.userId)
  const { order } = view

  /*
   * قائمة **سماح** لا منع.
   *
   * كان الحارس يرفض `completed` و`cancelled` وحدهما، فتمرّ `defaulted` —
   * صفقة أُعلن تخلّف مشتريها وقد أُعيد إرساؤها على غيره، ومع ذلك يُقبل سدادها.
   * وكل حالة جديدة تُضاف مستقبلًا كانت ستمرّ صامتة.
   */
  if (order.status !== 'awaiting_settlement') {
    throw new ServiceError(
      order.status === 'completed'
        ? 'هذه الصفقة مسدّدة مسبقًا'
        : `لا تقبل هذه الصفقة السداد — حالتها ${ORDER_STATUS_LABELS[order.status]}`,
      409,
      order.status === 'completed'
        ? 'ORDER_COMPLETED'
        : order.status === 'cancelled'
          ? 'ORDER_CANCELLED'
          : 'ORDER_NOT_PAYABLE',
    )
  }

  const chosen = view.methods.find((row) => row.method === input.method)
  if (!chosen?.available) {
    throw new ServiceError(chosen?.hint ?? 'وسيلة دفع غير متاحة', 409, 'METHOD_UNAVAILABLE')
  }

  const due = order.settlement.net
  const payment = await store.createPayment({
    userId: input.userId,
    orderId: order.id,
    // نُجمّد التفصيل: تغيّر الإعدادات بين البدء والتأكيد لا يغيّر ما يُقيَّد
    orderPrice: order.settlement.price,
    buyerCommission: order.settlement.commission?.base ?? 0,
    buyerVat: order.settlement.commission?.vat ?? 0,
    amount: due,
    method: input.method,
    status: input.method === 'wallet' ? 'paid' : input.method === 'tap' ? 'initiated' : 'awaiting_transfer',
    tapChargeId: null,
    tapMode: null,
    tapStatus: null,
    transferNote: null,
    ledgerEntryId: null,
    failureReason: null,
  })

  if (input.method !== 'wallet') {
    let redirectUrl: string | null = null

    /*
     * البطاقة تحتاج شحنة فعلية عند البوابة.
     *
     * كانت تُنشئ سجلّ دفعة وتعيد `redirectUrl: null` بلا استدعاء `createCharge`
     * إطلاقًا — فيصل المشتري صفحة الشكر «استلمنا سدادك» ولم يدفع شيئًا.
     */
    if (input.method === 'tap') {
      const settings = await store.getPaymentSettings()
      const user = await store.findUser(input.userId)
      try {
        const charge = await createCharge({
          mode: settings.tapMode,
          amount: due,
          reference: payment.reference,
          customer: { name: user?.displayName ?? 'مشترٍ', email: user?.email ?? '' },
          description: `سداد «${view.plateLabel}» — ${payment.reference}`,
          redirectUrl: `${appUrl()}/checkout/${order.id}/thanks`,
          webhookUrl: `${appUrl()}/api/webhooks/tap`,
        })
        await store.updatePayment(payment.id, {
          tapChargeId: charge.id,
          tapMode: settings.tapMode,
          tapStatus: charge.status,
        })
        redirectUrl = charge.redirectUrl
      } catch (error) {
        // نُسجّل الفشل على العملية بدل تركها معلّقة بلا تفسير
        await store.updatePayment(payment.id, {
          status: 'failed',
          failureReason: isTapError(error) ? error.message : 'تعذّر بدء الدفع عبر البوابة',
        })
        if (isTapError(error)) throw new ServiceError(error.message, 502, error.code)
        throw error
      }
    }

    await notify(store, {
      userId: input.userId,
      type: 'payment_due_soon',
      title: 'بدأت عملية سداد',
      body: `${payment.reference} — ${formatAmount(due)} ريال عن «${view.plateLabel}».`,
      href: `/account/purchases`,
      listingId: order.listingId,
    })
    return { paymentReference: payment.reference, redirectUrl, settled: false }
  }

  /*
   * الدفع من المحفظة: يُخصم **ثمن اللوحة بعد العربون فقط**، ثم تُغلق الصفقة
   * بالمسار المعتاد (`applyOrderCompletion`) فيُخصم العربون وتُقتطع العمولة
   * وضريبتها وتُفكّ عرابين الباقين.
   *
   * ولو خُصم `remaining` كاملًا هنا لخُصمت العمولة مرّتين: مرّة ضمنه ومرّة في
   * `chargeOrderCommission` — وهو ما وقع فعلًا فخرج من المحفظة 37,012.50 بدل
   * 32,006.25. المطلوب المعروض يجمع الاثنين، والدفتر يفصلهما سطرًا سطرًا.
   */
  const price = Math.max(0, order.amount - (order.settlement.depositApplied || order.settlement.deposit))
  if (price > 0) {
    await store.postLedgerEntry({
      userId: input.userId,
      type: 'purchase_payment',
      amount: price,
      listingId: order.listingId,
      depositId: null,
      orderId: order.id,
      note: `سداد «${view.plateLabel}» — ${payment.reference}`,
      actorAdminId: null,
    })
  }
  /*
   * المال وصل، فيُحجز أمانةً — لا تكتمل الصفقة بالسداد.
   * الإفراج للبائع مرحلة تالية بعد نقل الملكية.
   */
  const fresh = (await store.getOrder(order.id))!
  await captureOrderEscrow(store, fresh, null)
  // ختم التسوية يمنع إعادة تسوية العملية من أي مسار آخر
  await store.updatePayment(payment.id, { settledAt: new Date().toISOString() })

  return { paymentReference: payment.reference, redirectUrl: null, settled: true }
}
