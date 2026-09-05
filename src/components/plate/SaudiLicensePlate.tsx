import { cn } from '@/lib/utils'
import type { PlateEmblem, PlateSize, PlateType, PlateFormat } from '@/lib/domain/types'
import { toArabicIndicDigits } from '@/lib/saudi-plate-mapping'
import { EMBLEM_ART, EmblemShapes, STRIP_SYMBOL } from './EmblemGraphic'
import {
  ARABIC_DIGIT_INK,
  ARABIC_LETTER_INK,
  LATIN_CAP_INK,
  LATIN_DIGIT_INK,
  inkOf,
  layoutRow,
} from './arial-metrics'

export type SaudiLicensePlateProps = {
  plateType?: PlateType
  /** نوع الإصدار — الطويلة افتراضًا لما لم يُحدَّد */
  plateFormat?: PlateFormat
  arabicLetters: string
  latinLetters: string
  /** الأرقام الغربية — تُشتق منها الأرقام العربية تلقائيًا */
  plateNumbers?: string
  arabicNumbers?: string
  latinNumbers?: string
  emblem?: PlateEmblem
  customEmblemUrl?: string | null
  size?: PlateSize
  animated?: boolean
  showReflection?: boolean
  className?: string
  /** الجهة التي يظهر فيها شريط KSA */
  stripSide?: 'right' | 'left'
  title?: string
}

/** أبعاد الحاوية لكل حجم — النسبة محفوظة دائمًا عبر viewBox الخاص بـ SVG. */
// اللوحة الطويلة مسطّحة (نحو 4.6:1)، فتحتاج عرضًا أكبر لتبقى مقروءة
const SIZE_CLASS: Record<PlateSize, string> = {
  thumbnail: 'w-[190px]',
  card: 'w-[340px]',
  stage: 'w-[760px] max-w-full',
  fullscreen: 'w-full',
  // تملأ حاويتها بالكامل، وSVG يتوسّط نفسه داخلها بنسبته المحفوظة
  fill: 'h-full w-full',
}

function stableUid(parts: string[]): string {
  const source = parts.join('|')
  let hash = 5381
  for (let i = 0; i < source.length; i++) hash = ((hash << 5) + hash + source.charCodeAt(i)) >>> 0
  return `plt${hash.toString(36)}`
}

/** يفصل الحروف العربية بفاصل عدم اتصال حتى تظهر بأشكالها المنفصلة كما على اللوحة. */
function isolateArabic(letters: string): string {
  return Array.from(letters).join('\u200c ')
}

/**
 * حجمٌ واحد للحرف والرقم، ولا يصغر إلّا إذا ضاق به عرضه.
 *
 * كانت الأحجام سلالمَ حسب عدد المحارف: حرفٌ واحد يأخذ الأساس كاملًا، وثلاثةٌ
 * تأخذ ٦٠٪ منه. فتخرج لوحةُ «A» بحرفٍ ضخم ولوحةُ «NTU» بحروفٍ صغيرة، ويختلف
 * الرقم عن الحرف في اللوحة الواحدة — وهو ما لا يقع في المصنوعة: مقاس الحرف
 * فيها ثابت، وإنّما تتّسع اللوحة لما تحمل.
 *
 * فصار الحجم واحدًا يُقاس، ولا يُنقص إلّا حين يتجاوز النصُّ عرض خانته. والعرض
 * يُقدَّر بمتوسّط تقدّم المحرف — لا حاجة إلى دقّةٍ أكثر، فالغرض حارسٌ لا مقياس.
 */
const ADVANCE = {
  /** أرقام لاتينية وعربية — عرضها ثابت في خطوط اللوحات */
  digits: 0.6,
  /** حروف لاتينية كبيرة بمتوسّط A–Z */
  latin: 0.72,
  /** حروف عربية معزولة، ومعها فراغ الفصل بينها */
  arabic: 0.82,
} as const

function fitFontSize(
  count: number,
  base: number,
  available: number,
  advance: number,
  spacing = 0,
): number {
  if (count <= 0) return base
  const natural = count * base * (advance + spacing)
  return natural <= available ? base : (available / natural) * base
}

/*
 * لا توجد هنا «معاملات تعويض» بعد اليوم.
 *
 * كانت اللوحة تضرب حجم الخط العربي بمعامل ثابت ليقارب اللاتيني، وتضع الصفّين
 * على خطَّي قاعدة ثابتين. وهذا يفشل حتميًا: حرف «أ» ارتفاعه 0.876em بينما
 * الحرف اللاتيني 0.728em، فمع المعامل يتجاوز الصفّ ويخرج من الإطار — وقد كان
 * يخرج فعلًا. الآن يقاس التخطيط بحبر المحارف نفسها عبر `arial-metrics`،
 * فتتساوى الارتفاعات المرئية ولا يلامس شيء الحافة.
 */

