/**
 * رسومات الشعارات الوسطية للوحة — أصلية بالكامل ومرسومة كمسارات SVG نظيفة.
 * هذا الملف هو المصدر الوحيد للرسم: يستخدمه مكوّن React مباشرةً، ويولّد منه
 * السكربت `scripts/generate-emblems.mjs` ملفات `/public/plate-emblems/*.svg`.
 *
 * ملاحظة: هذه رسومات زخرفية للاستخدام البصري داخل المزاد، وليست شعارات رسمية
 * ولا تمثيلًا حكوميًا.
 */

export type EmblemRole = 'primary' | 'accent'

export type EmblemShape =
  | { kind: 'path'; d: string; role: EmblemRole; opacity?: number }
  | { kind: 'text'; text: string; x: number; y: number; size: number; role: EmblemRole; letterSpacing?: number }

export type EmblemGroup = { transform?: string; shapes: EmblemShape[] }

/**
 * شعار مبني على صورة نقطية.
 * الصورة سوداء على خلفية بيضاء، ويُسقط البياض ويُلوَّن السواد عبر مصفوفة
 * ألوان (`feColorMatrix`) فتظهر بخلفية شفافة وبأي لون مطلوب.
 * `content` يصف صندوق الرسم داخل الصورة بنسب من أبعادها، حتى نضعه بدقّة
 * داخل اللوحة بلا هوامش بيضاء.
 */
export type EmblemImageArt = {
  kind: 'image'
  href: string
  title: string
  tint: string
  /** صندوق الرسم داخل الصورة: نسب من العرض والارتفاع */
  content: { x: number; y: number; width: number; height: number }
  /** نسبة أبعاد الصورة الكاملة (العرض ÷ الارتفاع) */
  imageRatio: number
}

export type EmblemVectorArt = {
  kind?: 'vector'
  viewBox: string
  title: string
  colors: { primary: string; accent: string }
  groups: EmblemGroup[]
}

export type EmblemArt = EmblemVectorArt | EmblemImageArt

export function isImageArt(art: EmblemArt): art is EmblemImageArt {
  return (art as EmblemImageArt).kind === 'image'
}

/**
 * صندوق رسم النخلة والسيفان داخل `palm.jpeg` (900×576)،
 * مقيسًا من حواف الرسم الفعلية لا حواف الملف.
 */
const PALM_IMAGE = {
  kind: 'image' as const,
  href: '/plate-emblems/palm.jpeg',
  content: { x: 0.291, y: 0.165, width: 0.418, height: 0.703 },
  imageRatio: 900 / 576,
}

const path = (d: string, role: EmblemRole = 'primary', opacity?: number): EmblemShape => ({
  kind: 'path',
  d,
  role,
  opacity,
})

// ------------------------------------------------------------------ التصدير

export const EMBLEM_ART: Record<string, EmblemArt> = {
  'palm-swords-black': {
    ...PALM_IMAGE,
    title: 'النخلة والسيفان',
    tint: '#0A0D12',
  },
  'palm-swords-gold': {
    ...PALM_IMAGE,
    title: 'النخلة والسيفان — ذهبي',
    tint: '#B8860B',
  },
  'vision-2030': {
    viewBox: '0 0 100 100',
    title: 'رؤية 2030 — تمثيل زخرفي',
    colors: { primary: '#0E7C56', accent: '#C9A227' },
    groups: [
      {
        shapes: [
          // قوس صاعد يرمز إلى التقدّم
          path('M8 72 C26 90 74 90 92 72 L92 80.5 C72 98 28 98 8 80.5 Z'),
          // ثلاث درجات صاعدة
          path('M26 60 L34 60 L34 46 L26 46 Z', 'accent'),
          path('M46 60 L54 60 L54 36 L46 36 Z', 'accent'),
          path('M66 60 L74 60 L74 26 L66 26 Z', 'accent'),
        ],
      },
      {
        shapes: [
          { kind: 'text', text: '2030', x: 50, y: 22, size: 19, role: 'primary', letterSpacing: 1 },
        ],
      },
    ],
  },
  'heritage-arch': {
    viewBox: '0 0 100 100',
    title: 'زخرفة تراثية نجدية',
    colors: { primary: '#8A6A2F', accent: '#C9A227' },
    groups: [
      {
        shapes: [
          // قوس مدبّب بأسلوب العمارة النجدية
          path(
            'M18 84 L18 42 L50 12 L82 42 L82 84 L69 84 L69 47.5 L50 29.5 L31 47.5 L31 84 Z',
          ),
          // مثلثات التهوية التقليدية
          path('M38 66 L44.5 78 L31.5 78 Z', 'accent'),
          path('M50 60 L56.5 72 L43.5 72 Z', 'accent'),
          path('M62 66 L68.5 78 L55.5 78 Z', 'accent'),
          // شريط علوي
          path('M18 36.5 L26 29 L26 34 L18 41 Z', 'accent', 0.85),
          path('M82 36.5 L74 29 L74 34 L82 41 Z', 'accent', 0.85),
        ],
      },
    ],
  },
}

/** الشعار الصغير المستخدم داخل الشريط الرأسي (رمز الدولة). */
export const STRIP_SYMBOL: EmblemArt = {
  ...PALM_IMAGE,
  title: 'رمز الشريط',
  tint: '#0A0D12',
}

export const EMBLEM_KEYS = Object.keys(EMBLEM_ART)
