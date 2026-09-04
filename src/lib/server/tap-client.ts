/**
 * عميل بوابة الدفع Tap.
 *
 * https://developers.tap.company/reference/api-endpoint
 *
 * **المفاتيح السرّية من متغيّرات البيئة وحدها**، ولا تُخزَّن في قاعدة البيانات
 * ولا تُرسل إلى العميل ولا تُسجَّل في أي مخرج. الأدمن يختار **البيئة** العاملة
 * (تجريبية أو حقيقية) لا المفتاح، فيبقى المفتاح ملك بيئة التشغيل وحدها.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import { halalasToNumeric, type Halalas } from '@/lib/domain/money'
import type { TapMode } from '@/lib/domain/types'

const TAP_API = 'https://api.tap.company/v2'

/** عملة المنصّة — ريال سعودي بخانتين عشريتين. */
const CURRENCY = 'SAR'

export class TapError extends Error {
  readonly isTapError = true as const
  readonly code: string
  constructor(message: string, code = 'TAP_ERROR') {
    super(message)
    this.name = 'TapError'
    this.code = code
  }
}

export function isTapError(error: unknown): error is TapError {
  return typeof error === 'object' && error !== null && (error as TapError).isTapError === true
}

/** المفتاح السرّي للبيئة المطلوبة، أو `null` إن لم يُضبط. */
export function tapSecretKey(mode: TapMode): string | null {
  const key = mode === 'live' ? process.env.TAP_LIVE_SECRET_KEY : process.env.TAP_TEST_SECRET_KEY
  return key && key.trim().length > 0 ? key.trim() : null
}

/** هل البيئة مهيّأة بمفتاح صالح؟ تُستعمل لعرض حالة التهيئة في لوحة الإدارة. */
export function isTapConfigured(mode: TapMode): boolean {
  return tapSecretKey(mode) !== null
}

function requireKey(mode: TapMode): string {
  const key = tapSecretKey(mode)
  if (!key) {
    throw new TapError(
      `مفتاح Tap للبيئة ${mode === 'live' ? 'الحقيقية' : 'التجريبية'} غير مضبوط في متغيّرات البيئة.`,
      'TAP_NOT_CONFIGURED',
    )
  }
  return key
}

type TapCharge = {
  id: string
  status: string
  amount?: number
  currency?: string
  transaction?: { url?: string }
  reference?: { transaction?: string; order?: string }
  metadata?: Record<string, string>
  response?: { code?: string; message?: string }
}

async function tapRequest<T>(
  mode: TapMode,
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown },
): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${TAP_API}${path}`, {
      method: init.method,
      headers: {
        authorization: `Bearer ${requireKey(mode)}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      // البوابة قد تتأخّر؛ لا نُبقي طلب المستخدم معلّقًا إلى الأبد
      signal: AbortSignal.timeout(20_000),
    })
  } catch (error) {
    if (isTapError(error)) throw error
    throw new TapError('تعذّر الاتصال ببوابة الدفع، حاول بعد قليل.', 'TAP_UNREACHABLE')
  }

  const text = await response.text()
  let data: unknown
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    throw new TapError('ردّ غير مفهوم من بوابة الدفع.', 'TAP_BAD_RESPONSE')
  }

  if (!response.ok) {
    // نعرض رسالة البوابة إن كانت مفهومة، ولا نسرّب المفتاح ولا الطلب كاملًا
    const errors = (data as { errors?: { description?: string }[] })?.errors
    const description = errors?.[0]?.description
    throw new TapError(description ?? 'رفضت بوابة الدفع العملية.', 'TAP_REJECTED')
  }
  return data as T
}

export type CreateChargeInput = {
  mode: TapMode
  amount: Halalas
  /** مرجعنا الداخلي — يعود إلينا في الردّ وفي الويبهوك */
  reference: string
  customer: { name: string; email: string }
  description: string
  /** يعود إليه المستخدم بعد إتمام الدفع */
  redirectUrl: string
  /** يستدعيه Tap من خادم إلى خادم */
  webhookUrl: string
}

export type CreatedCharge = { id: string; status: string; redirectUrl: string }

/**
 * ينشئ عملية دفع ويعيد رابط صفحة الدفع المستضافة.
 *
 * `source.id = 'src_all'` يفتح صفحة Tap بكل وسائل الدفع المفعّلة للتاجر،
 * فلا نتعامل مع بيانات البطاقات إطلاقًا ولا تمرّ بخوادمنا.
 */
