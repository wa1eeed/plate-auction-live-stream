/**
 * خدمات الدفع: شحن رصيد المحفظة عبر بوابة Tap أو بحوالة بنكية.
 *
 * ضمانة مركزية: **لا يُضاف الرصيد مرّتين مهما تكرّرت الإشعارات.**
 * كل عملية دفع تحمل `ledgerEntryId`؛ وجوده يعني أن الرصيد أُضيف، فأي ويبهوك
 * مكرّر أو عودة متكرّرة للمستخدم أو تأكيد إداري ثانٍ لا يفعل شيئًا.
 */
import {
  ORDER_STATUS_LABELS,
  isClosedPayment,
  type Payment,
  type PaymentMethod,
  type PaymentSettings,
  type PublicPaymentOptions,
  type TapMode,
} from '@/lib/domain/types'
import type { Halalas } from '@/lib/domain/money'
import { appUrl } from '@/lib/config'
import { getStore } from '@/lib/store'
import type { AuctionStore } from '@/lib/store/types'
import { ServiceError } from './market-service'
import { notify } from './notification-service'
import { captureOrderEscrow } from './escrow-service'
import { formatAmount } from '@/lib/domain/money'
import { rateLimit } from './rate-limit'
import {
  chargeOutcome,
  createCharge,
  isTapConfigured,
  isTapError,
  retrieveCharge,
} from './tap-client'

/** أقل وأكثر مبلغ شحن — يمنع عمليات تافهة أو خاطئة بفارق خانة. */
export const MIN_TOPUP_RIYALS = 50
export const MAX_TOPUP_RIYALS = 500_000

// ---------------------------------------------------------------- الإعدادات

export async function getPaymentSettings(): Promise<PaymentSettings> {
  return getStore().getPaymentSettings()
}

/** حالة تهيئة مفاتيح Tap — للوحة الإدارة وحدها. */
export function tapConfiguration(): Record<TapMode, boolean> {
  return { test: isTapConfigured('test'), live: isTapConfigured('live') }
}

/**
 * ما يراه المستخدم من خيارات الدفع.
 * لا يُعرض خيار معطّل ولا خيار غير مهيّأ: عرض زرّ يفشل حتمًا تجربة سيّئة.
 */
export async function getPublicPaymentOptions(): Promise<PublicPaymentOptions> {
  const settings = await getPaymentSettings()
  const tapReady = settings.tapEnabled && isTapConfigured(settings.tapMode)
  const bankReady = settings.bankTransferEnabled && settings.bankIban.trim().length > 0

  return {
    tapEnabled: tapReady,
    tapMode: settings.tapMode,
    bankTransferEnabled: bankReady,
    bank: bankReady
      ? {
          name: settings.bankName,
          accountName: settings.bankAccountName,
          iban: settings.bankIban,
          accountNumber: settings.bankAccountNumber,
          instructions: settings.bankInstructions,
        }
      : null,
  }
}

export async function updatePaymentSettings(
  patch: Partial<PaymentSettings>,
  adminId: string,
): Promise<PaymentSettings> {
  const store = getStore()
  const before = await store.getPaymentSettings()

  // لا نسمح بتفعيل بوابة بلا مفتاح: الزرّ سيظهر للمستخدم ثم يفشل دفعه
  if (patch.tapEnabled && !isTapConfigured(patch.tapMode ?? before.tapMode)) {
    throw new ServiceError(
      'لا يمكن تفعيل Tap: مفتاح هذه البيئة غير مضبوط في متغيّرات البيئة.',
      409,
      'TAP_NOT_CONFIGURED',
    )
  }

  const settings = await store.updatePaymentSettings({ ...patch, updatedByAdminId: adminId })
  await store.appendAudit({
    actorId: adminId,
    action: 'payments.settings',
    entityType: 'payment_settings',
    entityId: 'singleton',
    beforeData: {
      tapEnabled: before.tapEnabled,
      tapMode: before.tapMode,
      bankTransferEnabled: before.bankTransferEnabled,
    },
    afterData: {
      tapEnabled: settings.tapEnabled,
      tapMode: settings.tapMode,
      bankTransferEnabled: settings.bankTransferEnabled,
    },
  })
  return settings
}

// ---------------------------------------------------------------- إنشاء عملية دفع

