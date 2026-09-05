/**
 * الأرقام المرجعية — `U26-00001`.
 *
 * رقمٌ يُملى في مكالمة ويُكتب في رسالة دعم ويُقرأ عن شاشة. المعرّف الداخلي
 * (`usr_9f2c…`) لا يصلح لشيء من ذلك، فلكل كيان **معرّفان**: داخليّ للنظام،
 * ومرجعيّ للإنسان.
 *
 * البنية: `[حرف النوع][سنتان][-][تسلسل من خمس خانات]`
 *
 * ```
 *   U 26 - 00001
 *   │  │      └── تسلسل داخل السنة، يبدأ من 1
 *   │  └───────── السنة الميلادية بخانتين
 *   └──────────── نوع الكيان
 * ```
 */

export type ReferenceKind =
  | 'user'
  | 'listing'
  | 'order'
  | 'payment'
  | 'deposit'
  | 'wallet'
  | 'revenue'
  | 'disbursement'
  | 'invoice'

/**
 * حرف لكل نوع.
 *
 * **`O` و`I` ممنوعتان عمدًا**: تُقرآن صفرًا وواحدًا عند الإملاء والكتابة، فرقمٌ
 * يُملى بهما يُدخَل خطأً. ولذلك «صفقة» حرفها `S` لا `O`، و«فاتورة» لا تأخذ `I`.
 */
export const REFERENCE_PREFIX: Record<ReferenceKind, string> = {
  user: 'U',
  listing: 'L',
  order: 'S',
  payment: 'P',
  deposit: 'D',
  wallet: 'W',
  revenue: 'R',
  disbursement: 'F',
  invoice: 'T',
}

export const REFERENCE_LABELS: Record<ReferenceKind, string> = {
  user: 'رقم العضوية',
  listing: 'رقم الإعلان',
  order: 'رقم الصفقة',
  payment: 'رقم العملية',
  deposit: 'رقم العربون',
  wallet: 'رقم الحركة',
  revenue: 'رقم القيد',
  disbursement: 'رقم أمر الصرف',
  invoice: 'رقم الفاتورة',
}

const KIND_BY_PREFIX = new Map(
  Object.entries(REFERENCE_PREFIX).map(([kind, prefix]) => [prefix, kind as ReferenceKind]),
)

/** أقلّ عدد خانات للتسلسل — يزيد وحده عند تجاوز 99,999 في سنة واحدة. */
const SEQUENCE_DIGITS = 5

/** السنة الميلادية بخانتين من وقت الإنشاء. */
export function referenceYear(at: number | string | Date): number {
  const date = at instanceof Date ? at : new Date(at)
  return date.getUTCFullYear() % 100
}

/**
 * يبني الرقم المرجعي.
 *
 * التسلسل يُحشى بالأصفار إلى خمس خانات، فإن تجاوز 99,999 في سنة واحدة **امتدّ
 * ولم يلتفّ**: `L26-100000` أطول لكنه صحيح، والالتفاف يمنح رقمًا مستعملًا
 * لكيان آخر.
 */
export function buildReference(kind: ReferenceKind, year: number, sequence: number): string {
  const yy = String(Math.abs(year) % 100).padStart(2, '0')
  const seq = String(Math.max(1, Math.trunc(sequence))).padStart(SEQUENCE_DIGITS, '0')
  return `${REFERENCE_PREFIX[kind]}${yy}-${seq}`
}

export type ParsedReference = {
  kind: ReferenceKind
  year: number
  sequence: number
  /** الشكل المعياري — للمقارنة والبحث */
  canonical: string
}

const ARABIC_INDIC = /[٠-٩۰-۹]/g

/** يحوّل الأرقام العربية والفارسية إلى غربية قبل التحليل. */
function westernize(input: string): string {
  return input.replace(ARABIC_INDIC, (digit) => {
    const code = digit.charCodeAt(0)
    const base = code >= 0x06f0 ? 0x06f0 : 0x0660
    return String(code - base)
  })
}

/**
 * يقرأ رقمًا مرجعيًا من إدخال المستخدم.
 *
 * متسامح عمدًا مع ما يختلف فيه الناس ولا يغيّر المعنى: الشرطة اختيارية،
 * والحروف بأي حالة، والمسافات مُهمَلة، والأرقام العربية مقبولة. ومتشدّد فيما
 * يغيّره: حرف نوع غير معروف أو تسلسل مفقود يُرفض.
 */
export function parseReference(input: string): ParsedReference | null {
  const cleaned = westernize(input).trim().replace(/[\s‏‎]/g, '').toUpperCase()
  const match = cleaned.match(/^([A-Z])(\d{2})-?(\d{1,9})$/)
  if (!match) return null

  const kind = KIND_BY_PREFIX.get(match[1])
  if (!kind) return null

  const sequence = Number(match[3])
  if (sequence <= 0) return null

  const year = Number(match[2])
  return { kind, year, sequence, canonical: buildReference(kind, year, sequence) }
}

/** هل النصّ رقم مرجعي من هذا النوع؟ — للبحث في جدول نوعه معروف. */
export function matchesReference(value: string, query: string): boolean {
  const parsed = parseReference(query)
  return parsed !== null && parsed.canonical === value
}

/**
 * مسار معرض البائع.
 *
 * `@` ما دام له معرّف علنيّ، و`/u/<id>` وإلّا. وتُبنى في موضعٍ واحد كي لا
 * يفترق ما يُنسخ عمّا يُربَط: رابطٌ يعرضه الحساب ورابطٌ آخر يعود إليه الزائر
 * يجعلان الصفحة تبدو صفحتين.
 */
export function showcasePath(idOrHandle: string): string {
  // المعرّف الداخليّ وحده يبدأ بـ`usr_` — وما عداه معرّفٌ اختاره صاحبه
  return idOrHandle.startsWith('usr_') ? `/u/${idOrHandle}` : `/@${idOrHandle}`
}
