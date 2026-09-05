/**
 * مقاييس الحبر الفعلية لخط Arial Bold، مقيسة من `measureText` وموثّقة هنا كجدول ثابت.
 *
 * لماذا جدول ثابت لا قياس وقت التشغيل؟
 *  القياس يحتاج canvas، وهو غير متاح أثناء التصيير على الخادم، ولو قِسنا في
 *  العميل فقط لاختلف الناتج بين الخادم والعميل ووقع عدم تطابق في الترطيب.
 *  الجدول يجعل التخطيط حتميًا في الجهتين.
 *
 * القيم نِسب من حجم الخط (em):
 *  `asc`  ارتفاع الحبر فوق خطّ القاعدة.
 *  `desc` امتداد الحبر تحت خطّ القاعدة (سالب يعني أن الحبر ينتهي فوق القاعدة).
 *
 * ملاحظة جوهرية: الأرقام العربية الشرقية أقصر بكثير من اللاتينية
 * (0.58em مقابل 0.73em)، وحرف «أ» أطول من أي حرف لاتيني (0.876em مقابل 0.728em).
 * لهذا لا يصحّ توحيد الأحجام بمعامل واحد — التخطيط يقاس بالحبر لا بحجم الخط.
 */
export type InkMetrics = { asc: number; desc: number }

/** الحروف السبعة عشر المعتمدة في لوحات المركبات السعودية. */
export const ARABIC_LETTER_INK: Record<string, InkMetrics> = {
  أ: { asc: 0.876, desc: -0.1094 },
  ب: { asc: 0.4893, desc: 0.0693 },
  ح: { asc: 0.5273, desc: 0.2031 },
  د: { asc: 0.6045, desc: -0.1431 },
  ر: { asc: 0.4609, desc: 0.0723 },
  س: { asc: 0.458, desc: 0.0635 },
  ص: { asc: 0.5039, desc: 0.0635 },
  ط: { asc: 0.8125, desc: -0.1431 },
  ع: { asc: 0.5947, desc: 0.2041 },
  ق: { asc: 0.6582, desc: 0.1299 },
  ك: { asc: 0.7744, desc: -0.1431 },
  ل: { asc: 0.7734, desc: 0.0361 },
  م: { asc: 0.4307, desc: 0.2119 },
  ن: { asc: 0.6118, desc: 0.0635 },
  ه: { asc: 0.5186, desc: -0.126 },
  و: { asc: 0.4844, desc: 0.0713 },
  ي: { asc: 0.4614, desc: 0.1943 },
}

export const ARABIC_DIGIT_INK: InkMetrics = { asc: 0.7236, desc: -0.1431 }
export const LATIN_DIGIT_INK: InkMetrics = { asc: 0.7188, desc: 0.0127 }
export const LATIN_CAP_INK: InkMetrics = { asc: 0.728, desc: 0.0127 }

/** أوسع مدى حبر يشغله نصّ — أعلى ارتفاع وأعمق نزول بين محارفه. */
export function inkOf(text: string, table: Record<string, InkMetrics>): InkMetrics {
  let asc = 0
  let desc = -1
  for (const char of Array.from(text)) {
    const metric = table[char]
    if (!metric) continue
    asc = Math.max(asc, metric.asc)
    desc = Math.max(desc, metric.desc)
  }
  // نصّ بلا محارف معروفة: نفترض أوسع الحدود حتى لا يتجاوز الإطار أبدًا
  if (desc === -1) return { asc: 0.876, desc: 0.2119 }
  return { asc, desc }
}

export type RowItem = {
  /** أكبر حجم خط تسمح به المساحة الأفقية */
  widthLimit: number
  ink: InkMetrics
}

export type RowLayout = {
  /** خطّ قاعدة مشترك لكل عناصر الصفّ */
  baseline: number
  /** حجم الخط النهائي لكل عنصر، بالترتيب نفسه */
  sizes: number[]
}

export type RowOptions = {
  /**
   * يُوسّط حبر الصفّ في شريطه بدل تثبيت قاعدته في أسفله.
   *
   * القاعدة الثابتة تلزم حيث يتجاور صفّان: العربيّ فوق واللاتينيّ تحت، ولو
   * تحرّك أحدهما بحجم حروفه اختلّ ما بينهما. أمّا الصفّ الوحيد — الرياضية —
   * فلا جار له يُحاذيه، وحجمه يحدّه العرض لا الارتفاع، فيخرج أقصر من شريطه
   * ويتجمّع الفائض كلّه فوقه هامشًا. والتوسيط يقسم الفائض نصفين.
   */
  center?: boolean
}

/**
 * نصيب ما فوق خطّ القاعدة من ارتفاع الشريط، لكل صفّ حسب حاجته الحقيقية.
 *
 * الصفّ العربي ينزل تحت القاعدة حتى 0.212em (حرف «م»)، فيحتاج نصيبًا للنزول.
 * الصفّ اللاتيني لا ينزل عمليًا (0.0127em)، فلو أعطيناه النصيب نفسه ضاع خُمس
 * الشريط فارغًا وبدا المحتوى منزاحًا لأعلى — وهو ما حدث فعلًا في أول محاولة.
 */
export const ARABIC_ASCENT_SHARE = 0.805
export const LATIN_ASCENT_SHARE = 0.983

/**
 * يوزّع عناصر صفّ داخل شريط رأسي بحيث لا يلامس أي حبر حوافّ اللوحة.
 *
 * خطّ القاعدة ثابت داخل الشريط — لا يتبع أطول عنصر — حتى تستقرّ الصفوف في
 * الموضع نفسه مهما اختلف عدد الحروف بين لوحة وأخرى. وحجم كل عنصر يُقيَّد
 * بنصيبه من الشريط حسب مقاييسه، فيتساوى ارتفاع الحبر المرئي بين العربي
 * واللاتيني كما تبدو اللوحة الحقيقية.
 */
export function layoutRow(
  items: RowItem[],
  bandTop: number,
  bandHeight: number,
  ascentShare: number,
  options: RowOptions = {},
): RowLayout {
  const ascBudget = bandHeight * ascentShare
  const descBudget = bandHeight - ascBudget

  const sizes = items.map((item) => {
    const byAscent = ascBudget / Math.max(item.ink.asc, 0.001)
    const byDescent = item.ink.desc > 0 ? descBudget / item.ink.desc : Number.POSITIVE_INFINITY
    return Math.min(item.widthLimit, byAscent, byDescent)
  })

  if (!options.center) return { baseline: bandTop + ascBudget, sizes }

  /*
   * التوسيط يقيس الحبر الخارج لا الميزانية المرصودة.
   *
   * القاعدة تُحسب بعد أن استقرّت الأحجام: أعلى صعودٍ بينها وأعمق نزول هما
   * علوّ الكتلة الحقيقيّ، فتُنزَل في وسط الشريط. والقاعدة تبقى واحدة لكل
   * العناصر — لو وُسّط كلٌّ على حدة لتفاوتت قواعد الأرقام والحروف في الصفّ.
   */
  const inkAbove = Math.max(...items.map((item, index) => item.ink.asc * sizes[index]))
  const inkBelow = Math.max(...items.map((item, index) => item.ink.desc * sizes[index]))
  const slack = bandHeight - (inkAbove + inkBelow)
  return { baseline: bandTop + slack / 2 + inkAbove, sizes }
}