export type StartTopUpResult = {
  payment: Payment
  /** يُملأ لبوابة Tap وحدها — رابط صفحة الدفع المستضافة */
  redirectUrl: string | null
}

/** يبدأ عملية شحن رصيد بالطريقة المختارة. */
export async function startTopUp(input: {
  userId: string
  amount: Halalas
  method: PaymentMethod
}): Promise<StartTopUpResult> {
  const store = getStore()
  // حدّ معدّل: إنشاء عمليات دفع بلا حدّ يملأ السجلّ ويُرهق البوابة
  if (!rateLimit(`topup:${input.userId}`, 5, 60_000).allowed) {
    throw new ServiceError('محاولات كثيرة، انتظر دقيقة.', 429, 'RATE_LIMITED')
  }

  const user = await store.findUser(input.userId)
  if (!user) throw new ServiceError('المستخدم غير موجود', 404, 'USER_NOT_FOUND')

  const options = await getPublicPaymentOptions()
  if (input.method === 'tap' && !options.tapEnabled) {
    throw new ServiceError('الدفع بالبطاقة غير مفعّل حاليًا.', 409, 'METHOD_DISABLED')
  }
  if (input.method === 'bank_transfer' && !options.bankTransferEnabled) {
    throw new ServiceError('الحوالة البنكية غير مفعّلة حاليًا.', 409, 'METHOD_DISABLED')
  }

  const settings = await store.getPaymentSettings()

  const payment = await store.createPayment({
    userId: input.userId,
    orderId: null,
    orderPrice: null,
    buyerCommission: null,
    buyerVat: null,
    amount: input.amount,
    method: input.method,
    status: input.method === 'tap' ? 'initiated' : 'awaiting_transfer',
    tapChargeId: null,
    tapMode: input.method === 'tap' ? settings.tapMode : null,
    tapStatus: null,
    transferNote: null,
    ledgerEntryId: null,
    failureReason: null,
  })

  if (input.method === 'bank_transfer') return { payment, redirectUrl: null }

  try {
    const charge = await createCharge({
      mode: settings.tapMode,
      amount: input.amount,
      reference: payment.reference,
      customer: { name: user.displayName, email: user.email },
      description: `شحن رصيد محفظة — ${payment.reference}`,
      redirectUrl: `${appUrl()}/account/wallet/return`,
      webhookUrl: `${appUrl()}/api/webhooks/tap`,
    })
    const updated = await store.updatePayment(payment.id, {
      tapChargeId: charge.id,
      tapStatus: charge.status,
    })
    return { payment: updated, redirectUrl: charge.redirectUrl }
  } catch (error) {
    // نُسجّل الفشل على العملية بدل تركها معلّقة بلا تفسير
    await store.updatePayment(payment.id, {
      status: 'failed',
      failureReason: isTapError(error) ? error.message : 'تعذّر بدء الدفع',
    })
    if (isTapError(error)) throw new ServiceError(error.message, 502, error.code)
    throw error
  }
}

/** المستخدم يُرفق رقم حوالته فتنتقل العملية إلى مراجعة الإدارة. */
export async function submitTransferProof(input: {
  paymentId: string
  userId: string
  note: string
}): Promise<Payment> {
  const store = getStore()
  const payment = await requireOwnedPayment(store, input.paymentId, input.userId)
  if (payment.status !== 'awaiting_transfer') {
    throw new ServiceError('لا يمكن تعديل هذه العملية.', 409, 'PAYMENT_CLOSED')
  }
  return store.updatePayment(payment.id, {
    status: 'under_review',
    transferNote: input.note.trim() || null,
  })
}

/** المستخدم يلغي عملية لم تُدفع بعد. */
export async function cancelPayment(paymentId: string, userId: string): Promise<Payment> {
  const store = getStore()
  const payment = await requireOwnedPayment(store, paymentId, userId)
  if (isClosedPayment(payment.status)) {
    throw new ServiceError('هذه العملية مغلقة مسبقًا.', 409, 'PAYMENT_CLOSED')
  }
  return store.updatePayment(payment.id, { status: 'cancelled' })
}

async function requireOwnedPayment(
  store: AuctionStore,
  paymentId: string,
  userId: string,
): Promise<Payment> {
  const payment = await store.getPayment(paymentId)
  if (!payment) throw new ServiceError('عملية الدفع غير موجودة', 404, 'PAYMENT_NOT_FOUND')
  if (payment.userId !== userId) throw new ServiceError('لا تملك هذه العملية', 403, 'FORBIDDEN')
  return payment
}