type Geometry = {
  viewBox: string
  width: number
  height: number
  frameRadius: number
  inset: number
  strip: { x: number; width: number }
  main: { x: number; width: number }
  numbers: { center: number; from: number; to: number }
  emblem: { center: number; from: number; to: number; size: number }
  letters: { center: number; from: number; to: number }
  /** شريطا الصفّين: العربي أعلى واللاتيني أسفل، بينهما فجوة */
  rows: { topBand: number; bottomBand: number; bandHeight: number }
  fonts: { numbers: number; letters: number }
  /**
   * خطوطٌ فاصلة بين الخانات — مواضع `x`.
   *
   * الطويلة بلا فواصل داخلية: الشعار الأوسط يفصل بصريًّا. والاعتيادية
   * والرياضية تُقسَّمان خاناتٍ بحدودٍ ظاهرة كما في اللوحة المصنوعة.
   */
  dividers?: number[]
  /**
   * صفٌّ واحد لاتينيّ فقط، والدولة في خانةٍ وسطى لا شريطٍ جانبيّ (الرياضية).
   */
  singleRow?: boolean
  /**
   * خاناتٌ منفصلة بأرضيّةٍ سوداء بينها — لا خطوطٌ رفيعة على وجهٍ واحد.
   *
   * الاعتيادية المصنوعة أربع لوحاتٍ صغيرة مركّبة داخل إطار: بينها فراغٌ أسود
   * ولكلٍّ حوافّها المستديرة. ورسمها بخطٍّ فاصلٍ على وجهٍ واحد يعطي شكلًا
   * آخر — أقرب إلى جدولٍ منه إلى لوحة.
   */
  cells?: { x: number; y: number; width: number; height: number }[]
  cellRadius?: number
  /**
   * كتلة الدولة — شعارٌ و«السعودية» و«KSA»، وأرضيّتها زرقاء في لوحات النقل.
   *
   * موضعها يختلف بالإصدار: وسطى في الطويلة والرياضية، وجانبيّة في الاعتيادية.
   * وشكلها يحكم ترتيب ما فيها — الضيّقة تُكدّس K S A رأسيًّا، والعريضة تكتب
   * «KSA» كلمةً واحدة.
   */
  countryBox?: { x: number; y: number; width: number; height: number }
}

/*
 * سُمك الإطار نسبةٌ من عرض اللوحة لا مقدارٌ ثابت.
 *
 * كلّ اللوحات تُعرض بعرضٍ واحد في بطاقات السوق، فالمقادير الثابتة تُكبَّر
 * بتكبير اللوحة: سبعُ وحداتٍ في الطويلة (٩٣٠) خيطٌ رفيع، وسبعٌ في الاعتيادية
 * (٤٦٠) شريطٌ عريض ضِعفَه. والنسبة تُخرجها كلَّها بسُمكٍ واحدٍ على الشاشة.
 */
const FRAME_SHARE = 7 / 930
const frameOf = (width: number) => Math.round(width * FRAME_SHARE * 10) / 10

const LONG_GEOMETRY: Geometry = {
  viewBox: '0 0 930 200',
  width: 930,
  height: 200,
  frameRadius: 20,
  inset: frameOf(930),
  strip: { x: 858, width: 65 },
  main: { x: 7, width: 851 },
  numbers: { center: 210, from: 90, to: 330 },
  emblem: { center: 460, from: 360, to: 560, size: 132 },
  letters: { center: 700, from: 600, to: 800 },
  rows: { topBand: 20, bottomBand: 100, bandHeight: 80 },
  fonts: { numbers: 96, letters: 96 },
  // وجهٌ واحد متّصل بلا خانات — الشعار الأوسط يفصل بصريًّا
  countryBox: { x: 858, y: 7, width: 65, height: 186 },
}

/**
 * الطويلة للنقل الخاصّ.
 *
 * تختلف عن أختها في بنيتها لا في لونها وحده: خاناتٌ منفصلة، والدولة كتلةٌ
 * **وسطى** زرقاء لا شريطٌ على الحافّة — كما في المصنوعة. ولا شعار أوسط فيها:
 * موضعه شغلته الدولة.
 *
 * ولذلك لا يجوز جعل الطويلة كلّها خانات: الشعار الأوسط في الخصوصية يقع في
 * موضع كتلة الدولة، فيجتمع في الوسط شعاران — والسيفان والنخلة يتكرّران إن
 * كان هو المختار.
 */
