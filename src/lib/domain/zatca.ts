/**
 * الفوترة الإلكترونية — متطلّبات هيئة الزكاة والضريبة والجمارك (ZATCA).
 *
 * ما تبيعه المنصّة ليس اللوحة: اللوحة تنتقل بين طرفين عبر القنوات الرسمية،
 * والمنصّة تبيع **وساطتها**. فالتوريد الخاضع للضريبة هو العمولة وحدها،
 * والفاتورة تُصدَر بها لا بقيمة الصفقة — وهذا ما يمنع تحصيل ضريبة على مالٍ
 * لم تقبضه المنصّة أصلًا.
 *
 * ولكل طرف فاتورته: عمولة المشتري تُفوتر له عند وصول ماله، وعمولة البائع
 * تُفوتر له لحظة تحويل عائده. وكلتاهما **فاتورة ضريبية مبسّطة** (B2C) لأن
 * الطرف مستهلك نهائي لا منشأة مسجّلة.
 *
 * ## ما يغطّيه هذا الملفّ
 *
 * **المرحلة الأولى (الإصدار)**: الحقول الإلزامية، ورمز QR بترميز TLV/base64
 * بوسومه الخمسة، وسلسلة تجزئة تربط كل فاتورة بسابقتها فلا تُحذف واحدة من
 * الوسط بلا أثر.
 *
 * **المرحلة الثانية (الربط والتكامل)** تحتاج شهادة تشفير (CSID) من الهيئة
 * وختمًا مُعتمدًا على XML بصيغة UBL 2.1 وربطًا مباشرًا بمنصّة «فاتورة».
 * وهذا الملفّ يبني الحقول كلّها بالشكل الذي تتطلّبه، فيبقى الناقص **اعتماد
 * المنشأة** لا إعادة بناء الفواتير.
 */

import { halalasToRiyals, type Halalas } from './money'

/** وسوم TLV الخمسة في رمز QR — بترتيبها المُلزِم. */
export const ZATCA_QR_TAGS = {
  sellerName: 1,
  vatNumber: 2,
  timestamp: 3,
  total: 4,
  vatTotal: 5,
} as const

export type ZatcaQrPayload = {
  /** الاسم النظامي للمنشأة كما في السجل الضريبي */
  sellerName: string
  /** الرقم الضريبي — خمس عشرة خانة */
  vatNumber: string
  /** وقت الإصدار بصيغة ISO 8601 */
  issuedAt: string
  /** الإجمالي شاملًا الضريبة */
  total: Halalas
  /** مجموع ضريبة القيمة المضافة */
  vatTotal: Halalas
}

/**
 * المبلغ في الفاتورة الضريبية: رقمان بعد الفاصلة دائمًا.
 *
 * لا `formatAmount`: ذاك ينسّق للعرض بفواصل آلاف ويُسقط الكسر الصفري،
 * و«1,000» في رمز QR قيمة أخرى غير «1000.00» عند من يقرؤه آليًّا.
 */
export function invoiceAmount(halalas: Halalas): string {
  return halalasToRiyals(halalas).toFixed(2)
}

const utf8 = new TextEncoder()

/**
 * يبني قيمة رمز QR.
 *
 * كل وسم ثلاثة أجزاء: رقمه بايتًا، ثم **طول قيمته بالبايتات** بايتًا، ثم
 * القيمة. والطول بالبايتات لا بالمحارف: «سوق اللوحات» أحد عشر محرفًا وواحد
 * وعشرون بايتًا في UTF-8، وقارئ الرمز يعدّ البايتات.
 */
export function encodeZatcaQr(payload: ZatcaQrPayload): string {
  const fields: [number, string][] = [
    [ZATCA_QR_TAGS.sellerName, payload.sellerName],
    [ZATCA_QR_TAGS.vatNumber, payload.vatNumber],
    [ZATCA_QR_TAGS.timestamp, payload.issuedAt],
    [ZATCA_QR_TAGS.total, invoiceAmount(payload.total)],
    [ZATCA_QR_TAGS.vatTotal, invoiceAmount(payload.vatTotal)],
  ]

  const bytes: number[] = []
  for (const [tag, value] of fields) {
    const encoded = utf8.encode(value)
    // 255 بايتًا حدّ خانة الطول الواحدة — واسم منشأة يتجاوزها يُقصّ ولا يفسد الرمز
    const trimmed = encoded.length > 255 ? encoded.slice(0, 255) : encoded
    bytes.push(tag, trimmed.length, ...trimmed)
  }
  return toBase64(Uint8Array.from(bytes))
}