// ---------------------------------------------------------------- التسوية

/**
 * يُنجح عملية دفع ويضيف رصيدها — مرّة واحدة مهما تكرّر الاستدعاء.
 *
 * هذه هي النقطة الوحيدة التي يدخل فيها مال إلى محفظة عبر الدفع، وحراستها
 * بـ `ledgerEntryId` هي ما يمنع الشحن المزدوج من ويبهوك مكرّر أو عودة
 * متكرّرة للمستخدم أو تأكيد إداري ثانٍ.
 */
export async function markPaymentPaid(input: {
  paymentId: string
  adminId: string | null
  note: string | null
}): Promise<Payment> {
  const store = getStore()
  const payment = await store.getPayment(input.paymentId)
  if (!payment) throw new ServiceError('عملية الدفع غير موجودة', 404, 'PAYMENT_NOT_FOUND')

  /*
   * شوكة واحدة صريحة: العملية إمّا **تشحن محفظة** وإمّا **تسوّي صفقة**،
   * ولا تفعل الاثنين أبدًا.
   *
   * كانت الدالة تعرف فعلًا واحدًا — كتابة قيد `topup` — فتطبّقه على كل عملية.
   * فمن حوّل ثمن لوحة بحوالة بنكية كان يجد المبلغ **رصيدًا في محفظته**
   * وتبقى صفقته «بانتظار السداد» إلى الأبد.
   */
  if (payment.orderId) return settleOrderPayment(payment, input.adminId)

  // أُضيف الرصيد سابقًا — نعيد الحالة كما هي بلا أي أثر جديد
  if (payment.ledgerEntryId) return payment

  const { entry } = await store.postLedgerEntry({
    userId: payment.userId,
    type: 'topup',
    amount: payment.amount,
    listingId: null,
    depositId: null,
    orderId: null,
    note: input.note ?? `شحن رصيد — ${payment.reference}`,
    actorAdminId: input.adminId,
  })

  const updated = await store.updatePayment(payment.id, {
    status: 'paid',
    ledgerEntryId: entry.id,
    settledAt: new Date().toISOString(),
    settledByAdminId: input.adminId,
    failureReason: null,
  })

  await notify(store, {
    userId: payment.userId,
    type: 'payment_confirmed',
    title: 'أُضيف رصيدك',
    body: `${formatAmount(payment.amount)} ريال في محفظتك — جاهزة للمزايدة.`,
    href: '/account/wallet',
  })
  await store.appendAudit({
    actorId: input.adminId,
    action: 'payment.paid',
    entityType: 'payment',
    entityId: payment.id,
    beforeData: { status: payment.status },
    afterData: { status: 'paid', amount: payment.amount, method: payment.method },
  })
  return updated
}

/** يُفشل عملية دفع بسبب مذكور. */
export async function markPaymentFailed(input: {
  paymentId: string
  adminId: string | null
  reason: string
}): Promise<Payment> {
  const store = getStore()
  const payment = await store.getPayment(input.paymentId)
  if (!payment) throw new ServiceError('عملية الدفع غير موجودة', 404, 'PAYMENT_NOT_FOUND')
  /*
   * الختم لا القيد.
   *
   * `ledgerEntryId` يُملأ لشحن المحفظة وحده؛ ودفعة صفقة تُسوّى بلا قيد في
   * محفظة المشتري (المال وصل حساب المنصّة). فحارس القيد كان يسمح برفض دفعة
   * صفقة **سُوّيت فعلًا** واكتملت بها الصفقة.
   */
  if (payment.ledgerEntryId || payment.settledAt) {
    throw new ServiceError('لا يمكن رفض عملية سُوّيت مسبقًا.', 409, 'PAYMENT_SETTLED')
  }

  /*
   * (٤) ردّ ما حُصّل.
   *
   * دفعة صفقة عالقة في `under_review` كان المال فيها قد وصل المنصّة فعلًا ولا
   * مخرج له: رفضها يُعلّمها فاشلة ولا يُعيد ريالًا. فيُقيَّد الردّ إلى رصيد
   * صاحبها، ومنه يسحبه أو يستعمله.
   */
  const collected = payment.orderId !== null && payment.status === 'under_review'
  let refundEntryId: string | null = null
  if (collected) {
    const posted = await store.postLedgerEntry({
      userId: payment.userId,
      type: 'purchase_refund',
      amount: payment.amount,
      listingId: null,
      depositId: null,
      orderId: payment.orderId,
      note: `ردّ ${payment.reference} — ${input.reason}`,
      actorAdminId: input.adminId,
    })
    refundEntryId = posted.entry.id
  }

  const updated = await store.updatePayment(payment.id, {
    status: 'failed',
    ledgerEntryId: refundEntryId ?? payment.ledgerEntryId,
    failureReason: input.reason,
    settledAt: new Date().toISOString(),
    settledByAdminId: input.adminId,
  })
  await notify(store, {
    userId: payment.userId,
    type: 'payment_failed',
    title: collected ? 'عاد مبلغ عمليتك إلى رصيدك' : 'لم تكتمل عملية الدفع',
    body: collected
      ? `${formatAmount(payment.amount)} ريال عادت إلى رصيدك — ${input.reason}`
      : `${formatAmount(payment.amount)} ريال — ${input.reason}`,
    href: '/account/wallet',
  })
  await store.appendAudit({
    actorId: input.adminId,
    action: 'payment.failed',
    entityType: 'payment',
    entityId: payment.id,
    beforeData: { status: payment.status },
    afterData: { status: 'failed', reason: input.reason },
  })
  return updated
}