export async function createCharge(input: CreateChargeInput): Promise<CreatedCharge> {
  const [firstName, ...rest] = input.customer.name.trim().split(/\s+/)

  const charge = await tapRequest<TapCharge>(input.mode, '/charges', {
    method: 'POST',
    body: {
      amount: Number(halalasToNumeric(input.amount)),
      currency: CURRENCY,
      customer_initiated: true,
      threeDSecure: true,
      save_card: false,
      description: input.description,
      reference: { transaction: input.reference, order: input.reference },
      metadata: { reference: input.reference },
      receipt: { email: false, sms: false },
      customer: {
        first_name: firstName || 'مستخدم',
        last_name: rest.join(' ') || undefined,
        email: input.customer.email,
      },
      source: { id: 'src_all' },
      post: { url: input.webhookUrl },
      redirect: { url: input.redirectUrl },
    },
  })

  const redirectUrl = charge.transaction?.url
  if (!redirectUrl) {
    throw new TapError('لم تُعِد بوابة الدفع رابط الدفع.', 'TAP_NO_REDIRECT')
  }
  return { id: charge.id, status: charge.status, redirectUrl }
}

export type RetrievedCharge = {
  id: string
  status: string
  amount: number | null
  reference: string | null
}

/** يقرأ حالة عملية دفع — مصدر الحقيقة عند عودة المستخدم أو وصول ويبهوك. */
export async function retrieveCharge(mode: TapMode, chargeId: string): Promise<RetrievedCharge> {
  const charge = await tapRequest<TapCharge>(mode, `/charges/${encodeURIComponent(chargeId)}`, {
    method: 'GET',
  })
  return {
    id: charge.id,
    status: charge.status,
    amount: typeof charge.amount === 'number' ? charge.amount : null,
    reference: charge.reference?.transaction ?? charge.metadata?.reference ?? null,
  }
}

/** حالات Tap التي تعني نجاح التحصيل. */
const SUCCESS_STATUSES = new Set(['CAPTURED', 'SUCCESS'])
/** حالات ما زالت جارية — لا نحكم عليها بفشل. */
const PENDING_STATUSES = new Set(['INITIATED', 'PENDING', 'IN_PROGRESS'])

export type ChargeOutcome = 'paid' | 'pending' | 'failed'

/** يترجم حالة Tap إلى نتيجة نهائية نتعامل معها. */
export function chargeOutcome(status: string): ChargeOutcome {
  const normalized = status?.toUpperCase?.() ?? ''
  if (SUCCESS_STATUSES.has(normalized)) return 'paid'
  if (PENDING_STATUSES.has(normalized)) return 'pending'
  return 'failed'
}

/**
 * يتحقّق من توقيع الويبهوك.
 *
 * Tap يرسل ترويسة `hashstring` = HMAC-SHA256 بالمفتاح السرّي على سلسلة
 * الحقول مرتّبة بهذا الشكل بالضبط:
 *   x_id{id}x_amount{amount}x_currency{currency}
 *   x_gateway_reference{ref}x_payment_reference{ref}x_status{status}x_created{created}
 *
 * بلا هذا التحقّق يستطيع أي طرف إرسال «تم الدفع» إلى مسارنا فيشحن رصيده مجانًا.
 */
export function verifyWebhookSignature(
  mode: TapMode,
  payload: {
    id?: string
    amount?: number | string
    currency?: string
    reference?: { gateway?: string; payment?: string }
    status?: string
    transaction?: { created?: string | number }
  },
  hashString: string | null,
): boolean {
  if (!hashString) return false
  const key = tapSecretKey(mode)
  if (!key) return false

  // المبلغ يُقارن بعدد خاناته العشرية حسب العملة — الريال بخانتين
  const amount = Number(payload.amount ?? 0).toFixed(2)
  const source =
    `x_id${payload.id ?? ''}` +
    `x_amount${amount}` +
    `x_currency${payload.currency ?? ''}` +
    `x_gateway_reference${payload.reference?.gateway ?? ''}` +
    `x_payment_reference${payload.reference?.payment ?? ''}` +
    `x_status${payload.status ?? ''}` +
    `x_created${payload.transaction?.created ?? ''}`

  const expected = createHmac('sha256', key).update(source).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(hashString)
  // مقارنة ثابتة الزمن: مقارنة نصية عادية تسرّب التوقيع حرفًا حرفًا
  return a.length === b.length && timingSafeEqual(a, b)
}