/** يقرأ ما بناه `encodeZatcaQr` — للتحقّق وللاختبار. */
export function decodeZatcaQr(value: string): Record<number, string> | null {
  let bytes: Uint8Array
  try {
    bytes = fromBase64(value)
  } catch {
    return null
  }

  const decoder = new TextDecoder()
  const out: Record<number, string> = {}
  let at = 0
  while (at < bytes.length) {
    const tag = bytes[at]
    const length = bytes[at + 1]
    if (length === undefined || at + 2 + length > bytes.length) return null
    out[tag] = decoder.decode(bytes.slice(at + 2, at + 2 + length))
    at += 2 + length
  }
  // حمولةٌ بلا وسم واحد ليست حمولة صالحة — تُردّ ولا تُقرأ فارغةً
  return Object.keys(out).length > 0 ? out : null
}

/**
 * الرقم الضريبي السعودي.
 *
 * خمس عشرة خانة، أوّلها وآخرها `3`، والخانة الحادية عشرة `1` لنوع المنشأة.
 * ورقمٌ مختلّ في الفاتورة يجعلها غير مقبولة، فيُتحقّق منه **قبل** الإصدار لا
 * بعد أن تُسلَّم للعميل.
 */
export function isValidVatNumber(value: string): boolean {
  const digits = value.trim()
  if (!/^\d{15}$/.test(digits)) return false
  return digits.startsWith('3') && digits.endsWith('3') && digits[10] === '1'
}

/** الرقم الموحّد للمنشأة (700) أو السجل التجاري — عشر خانات. */
export function isValidCrNumber(value: string): boolean {
  return /^\d{10}$/.test(value.trim())
}

/**
 * النصّ الذي تُحسب عليه تجزئة الفاتورة.
 *
 * ثابت الترتيب ومفصول بمحرف لا يرد في أي حقل، فلا يُنتج حقلان مختلفان النصَّ
 * نفسه: «أ|ب» و«أب|» لا يلتبسان.
 */
export function invoiceDigestInput(input: {
  reference: string
  uuid: string
  issuedAt: string
  vatNumber: string
  netAmount: Halalas
  vatAmount: Halalas
  totalAmount: Halalas
  customerReference: string
  previousHash: string
}): string {
  return [
    input.reference,
    input.uuid,
    input.issuedAt,
    input.vatNumber,
    invoiceAmount(input.netAmount),
    invoiceAmount(input.vatAmount),
    invoiceAmount(input.totalAmount),
    input.customerReference,
    input.previousHash,
  ].join('')
}

/**
 * تجزئة الفاتورة **الأولى** في السلسلة.
 *
 * الهيئة تبدأ السلسلة بتجزئة النصّ `"0"`، فأوّل فاتورة تشير إلى قيمة معروفة
 * لا إلى فراغ — وفرقُ ما بينهما أن الفراغ يقبل الحذف بلا كشف.
 */
export const ZATCA_GENESIS_INPUT = '0'

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** ترميز base64 من بايتات — بلا `Buffer` ولا `btoa`، فيعمل في الخادم والمتصفّح. */
export function toBase64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]
    const b = bytes[i + 1]
    const c = bytes[i + 2]
    out += BASE64[a >> 2]
    out += BASE64[((a & 3) << 4) | ((b ?? 0) >> 4)]
    out += b === undefined ? '=' : BASE64[((b & 15) << 2) | ((c ?? 0) >> 6)]
    out += c === undefined ? '=' : BASE64[c & 63]
  }
  return out
}

/**
 * فكّ base64.
 *
 * حشو `=` يُسقَط بالتنظيف، وعددُ المحارف الباقية في المجموعة الأخيرة هو ما
 * يحدّد عدد بايتاتها: محرفان بايتٌ واحد، وثلاثة بايتان، وأربعة ثلاثة. ولا
 * يُقصّ شيء بعد ذلك — قصُّ الحشو مرّتين يأكل بايتًا صحيحًا.
 */
export function fromBase64(value: string): Uint8Array {
  const clean = value.replace(/[^A-Za-z0-9+/]/g, '')
  const bytes: number[] = []
  for (let i = 0; i < clean.length; i += 4) {
    const chunk = [0, 1, 2, 3].map((k) => Math.max(0, BASE64.indexOf(clean[i + k] ?? 'A')))
    bytes.push((chunk[0] << 2) | (chunk[1] >> 4))
    if (clean[i + 2] !== undefined) bytes.push(((chunk[1] & 15) << 4) | (chunk[2] >> 2))
    if (clean[i + 3] !== undefined) bytes.push(((chunk[2] & 3) << 6) | chunk[3])
  }
  return Uint8Array.from(bytes)
}