/**
 * يزامن عملية Tap مع حالتها الحقيقية في البوابة.
 *
 * تُستدعى عند عودة المستخدم وعند وصول الويبهوك: **البوابة مصدر الحقيقة**،
 * ولا نصدّق أي حالة قادمة من المتصفّح — من يعود إلى صفحة النجاح ليس بالضرورة
 * قد دفع.
 */
export async function syncTapPayment(paymentId: string): Promise<Payment> {
  const store = getStore()
  const payment = await store.getPayment(paymentId)
  if (!payment) throw new ServiceError('عملية الدفع غير موجودة', 404, 'PAYMENT_NOT_FOUND')
  if (payment.method !== 'tap' || !payment.tapChargeId) return payment
  /*
   * ختم التسوية لا وجود القيد.
   *
   * عملية صفقة قد تُسوّى **بلا أي قيد محفظة** (صفقة بلا عربون وبعمولة معطّلة)،
   * فحارس `ledgerEntryId` وحده يسمح بإعادة تسويتها. و`settledAt` يُختم في
   * المسارين معًا.
   */
  if (payment.ledgerEntryId || payment.settledAt) return payment

  let charge
  try {
    charge = await retrieveCharge(payment.tapMode ?? 'test', payment.tapChargeId)
  } catch (error) {
    if (isTapError(error)) throw new ServiceError(error.message, 502, error.code)
    throw error
  }

  const outcome = chargeOutcome(charge.status)
  await store.updatePayment(payment.id, { tapStatus: charge.status })

  if (outcome === 'paid') {
    return markPaymentPaid({ paymentId: payment.id, adminId: null, note: null })
  }
  if (outcome === 'failed') {
    return markPaymentFailed({
      paymentId: payment.id,
      adminId: null,
      reason: `رفضت البوابة العملية (${charge.status})`,
    })
  }
  return (await store.getPayment(payment.id))!
}

/** يعالج ويبهوك Tap بعد التحقّق من توقيعه في المسار. */
export async function handleTapWebhook(chargeId: string): Promise<void> {
  const store = getStore()
  const payment = await store.findPaymentByCharge(chargeId)
  // ويبهوك لعملية لا نعرفها: نتجاهله بصمت ولا نُفشل الطلب فيعيد Tap المحاولة
  if (!payment) return
  await syncTapPayment(payment.id)
}

// ---------------------------------------------------------------- القراءة

export async function getUserPayments(userId: string): Promise<Payment[]> {
  return getStore().listPayments({ userId })
}

export type AdminPaymentRow = Payment & {
  userName: string
  userEmail: string
  userReference: string
  /** غرض العملية — شحن محفظة أم سداد صفقة بعينها */
  orderReference: string | null
  plateLabel: string | null
}