const LONG_TRANSPORT_GEOMETRY: Geometry = {
  viewBox: '0 0 930 200',
  width: 930,
  height: 200,
  frameRadius: 20,
  inset: frameOf(930),
  strip: { x: 0, width: 0 },
  main: { x: 7, width: 916 },
  numbers: { center: 199, from: 9, to: 389 },
  // لا شعار أوسط — الدولة تشغل الوسط
  emblem: { center: 466, from: 394, to: 539, size: 0 },
  letters: { center: 732, from: 544, to: 921 },
  rows: { topBand: 15, bottomBand: 108, bandHeight: 76 },
  fonts: { numbers: 96, letters: 96 },
  cellRadius: 10,
  cells: [
    { x: 9, y: 9, width: 380, height: 88 },
    { x: 544, y: 9, width: 377, height: 88 },
    { x: 9, y: 102, width: 380, height: 88 },
    { x: 544, y: 102, width: 377, height: 88 },
  ],
  countryBox: { x: 394, y: 9, width: 145, height: 181 },
}

/**
 * اللوحة الاعتيادية — مستطيلة قريبة من المربّع.
 *
 * صفّان كالطويلة، لكن بلا شعارٍ أوسط: عرضها لا يتّسع لثلاث كتل، فالشعار فيها
 * يزاحم الرقم والحرف. والدولة في شريطها الجانبيّ وحدها، وخطٌّ يفصل خانة
 * الأرقام عن خانة الحروف كما في اللوحة المصنوعة.
 */
const STANDARD_GEOMETRY: Geometry = {
  viewBox: '0 0 460 230',
  width: 460,
  height: 230,
  frameRadius: 20,
  inset: frameOf(460),
  strip: { x: 0, width: 0 },
  main: { x: 7, width: 379 },
  // خانة الأرقام أوسع من خانة الحروف — ٥٨٪ إلى ٤٢٪ كما في المصنوعة
  numbers: { center: 118, from: 9, to: 227 },
  emblem: { center: 240, from: 235, to: 245, size: 0 },
  letters: { center: 309, from: 232, to: 386 },
  rows: { topBand: 16, bottomBand: 124, bandHeight: 88 },
  fonts: { numbers: 170, letters: 170 },
  cellRadius: 10,
  cells: [
    { x: 9, y: 9, width: 218, height: 103 },
    { x: 232, y: 9, width: 154, height: 103 },
    { x: 9, y: 117, width: 218, height: 103 },
    { x: 232, y: 117, width: 154, height: 103 },
  ],
  countryBox: { x: 391, y: 9, width: 60, height: 211 },
}

/**
 * اللوحة الرياضية — صفٌّ واحد لاتينيّ.
 *
 * لا عربية فيها أصلًا: لا رقمًا ولا حرفًا. والدولة في **خانةٍ وسطى** لا في
 * شريطٍ جانبيّ — شعارٌ فوقه «السعودية» و«KSA» — فتنقسم اللوحة ثلاث خانات
 * بحدودٍ ظاهرة. ونسبتها أقصر من الطويلة: ٣٫٨ لا ٤٫٦٥.
 */
const SPORT_GEOMETRY: Geometry = {
  viewBox: '0 0 760 200',
  width: 760,
  height: 200,
  frameRadius: 20,
  inset: frameOf(760),
  strip: { x: 0, width: 0 },
  main: { x: 7, width: 746 },
  numbers: { center: 154, from: 9, to: 299 },
  /*
   * لا شعار أوسط: الدولة تشغل الوسط.
   *
   * كان بحجمٍ غير صفر، فيُرسم الشعار المختار في موضع كتلة الدولة ويجتمع
   * فيها شعاران — والسيفان والنخلة يتكرّران إن كان هو المختار. وهو ما وقع
   * في الرياضية بعد أن صُحّح في الطويلة.
   */
  emblem: { center: 369, from: 304, to: 434, size: 0 },
  letters: { center: 594, from: 439, to: 749 },
  // صفٌّ واحد يشغل الوسط
  rows: { topBand: 0, bottomBand: 35, bandHeight: 130 },
  fonts: { numbers: 152, letters: 152 },
  cellRadius: 10,
  cells: [
    { x: 9, y: 9, width: 290, height: 182 },
    { x: 439, y: 9, width: 310, height: 182 },
  ],
  countryBox: { x: 304, y: 9, width: 130, height: 182 },
  singleRow: true,
}

