import { cn } from '@/lib/utils'
import type { PlateEmblem, PlateSize, PlateType } from '@/lib/domain/types'
import { toArabicIndicDigits } from '@/lib/saudi-plate-mapping'
import { EMBLEM_ART, EmblemShapes, STRIP_SYMBOL } from './EmblemGraphic'
import {
  ARABIC_ASCENT_SHARE,
  ARABIC_DIGIT_INK,
  ARABIC_LETTER_INK,
  LATIN_ASCENT_SHARE,
  LATIN_CAP_INK,
  LATIN_DIGIT_INK,
  inkOf,
  layoutRow,
} from './arial-metrics'

export type SaudiLicensePlateProps = {
  plateType?: PlateType
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
 * أحجام الخط لكل عدد أحرف/أرقام.
 * الهدف: بقاء كل نص داخل مساحته مهما تغيّر المحتوى مع ثبات المحاذاة —
 * المعاملات محسوبة على العرض الفعلي للحروف (اللاتينية أعرض من العربية).
 */
function arabicLettersFontSize(count: number, base: number): number {
  if (count <= 1) return base
  if (count === 2) return base * 0.86
  return base * 0.68
}

function latinLettersFontSize(count: number, base: number): number {
  if (count <= 1) return base
  if (count === 2) return base * 0.8
  return base * 0.6
}

function numbersFontSize(count: number, base: number): number {
  if (count <= 2) return base
  if (count === 3) return base * 0.9
  return base * 0.82
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
}

const LONG_GEOMETRY: Geometry = {
  viewBox: '0 0 930 200',
  width: 930,
  height: 200,
  frameRadius: 20,
  inset: 7,
  strip: { x: 858, width: 65 },
  main: { x: 7, width: 851 },
  numbers: { center: 210, from: 90, to: 330 },
  emblem: { center: 460, from: 360, to: 560, size: 132 },
  letters: { center: 700, from: 600, to: 800 },
  // الداخل 7..193 (186). الشريطان بارتفاع 72، موضوعان ليتساوى الهامش أعلى وأسفل (~17)
  rows: { topBand: 24, bottomBand: 104, bandHeight: 72 },
  fonts: { numbers: 82, letters: 88 },
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
  inset: 6,
  strip: { x: 358, width: 66 },
  main: { x: 6, width: 352 },
  numbers: { center: 110, from: 22, to: 198 },
  // لا شعار أوسط — الحجم صفر يُسقط رسمه
  emblem: { center: 215, from: 205, to: 225, size: 0 },
  letters: { center: 275, from: 215, to: 345 },
  // الداخل 6..189 (183). شريطان بارتفاع 70 بهامش ~17 أعلى وأسفل
  rows: { topBand: 23, bottomBand: 101, bandHeight: 70 },
  fonts: { numbers: 80, letters: 84 },
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
  const geo = plateType === 'motorcycle' ? MOTO_GEOMETRY : LONG_GEOMETRY
  // معرّف ثابت مشتقّ من المحتوى: متطابق بين الخادم والعميل، ولا يتضارب
  // مع لوحة أخرى مختلفة المحتوى.
  const uid = stableUid([plateType, arabicLetters, latinLetters, western, emblem])

  const letterCount = Array.from(arabicLetters).length

  // حدود العرض: تمنع تجاوز النصّ مساحته أفقيًا مع كثرة المحارف
  const numberWidthLimit = numbersFontSize(western.length, geo.fonts.numbers)
  const arabicLetterWidthLimit = arabicLettersFontSize(letterCount, geo.fonts.letters)
  const latinLetterWidthLimit = latinLettersFontSize(letterCount, geo.fonts.letters)

  // ثم يقيّد الشريط الرأسي كل عنصر بحبره الحقيقي، فيتساوى الارتفاع المرئي
  const topRow = layoutRow(
    [
      { widthLimit: numberWidthLimit, ink: ARABIC_DIGIT_INK },
      { widthLimit: arabicLetterWidthLimit, ink: inkOf(arabicLetters, ARABIC_LETTER_INK) },
    ],
    geo.rows.topBand,
    geo.rows.bandHeight,
    ARABIC_ASCENT_SHARE,
  )
  const bottomRow = layoutRow(
    [
      { widthLimit: numberWidthLimit, ink: LATIN_DIGIT_INK },
      { widthLimit: latinLetterWidthLimit, ink: LATIN_CAP_INK },
    ],
    geo.rows.bottomBand,
    geo.rows.bandHeight,
    LATIN_ASCENT_SHARE,
  )
  const [arabicNumberSize, arabicLetterSize] = topRow.sizes
  const [numberSize, latinLetterSize] = bottomRow.sizes
  // حجم صفر يعني أن هذه الهندسة بلا شعار أوسط (لوحة الدراجة)
  const showCenterEmblem = geo.emblem.size > 0
  const art = showCenterEmblem && emblem !== 'none' && emblem !== 'custom' ? EMBLEM_ART[emblem] : null

  const mirrored = stripSide === 'left'
  const label =
    title ?? `لوحة ${plateType === 'motorcycle' ? 'دراجة نارية' : plateType === 'transport' ? 'نقل خاص' : 'خصوصي'} ${arabicLetters} ${western}`

  const stripCenter = geo.strip.x + geo.strip.width / 2
  const ksaLetters = ['K', 'S', 'A']

  // توزيع محتوى الشريط: الرمز أعلاه ثم K S A أسفله بمسافات متساوية
  const stripSymbolSize = geo.strip.width * 0.62
  const ksaFontSize = geo.strip.width * 0.42
  const ksaStep = (geo.height - geo.inset * 2 - stripSymbolSize - geo.height * 0.12) / 3
  const ksaFirstBaseline = geo.inset + geo.height * 0.055 + stripSymbolSize + ksaStep * 0.85

  /*
   * النقش للمقاسات التي تُرى فيها التفاصيل.
   *
   * و`fill` ليست منها: بطاقات السوق تستعملها لتملأ صندوقها، فتكون لوحةً في
   * 300px داخل شبكة من أربعين — مرشّحٌ لكلٍّ منها كلفةٌ لا يقابلها ما يُرى.
   */
  const embossed = size === 'fullscreen' || size === 'stage'

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
            * ظلٌّ أبيض إلى أعلى اليسار وظلٌّ داكن إلى أسفل اليمين يعطيان بروزًا
            * يُحسّ ولا يُلاحَظ. و`stdDeviation` صفر فلا يفقد الحرف حدّته.
            *
            * ولا يُطبَّق إلا على المقاسات الكبيرة: مرشّحٌ لكل لوحة في شبكة من
            * أربعين بطاقة كلفةٌ لا يقابلها ما يُرى في 190px.
            */}
          {embossed && (
            <filter id={`plate-emboss-${uid}`} x="-5%" y="-15%" width="110%" height="130%">
              <feDropShadow dx="-0.9" dy="-1.1" stdDeviation="0" floodColor="#FFFFFF" floodOpacity="0.9" />
              <feDropShadow dx="0.7" dy="0.9" stdDeviation="0.6" floodColor="#0A0D12" floodOpacity="0.22" />
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
            {/* الخط الفاصل لشريط الدولة */}
            <rect
              x={geo.strip.x}
              y={geo.inset}
              width={Math.max(2.5, geo.width * 0.003)}
              height={geo.height - geo.inset * 2}
              fill="#0A0D12"
            />

            {/* رمز الدولة أعلى الشريط */}
            <Unflip x={stripCenter - geo.strip.width * 0.1} active={mirrored}>
              <g
                transform={`translate(${stripCenter - geo.strip.width * 0.1 - stripSymbolSize / 2} ${geo.inset + geo.height * 0.055}) scale(${stripSymbolSize / 100})`}
              >
                <EmblemShapes art={STRIP_SYMBOL} monochrome="#0A0D12" box={100} scope={uid} />
              </g>
            </Unflip>

            {/* «السعودية» رأسيًا على حافة الشريط.
                المعامل 0.20 لا 0.12: النصّ يدور 90° فيصير نصف ارتفاعه امتدادًا
                أفقيًا على الجانبين، وبالمعامل الأصغر كان يتجاوز الإطار ويُقصّ. */}
            <Unflip x={geo.width - geo.inset - geo.strip.width * 0.2} active={mirrored}>
              <text
                transform={`rotate(90 ${geo.width - geo.inset - geo.strip.width * 0.2} ${geo.height / 2})`}
                x={geo.width - geo.inset - geo.strip.width * 0.2}
                y={geo.height / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#0A0D12"
                fontSize={geo.strip.width * 0.26}
                fontWeight={500}
                style={{ fontFamily: 'var(--font-plate-arabic)' }}
              >
                السعودية
              </text>
            </Unflip>

            {/* أحرف KSA رأسيًا */}
            {ksaLetters.map((letter, index) => (
              <Unflip key={letter} x={stripCenter - geo.strip.width * 0.1} active={mirrored}>
                <text
                  x={stripCenter - geo.strip.width * 0.1}
                  y={ksaFirstBaseline + index * ksaStep}
                  textAnchor="middle"
                  fill="#0A0D12"
                  fontSize={ksaFontSize}
                  fontWeight={600}
                  style={{ fontFamily: 'var(--font-plate-latin)' }}
                >
                  {letter}
                </text>
              </Unflip>
            ))}

            {/* الشعار الوسطي */}
            {art && (
              <Unflip x={geo.emblem.center} active={mirrored}>
                <g
                  data-plate-emblem="center"
                  transform={`translate(${geo.emblem.center - geo.emblem.size / 2} ${geo.height / 2 - geo.emblem.size / 2}) scale(${geo.emblem.size / 100})`}
                >
                  <EmblemShapes art={art} box={100} scope={uid} />
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

            {/* الأرقام العربية — أعلى القسم الأيسر */}
            <Unflip x={geo.numbers.center} active={mirrored}>
              <text
                x={geo.numbers.center}
                y={topRow.baseline}
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
            {/* الأرقام الإنجليزية — أسفل القسم الأيسر */}
            <Unflip x={geo.numbers.center} active={mirrored}>
              <text
                x={geo.numbers.center}
                y={bottomRow.baseline}
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
            {/* الحروف العربية — أعلى القسم الأيمن */}
            <Unflip x={geo.letters.center} active={mirrored}>
              <text
                x={geo.letters.center}
                y={topRow.baseline}
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
            {/* الحروف الإنجليزية — أسفل القسم الأيمن */}
            <Unflip x={geo.letters.center} active={mirrored}>
              <text
                x={geo.letters.center}
                y={bottomRow.baseline}
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