export async function listAdminPayments(): Promise<AdminPaymentRow[]> {
  const store = getStore()
  const payments = await store.listPayments()
  const rows: AdminPaymentRow[] = []
  for (const payment of payments) {
    const user = await store.findUser(payment.userId)
    const order = payment.orderId ? await store.getOrder(payment.orderId) : null
    const listing = order ? await store.getListing(order.listingId) : null
    rows.push({
      ...payment,
      userName: user?.displayName ?? 'مستخدم',
      userEmail: user?.email ?? '—',
      userReference: user?.reference ?? payment.userId,
      orderReference: order?.reference ?? null,
      plateLabel: listing ? `${listing.arabicLetters} ${listing.plateNumbers}` : null,
    })
  }
  return rows
}

/**
 * تسوية صفقة بدفعة **خارجية** — بطاقة أو حوالة بنكية.
 *
 * الفرق الجوهري عن الدفع من المحفظة: المال وصل حساب المنصّة أو بوابتها، **لا
 * محفظة المشتري**. فلا يُخصم من محفظته ثمن اللوحة (لم يدخلها) ولا العمولة
 * (دفعها ضمن المبلغ الخارجي). القيد الوحيد على محفظته هو **خصم العربون**،
 * لأنه المال الوحيد الذي كان فيها فعلًا.
 *
 * وإيراد المنصّة يُقيَّد بالمبالغ **المجمّدة على العملية** لا بإعادة حسابها:
 * قد تتغيّر نسبة العمولة بين بدء الحوالة وتأكيدها.
 */
async function settleOrderPayment(payment: Payment, adminId: string | null): Promise<Payment> {
  const store = getStore()

  // سُوّيت سابقًا — لا أثر جديد مهما تكرّر الويبهوك أو التأكيد
  if (payment.settledAt) return payment

  const order = payment.orderId ? await store.getOrder(payment.orderId) : null
  if (!order) throw new ServiceError('صفقة العملية غير موجودة', 404, 'ORDER_NOT_FOUND')

  // الدافع يجب أن يكون مشتري الصفقة — لا تُسوّى صفقة بدفعة غيرها
  if (order.buyerId !== payment.userId) {
    return holdPaymentForReview(payment, 'الدافع ليس مشتري الصفقة', adminId)
  }
  if (order.status !== 'awaiting_settlement') {
    return holdPaymentForReview(
      payment,
      `الصفقة ${ORDER_STATUS_LABELS[order.status]} — لا تُسوّى بهذه العملية`,
      adminId,
    )
  }

  // المال وصل فيُحجز أمانةً — الإفراج للبائع بعد نقل الملكية
  await captureOrderEscrow(store, order, adminId, {
    paymentId: payment.id,
    buyer: {
      base: payment.buyerCommission ?? 0,
      vat: payment.buyerVat ?? 0,
      total: (payment.buyerCommission ?? 0) + (payment.buyerVat ?? 0),
    },
  })

  const updated = await store.updatePayment(payment.id, {
    status: 'paid',
    settledAt: new Date().toISOString(),
    settledByAdminId: adminId,
    failureReason: null,
  })

  await notify(store, {
    userId: payment.userId,
    type: 'payment_confirmed',
    title: 'وصل سدادك',
    body: `${formatAmount(payment.amount)} ريال — ${payment.reference}. المبلغ محجوز حتى نقل الملكية.`,
    href: '/account/purchases',
    listingId: order.listingId,
  })
  await store.appendAudit({
    actorId: adminId,
    action: 'payment.paid',
    entityType: 'payment',
    entityId: payment.id,
    beforeData: { status: payment.status, orderStatus: order.status },
    afterData: { status: 'paid', orderId: order.id, amount: payment.amount },
  })
  return updated
}

/**
 * دفعة لا تصلح لتسوية صفقتها — تُحجز لقرار الإدارة ولا تُقيَّد.
 *
 * الردّ قرار بشري: المال وصل فعلًا، فإسقاطه صمتًا يضيّعه، وتسويته على صفقة
 * لا تقبلها يُفسد الدفتر.
 */
async function holdPaymentForReview(
  payment: Payment,
  reason: string,
  adminId: string | null,
): Promise<Payment> {
  const store = getStore()
  const updated = await store.updatePayment(payment.id, {
    status: 'under_review',
    failureReason: reason,
  })
  await store.appendAudit({
    actorId: adminId,
    action: 'payment.failed',
    entityType: 'payment',
    entityId: payment.id,
    beforeData: { status: payment.status },
    afterData: { status: 'under_review', reason },
  })
  return updated
}