/**
 * لوحة الدراجة النارية.
 *
 * نسبتها 2.2:1 لا 1.43:1 — أقرب إلى اللوحة الطويلة فتستقرّ بطاقات السوق على
 * ارتفاع واحد. وبلا شعار أوسط: مساحتها الأفقية ضيّقة أصلًا، والشعار فيها يزاحم
 * الأرقام والحروف بدل أن يزيّنها.
 */
const MOTO_GEOMETRY: Geometry = {
  viewBox: '0 0 430 195',
  width: 430,
  height: 195,
  frameRadius: 16,
  inset: frameOf(430),
  strip: { x: 0, width: 0 },
  main: { x: 6, width: 348 },
  numbers: { center: 92, from: 8, to: 176 },
  // لا شعار أوسط — الحجم صفر يُسقط رسمه
  emblem: { center: 215, from: 205, to: 225, size: 0 },
  letters: { center: 265, from: 181, to: 349 },
  // الداخل 6..189 (183). شريطان بارتفاع 70 بهامش ~17 أعلى وأسفل
  rows: { topBand: 13, bottomBand: 105, bandHeight: 76 },
  fonts: { numbers: 145, letters: 145 },
  cellRadius: 8,
  cells: [
    { x: 8, y: 8, width: 168, height: 87 },
    { x: 181, y: 8, width: 168, height: 87 },
    { x: 8, y: 100, width: 168, height: 87 },
    { x: 181, y: 100, width: 168, height: 87 },
  ],
  countryBox: { x: 354, y: 8, width: 62, height: 179 },
}

/**
 * يعكس مجموعة حول محورها الرأسي — يُستخدم لإبقاء النص والشعار بالاتجاه الصحيح
 * عندما تُعكس اللوحة بأكملها لوضع الشريط في الجهة المقابلة.
 */
function Unflip({ x, active, children }: { x: number; active: boolean; children: React.ReactNode }) {
  if (!active) return <>{children}</>
  return <g transform={`translate(${x * 2} 0) scale(-1 1)`}>{children}</g>
}

/**
 * مولّد بصري للوحات المركبات السعودية.
 *
 * مرسوم بالكامل بـ SVG: الأرقام والحروف عناصر نصية حقيقية (وليست صورة ثابتة)،
 * والنِّسب محفوظة عبر viewBox فلا يحدث أي تشوّه عند تغيير الحجم.
 * التخطيط: الأرقام يمينًا… لا — الأرقام في الجهة اليسرى (عربية أعلى ولاتينية أسفل)،
 * والحروف في الجهة اليمنى، وبينهما مساحة الشعار، ثم شريط KSA الرأسي في الطرف.
 */
