/**
 * تُخزَّن جميع المبالغ داخليًا كأعداد صحيحة من الهللات (1 ريال = 100 هللة)
 * لتجنّب أخطاء الفاصلة العائمة. عند الحفظ في PostgreSQL تُحوَّل إلى numeric(14,2).
 */

export type Halalas = number

export const HALALAS_PER_RIYAL = 100

export function riyalsToHalalas(riyals: number): Halalas {
  return Math.round(riyals * HALALAS_PER_RIYAL)
}

export function halalasToRiyals(halalas: Halalas): number {
  return halalas / HALALAS_PER_RIYAL
}

/** يحوّل من تمثيل numeric النصي في قاعدة البيانات إلى هللات. */
export function numericToHalalas(value: string | number | null | undefined): Halalas {
  if (value === null || value === undefined) return 0
  const asNumber = typeof value === 'number' ? value : Number.parseFloat(value)
  if (!Number.isFinite(asNumber)) return 0
  return Math.round(asNumber * HALALAS_PER_RIYAL)
}

/** يحوّل من هللات إلى نص numeric(14,2) لقاعدة البيانات. */
export function halalasToNumeric(halalas: Halalas): string {
  return (halalas / HALALAS_PER_RIYAL).toFixed(2)
}

const GROUPER = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

/**
 * تنسيق المبلغ بالأرقام العربية الغربية مع فواصل الآلاف — مثل `25,500`.
 * يُستخدم في كل الواجهات لضمان وضوح القراءة داخل البث.
 */
export function formatAmount(halalas: Halalas): string {
  return GROUPER.format(halalasToRiyals(halalas))
}

/**
 * يردّ الأرقام العربية والفارسية إلى غربية، ويُسقط الفواصل والمسافات.
 *
 * لوحة المفاتيح العربية تكتب «١٢٣٤» ولوحة المنصّة تعرض «1,234»، وكلاهما يصل
 * الحقل نفسه. والفصل بين التحويل والتحقّق يجعل الحقل يُنسّق ما يُكتب حرفًا
 * حرفًا لا عند اكتماله وحده.
 */
export function toWesternDigits(input: string): string {
  return Array.from(input ?? '')
    .map((c) => {
      const code = c.codePointAt(0) ?? 0
      if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660)
      if (code >= 0x06f0 && code <= 0x06f9) return String(code - 0x06f0)
      return c
    })
    .join('')
    .replace(/[,\s٬]/g, '')
    .trim()
}

/** تحويل نص يدخله المستخدم (قد يحوي فواصل أو أرقامًا عربية) إلى هللات. */
export function parseAmountInput(input: string): Halalas | null {
  const western = toWesternDigits(input)
  if (!western || !/^\d+(\.\d{1,2})?$/.test(western)) return null
  return riyalsToHalalas(Number.parseFloat(western))
}

const WHOLE_GROUPER = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/**
 * يُنسّق ما يُكتب في حقل مبلغ **أثناء الكتابة** لا بعد اكتماله.
 *
 * الفاصلة تُدخَل مع الرقم الرابع فيُقرأ «1,000,000» ولا يُعدّ بالأصابع. وهي
 * حالةٌ لا يكفيها `parseAmountInput`: هو يرفض «12.» وهي خطوةٌ لازمة في طريق
 * «12.5»، فلو رُفضت لتعذّر إدخال الكسر أصلًا.
 *
 * يردّ `null` لما ليس رقمًا — فيُترك الحقل على آخر نصٍّ صحيح ولا يُمحى ما كُتب.
 */
export function groupAmountInput(raw: string): { text: string; halalas: Halalas | null } | null {
  const western = toWesternDigits(raw)
  if (western === '') return { text: '', halalas: null }
  if (!/^\d*(\.\d{0,2})?$/.test(western)) return null
  const [whole, fraction] = western.split('.')
  const grouped = whole === '' ? '' : WHOLE_GROUPER.format(Number(whole))
  return {
    text: fraction === undefined ? grouped : `${grouped}.${fraction}`,
    halalas: parseAmountInput(western),
  }
}

const INVOICE_GROUPER = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * المبلغ في الفاتورة الضريبية — بفواصل الآلاف و**رقمين بعد الفاصلة دائمًا**.
 *
 * `formatAmount` يُسقط الكسر الصفري فيكتب «550» و«82.5»؛ وفاتورةٌ تخلط
 * الصيغتين في عمود واحد تُقرأ بعناء، والهيئة تقرأ الكسر خانتين.
 */
export function formatInvoiceAmount(halalas: Halalas): string {
  return INVOICE_GROUPER.format(halalasToRiyals(halalas))
}