export function SaudiLicensePlate({
  plateType = 'private',
  plateFormat = 'long',
  arabicLetters,
  latinLetters,
  plateNumbers,
  arabicNumbers,
  latinNumbers,
  emblem = 'none',
  customEmblemUrl = null,
  size = 'card',
  animated = false,
  showReflection = true,
  className,
  stripSide = 'right',
  title,
}: SaudiLicensePlateProps) {
  const western = latinNumbers ?? plateNumbers ?? ''
  const eastern = arabicNumbers ?? toArabicIndicDigits(western)
  /*
   * الشكل من نوع الإصدار، إلا الدراجة فلها شكلها مهما كان الإصدار.
   *
   * نوع المركبة ونوع الإصدار محوران مستقلّان — لكنّ لوحة الدراجة مقاسٌ واحد
   * لا تصدر طويلةً ولا رياضية.
   */
  const geo =
    plateType === 'motorcycle'
      ? MOTO_GEOMETRY
      : plateFormat === 'standard'
        ? STANDARD_GEOMETRY
        : plateFormat === 'sport'
          ? SPORT_GEOMETRY
          : plateType === 'transport'
            ? LONG_TRANSPORT_GEOMETRY
            : LONG_GEOMETRY
  // معرّف ثابت مشتقّ من المحتوى: متطابق بين الخادم والعميل، ولا يتضارب
  // مع لوحة أخرى مختلفة المحتوى.
  const uid = stableUid([plateType, arabicLetters, latinLetters, western, emblem])

  const letterCount = Array.from(arabicLetters).length

  /*
   * العرض المتاح لكل خانة — منه يُحسب الحدّ، لا من عدد المحارف.
   *
   * و`0.86` هامشٌ داخل الخانة: الحرف لا يلامس حدّها في المصنوعة.
   */
  const numbersRoom = (geo.numbers.to - geo.numbers.from) * 0.86
  const lettersRoom = (geo.letters.to - geo.letters.from) * 0.86

  const numberWidthLimit = fitFontSize(
    western.length,
    geo.fonts.numbers,
    numbersRoom,
    ADVANCE.digits,
    0.08,
  )
  const arabicLetterWidthLimit = fitFontSize(
    letterCount,
    geo.fonts.letters,
    lettersRoom,
    ADVANCE.arabic,
  )
  const latinLetterWidthLimit = fitFontSize(
    letterCount,
    geo.fonts.letters,
    lettersRoom,
    ADVANCE.latin,
    0.1,
  )

  // ثم يقيّد الشريط الرأسي كل عنصر بحبره الحقيقي، فيتساوى الارتفاع المرئي
  const topRow = layoutRow(
    [
      { widthLimit: numberWidthLimit, ink: ARABIC_DIGIT_INK },
      { widthLimit: arabicLetterWidthLimit, ink: inkOf(arabicLetters, ARABIC_LETTER_INK) },
    ],
    geo.rows.topBand,
    geo.rows.bandHeight,
  )
  /*
   * الصفّ اللاتينيّ أصغر قليلًا من العربيّ.
   *
   * الحبران متساويان في المقياس — `0.7188` مقابل `0.7236` — فيخرجان بارتفاعٍ
   * واحد. لكنّ العين تقرأ اللاتينيّ أضخم: حروفه أعرض وأثخن، فتملأ مساحتها
   * بينما يترك العربيّ فراغًا حوله. والمعامل يردّ التوازن الذي يُرى لا الذي
   * يُقاس، ويبقى الصفّ داخل شريطه فلا يمسّ حدًّا.
   */
  const LATIN_SCALE = 0.88
  const bottomRow = layoutRow(
    [
      { widthLimit: numberWidthLimit * LATIN_SCALE, ink: LATIN_DIGIT_INK },
      { widthLimit: latinLetterWidthLimit * LATIN_SCALE, ink: LATIN_CAP_INK },
    ],
    geo.rows.bottomBand + (geo.rows.bandHeight * (1 - LATIN_SCALE)) / 2,
    geo.rows.bandHeight * LATIN_SCALE,
  )
  const [arabicNumberSize, arabicLetterSize] = topRow.sizes
  const [numberSize, latinLetterSize] = bottomRow.sizes
  // حجم صفر يعني أن هذه الهندسة بلا شعار أوسط (لوحة الدراجة)
  const showCenterEmblem = geo.emblem.size > 0
  /*
   * خلفية زرقاء لخانة الدولة في لوحات النقل.
   *
   * هي علامتها في اللوحة الحقيقية: يُعرف صنف المركبة منها قبل قراءة حرفٍ.
   * وتقع حيث تقع الدولة — شريطًا جانبيًّا في الطويلة والاعتيادية، وخانةً
   * وسطى في الرياضية — فتتبع نوع الإصدار ولا تُثبَّت في موضع.
   */
  const countryFill = plateType === 'transport' ? '#1d4ed8' : null
  /*
   * كتلة الدولة سوداء الحبر مهما تبدّلت أرضيّتها.
   *
   * «السعودية» و«KSA» على اللوحة المصنوعة سوداوان على الأزرق، فيبقيان كذلك.
   * والشعار معهما لا لأنّنا اخترنا، بل لأنّ لونه مخبوزٌ في ملفّه فلا يقلبه
   * `monochrome` — وقد كان هنا سطرٌ يَعِد ببياضٍ على الأزرق ولا يفي به.
   */
  const countryInk = '#0A0D12'
  const country = geo.countryBox ?? null
  // الضيّقة تُكدّس K S A رأسيًّا — «KSA» كلمةً واحدة لا تُقرأ في ستّين بكسلًا
  const narrowCountry = country ? country.width < country.height * 0.45 : false
  const cx = country ? country.x + country.width / 2 : 0
  /*
   * مواضع ما في كتلة الدولة — نِسبٌ من ارتفاعها.
   *
   * الضيّقة تحمل ثلاثة أشياء فوق بعضها في شريطٍ نحيل: شعارٌ ثمّ «السعودية»
   * ثمّ K S A. وكان الشعار يمسّ «السعودية» في الطويلة — يفيض على أعلاها
   * بوحدتين — لأنّ ما بينهما لم يكن مفروضًا بل ما تبقّى بعد الشعار. فصار
   * لكلٍّ موضعه، بينهما فُرجةٌ مقصودة، وما فضل من الشريط قُسم بالسويّة
   * أعلاه وأسفله. والعريضة تُبقي نسبها: شيئان لا ثلاثة، ولا تلاصُق فيها.
   */
  const strip = narrowCountry
    ? { symbol: 0.215, symbolTop: 0.105, name: 0.435, letters: [0.61, 0.75, 0.89] }
    : { symbol: 0.26, symbolTop: 0.05, name: 0.54, letters: [0.78] }
  // الشعار محدودٌ بالبعدين: عرضُ الكتلة يحكمه في الضيّقة وارتفاعُها في العريضة
  const countrySymbol = country
    ? Math.min(country.width * (narrowCountry ? 0.74 : 0.44), country.height * strip.symbol)
    : 0
  const art = showCenterEmblem && emblem !== 'none' && emblem !== 'custom' ? EMBLEM_ART[emblem] : null

  const mirrored = stripSide === 'left'
  const label =
    title ??
    `لوحة ${plateType === 'motorcycle' ? 'دراجة نارية' : plateType === 'transport' ? 'نقل خاص' : 'خصوصي'}${
      geo.singleRow ? ' رياضية' : ''
    } ${geo.singleRow ? latinLetters : arabicLetters} ${western}`

  const ksaLetters = ['K', 'S', 'A']


  /*
   * النقش للمقاسات التي تُرى فيها التفاصيل.
   *
   * والحرف على اللوحة الحقيقية **مطروق** بارز، بريقه من حافّته لا من لونه.
   * فيُنقش في كل مقاسٍ إلّا المصغّر: في 190 بكسلًا لا يُرى النقش ويبقى ثمنه.
   */
  const embossed = size !== 'thumbnail'

  return (
    <div className={cn('select-none', SIZE_CLASS[size], className)} data-plate-size={size}>
      <svg
        viewBox={geo.viewBox}
        className={cn(size === 'fill' ? 'h-full w-full' : 'h-auto w-full', animated && 'plate-animated')}
        role="img"
        aria-label={label}
        preserveAspectRatio="xMidYMid meet"
        data-plate-type={plateType}
        data-plate-letters={arabicLetters}
        data-plate-numbers={western}
      >
        <defs>
          {/*
            * وجه اللوحة: تدرّج رأسي كما كان، ومعه **شريط ضوء مائل** خافت جدًّا
            * يعطي إحساس السطح المعدني المصقول. النسب محسوبة ليبقى الوجه أبيضَ
            * رسميًّا لا لامعًا زخرفيًّا.
            */}
          <linearGradient id={`plate-face-${uid}`} x1="0" y1="0" x2="0.2" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="46%" stopColor="#FEFEFF" />
            <stop offset="58%" stopColor="#F9FAFC" />
            <stop offset="100%" stopColor="#F4F6F9" />
          </linearGradient>
          {/*
            * النقش: اللوحة الحقيقية **مطروقة** لا مطبوعة.
            *
            * الحرف مطروقٌ من الخلف فيبرز عن وجهها، وحافّته العليا تلمع والسفلى
            * تُظلّ. وثلاث طبقات لا طبقتان: خطٌّ أبيض حادّ يصنع الحافّة، وظلٌّ
            * رماديّ قريب يعطي السُّمك، وظلٌّ أبعدُ ناعم يُجلس الحرف على الوجه
            * بدل أن يطفو عليه. و`stdDeviation` صفر في الأوّلين فلا تفقد الحافّة
            * حدّتها.
            */}
          {embossed && (
            <filter id={`plate-emboss-${uid}`} x="-6%" y="-18%" width="112%" height="136%">
              <feDropShadow dx="-1.1" dy="-1.3" stdDeviation="0" floodColor="#FFFFFF" floodOpacity="0.95" />
              <feDropShadow dx="1" dy="1.2" stdDeviation="0" floodColor="#5B6472" floodOpacity="0.55" />
              <feDropShadow dx="2.2" dy="2.8" stdDeviation="2.2" floodColor="#0A0D12" floodOpacity="0.3" />
            </filter>
          )}
          <linearGradient id={`plate-sheen-${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
            <stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`plate-clip-${uid}`}>
            <rect
              x={geo.inset}
              y={geo.inset}
              width={geo.width - geo.inset * 2}
              height={geo.height - geo.inset * 2}
              rx={geo.frameRadius - 5}
            />
          </clipPath>
        </defs>

        <g transform={mirrored ? `translate(${geo.width} 0) scale(-1 1)` : undefined}>
          {/* جسم اللوحة: وجه أبيض وإطار أسود رفيع بحواف دائرية */}
          <rect
            x={geo.inset / 2}
            y={geo.inset / 2}
            width={geo.width - geo.inset}
            height={geo.height - geo.inset}
            rx={geo.frameRadius}
            fill={`url(#plate-face-${uid})`}
            stroke="#0A0D12"
            strokeWidth={geo.inset}
          />

          <g clipPath={`url(#plate-clip-${uid})`} filter={embossed ? `url(#plate-emboss-${uid})` : undefined}>
            {/*
              * الخانات المنفصلة: أرضيّةٌ سوداء يُرسم فوقها البياض.
              *
              * الوجه المرسوم أصلًا أبيضُ كلّه، فلو رُسم الأسود بينها لصار
              * أربعة مستطيلاتٍ سوداء تُحاذي أربعة بيضاء وتتراكب حوافّها. وطلاء
              * الأرضيّة أوّلًا ثمّ وضع البياض عليها يُنتج الفراغ نفسه بحدٍّ
              * واحدٍ نظيف.
              */}
            {geo.cells && (
              <>
                <rect
                  x={geo.inset}
                  y={geo.inset}
                  width={geo.width - geo.inset * 2}
                  height={geo.height - geo.inset * 2}
                  fill="#0A0D12"
                />
                {geo.cells.map((cell) => (
                  <rect
                    key={`${cell.x}-${cell.y}`}
                    x={cell.x}
                    y={cell.y}
                    width={cell.width}
                    height={cell.height}
                    rx={geo.cellRadius}
                    fill={`url(#plate-face-${uid})`}
                  />
                ))}
              </>
            )}

            {/* أرضيّة خانة الدولة — زرقاء في لوحات النقل */}
            {/*
              * كتلة الدولة — شعارٌ و«السعودية» و«KSA».
              *
              * موضعها يختلف بالإصدار وشكلُها يحكم ترتيبَ ما فيها: الضيّقة
              * (الاعتيادية) تُكدّس الحروف رأسيًّا لأنّ «KSA» كلمةً واحدة لا
              * تُقرأ في ستّين بكسلًا، والعريضة (الطويلة والرياضية) تكتبها كما
              * هي. وأرضيّتها زرقاء في لوحات النقل — علامتها في اللوحة الحقيقية.
              */}
            {country && (
              <>
                <rect
                  x={country.x}
                  y={country.y}
                  width={country.width}
                  height={country.height}
                  rx={geo.cellRadius}
                  fill={countryFill ?? `url(#plate-face-${uid})`}
                />

                <Unflip x={country.x + country.width / 2} active={mirrored}>
                  <g>
                    {/*
                      * المواضع نِسبٌ من ارتفاع الكتلة لا مقاديرُ متراكمة.
                      *
                      * كان كلٌّ يُحسب بإضافة ما قبله، فيكفي أن يكبر الشعار
                      * قليلًا حتى ينزل الاسم على «KSA» — وقد وقع. والنِّسب
                      * تُثبّت كلًّا في حصّته مهما تغيّر جاره.
                      */}
                    <g
                      transform={`translate(${cx - countrySymbol / 2} ${country.y + country.height * strip.symbolTop}) scale(${countrySymbol / 100})`}
                    >
                      <EmblemShapes art={STRIP_SYMBOL} monochrome={countryInk} box={100} />
                    </g>

                    <text
                      x={cx}
                      y={country.y + country.height * strip.name}
                      textAnchor="middle"
                      fill={countryInk}
                      fontSize={country.width * (narrowCountry ? 0.26 : 0.19)}
                      fontWeight={600}
                      style={{ fontFamily: 'var(--font-plate-arabic)' }}
                    >
                      السعودية
                    </text>

                    {narrowCountry ? (
                      ksaLetters.map((letter, index) => (
                        <text
                          key={letter}
                          x={cx}
                          y={country.y + country.height * strip.letters[index]}
                          textAnchor="middle"
                          fill={countryInk}
                          fontSize={country.width * 0.44}
                          fontWeight={700}
                          style={{ fontFamily: 'var(--font-plate-latin)' }}
                        >
                          {letter}
                        </text>
                      ))
                    ) : (
                      <text
                        x={cx}
                        y={country.y + country.height * strip.letters[0]}
                        textAnchor="middle"
                        fill={countryInk}
                        fontSize={country.width * 0.32}
                        fontWeight={700}
                        letterSpacing={country.width * 0.02}
                        style={{ fontFamily: 'var(--font-plate-latin)' }}
                      >
                        KSA
                      </text>
                    )}

                    {/*
                      * مثلّثٌ أبيض أسفل كتلة النقل.
                      *
                      * مطبوعٌ على اللوحة الحقيقية لا ملصقًا عليها، وهو ممّا
                      * يُميّز النقل الخاصّ في نظرةٍ واحدة.
                      */}
                    {countryFill && (
                      <path
                        d={`M ${cx - country.width * 0.17} ${country.y + country.height * 0.86} L ${cx + country.width * 0.17} ${country.y + country.height * 0.86} L ${cx} ${country.y + country.height * 0.97} Z`}
                        fill="#FFFFFF"
                      />
                    )}
                  </g>
                </Unflip>
              </>
            )}

            {/* الشعار الوسطي */}
            {art && (
              <Unflip x={geo.emblem.center} active={mirrored}>
                <g
                  data-plate-emblem="center"
                  transform={`translate(${geo.emblem.center - geo.emblem.size / 2} ${geo.height / 2 - geo.emblem.size / 2}) scale(${geo.emblem.size / 100})`}
                >
                  <EmblemShapes art={art} box={100} />
                </g>
              </Unflip>
            )}
            {showCenterEmblem && emblem === 'custom' && customEmblemUrl && (
              <Unflip x={geo.emblem.center} active={mirrored}>
                <image
                  data-plate-emblem="center"
                  href={customEmblemUrl}
                  x={geo.emblem.center - geo.emblem.size / 2}
                  y={geo.height / 2 - geo.emblem.size / 2}
                  width={geo.emblem.size}
                  height={geo.emblem.size}
                  preserveAspectRatio="xMidYMid meet"
                />
              </Unflip>
            )}

            {/* انعكاس زجاجي خفيف جدًا */}
            {showReflection && (
              <rect
                x={geo.inset}
                y={geo.inset}
                width={geo.width - geo.inset * 2}
                height={geo.height - geo.inset * 2}
                fill={`url(#plate-sheen-${uid})`}
                opacity="0.5"
                pointerEvents="none"
              />
            )}

            {/*
              * العربية تُسقط في الرياضية.
              *
              * ليست إخفاءً بالتنسيق بل امتناعًا عن الرسم: اللوحة الرياضية لا
              * عربية فيها أصلًا، ورسمُها ثمّ إخفاؤها يُبقيها في نصّ الوصول
              * وفي البحث فتُقرأ لوحةً ليست هي.
              */}
            {!geo.singleRow && (
            <Unflip x={geo.numbers.center} active={mirrored}>
              <text
                x={geo.numbers.center}
                y={topRow.baselines[0]}
                textAnchor="middle"
                fill="#0A0D12"
                fontSize={arabicNumberSize}
                fontWeight={700}
                letterSpacing={arabicNumberSize * 0.05}
                style={{ fontFamily: 'var(--font-plate-arabic)' }}
              >
                {eastern}
              </text>
            </Unflip>
            )}
            {/* الأرقام الإنجليزية — أسفل القسم الأيسر */}
            <Unflip x={geo.numbers.center} active={mirrored}>
              <text
                x={geo.numbers.center}
                y={bottomRow.baselines[0]}
                textAnchor="middle"
                fill="#0A0D12"
                fontSize={numberSize}
                fontWeight={700}
                letterSpacing={numberSize * 0.08}
                style={{ fontFamily: 'var(--font-plate-latin)' }}
              >
                {western}
              </text>
            </Unflip>
            {!geo.singleRow && (
            <Unflip x={geo.letters.center} active={mirrored}>
              <text
                x={geo.letters.center}
                y={topRow.baselines[1]}
                textAnchor="middle"
                fill="#0A0D12"
                fontSize={arabicLetterSize}
                fontWeight={700}
                direction="rtl"
                style={{ fontFamily: 'var(--font-plate-arabic)' }}
              >
                {isolateArabic(arabicLetters)}
              </text>
            </Unflip>
            )}
            {/* الحروف الإنجليزية — أسفل القسم الأيمن */}
            <Unflip x={geo.letters.center} active={mirrored}>
              <text
                x={geo.letters.center}
                y={bottomRow.baselines[1]}
                textAnchor="middle"
                fill="#0A0D12"
                fontSize={latinLetterSize}
                fontWeight={700}
                letterSpacing={latinLetterSize * 0.1}
                style={{ fontFamily: 'var(--font-plate-latin)' }}
              >
                {latinLetters}
              </text>
            </Unflip>
          </g>
        </g>

        {animated && (
          <rect
            className="plate-shimmer"
            x={-geo.width}
            y="0"
            width={geo.width * 0.45}
            height={geo.height}
            fill={`url(#plate-sheen-${uid})`}
            pointerEvents="none"
          />
        )}
      </svg>
    </div>
  )
}

export default SaudiLicensePlate
