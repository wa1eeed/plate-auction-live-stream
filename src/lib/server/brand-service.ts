import { getStore } from '@/lib/store'
import { appUrl } from '@/lib/config'
import {
  BRAND_ASSET_LIMITS,
  type BrandAsset,
  type BrandAssetKind,
  type BrandSettings,
} from '@/lib/domain/types'

export async function getBrand(): Promise<BrandSettings> {
  return getStore().getBrandSettings()
}

/* ------------------------------------------------------------------ الألوان */

function clamp(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : Math.round(value)
}

function parseHex(hex: string): [number, number, number] | null {
  const value = hex.trim().replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16)) as [number, number, number]
}

const toHex = ([r, g, b]: [number, number, number]) =>
  `#${[r, g, b].map((c) => clamp(c).toString(16).padStart(2, '0')).join('')}`

/** يمزج اللون بالأبيض (`amount > 0`) أو بالأسود (`amount < 0`). */
function shade(rgb: [number, number, number], amount: number): [number, number, number] {
  const target = amount > 0 ? 255 : 0
  const t = Math.abs(amount)
  return rgb.map((c) => c + (target - c) * t) as [number, number, number]
}

/**
 * سلّم الذهبي كلّه من لونٍ واحد.
 *
 * الإدارة تختار لونًا واحدًا، والواجهة تستعمل ثلاث درجات: الأساسي، وأفتح منه
 * للنصّ على الداكن، وأغمق للحدود. واشتقاقها هنا يمنع أن يُطلب من مَن يضبط
 * لونه أن يختار ثلاثة تتناسق — وأن ينسى واحدًا فيبقى ذهبيّ المنصّة الأصلي
 * ظاهرًا في زاوية.
 *
 * والسمة الفاتحة تعكس الاتجاه: نصُّها على أبيض، فالأفتح فيها هو الأغمق.
 */
export function brandPalette(primary: string): { light: string[]; dark: string[] } | null {
  const rgb = parseHex(primary)
  if (!rgb) return null
  return {
    // داكنة: 400 أفتح · 500 الأساس · 600 أغمق
    dark: [toHex(shade(rgb, 0.22)), toHex(rgb), toHex(shade(rgb, -0.18))],
    // فاتحة: تُغمَّق ليبقى النصّ مقروءًا على أبيض
    light: [toHex(shade(rgb, -0.42)), toHex(shade(rgb, -0.26)), toHex(shade(rgb, 0.06))],
  }
}

/**
 * قواعد CSS تُحقن في `<head>` فتتغلّب على القيم الافتراضية.
 *
 * تُكتب في الوثيقة لا في ملفّ التنسيق: الملفّ يُبنى مرّة عند النشر، واللون
 * يتغيّر من اللوحة بعده. وتُرجع فارغةً إن كان اللون هو الافتراضي، فلا تُحمَّل
 * كل صفحةٍ سطورًا لا تغيّر شيئًا.
 */
export function brandColorCss(primary: string): string {
  const palette = brandPalette(primary)
  if (!palette) return ''
  const [d4, d5, d6] = palette.dark
  const [l4, l5, l6] = palette.light
  const dark = `--color-gold-400:${d4};--color-gold-500:${d5};--color-gold-600:${d6}`
  const light = `--color-gold-400:${l4};--color-gold-500:${l5};--color-gold-600:${l6}`

  /*
   * السمة الفاتحة تُعلَن على **كل** حامل للسمة لا على الجذر وحده.
   *
   * ملفّ التنسيق يعلنها بـ`[data-theme="light"]`، والسمة موضوعة على `html`
   * وعلى قشرة الصفحة معًا. فقاعدةٌ على `:root` وحده تكسب عند `html` ويُعاد
   * التعريف الأصلي عند القشرة — فيرث ما تحتها الذهبيّ القديم بينما يقول
   * الجذر إنّ اللون تبدّل. وهو ما وقع: متغيّرٌ صحيح وأزرارٌ بلونٍ آخر.
   *
   * وتكرار السمة في المُحدِّد يرفع تخصيصه فوق تخصيص الملفّ عند العنصر نفسه،
   * فيكسب أينما وُضعت.
   */
  return [
    `:root{${dark}}`,
    `[data-theme='light'][data-theme],[data-stage-theme='light'][data-stage-theme]{${light}}`,
  ].join('')
}

/* ------------------------------------------------------------------ الأصول */

export const ASSET_ROUTE: Record<BrandAssetKind, string> = {
  logo: '/brand/logo',
  icon: '/brand/icon',
  ogImage: '/brand/og',
}

/**
 * رابط الأصل مع بصمة تغيّره.
 *
 * `updatedAt` في الاستعلام يُبطل ذاكرة المتصفّح والوسطاء عند كل استبدال: بدونه
 * يُرفع شعارٌ جديد ويبقى القديم ظاهرًا لمن زار الموقع قبله — ولمن يقرأ بطاقة
 * المشاركة في واتساب، وهي تُخزَّن أشهرًا.
 */
export function assetUrl(kind: BrandAssetKind, asset: BrandAsset | null): string | null {
  if (!asset) return null
  return `${ASSET_ROUTE[kind]}?v=${Date.parse(asset.updatedAt) || 0}`
}

/** الرابط المطلق — بطاقات المشاركة لا تقبل مسارًا نسبيًّا. */
export function absoluteAssetUrl(kind: BrandAssetKind, asset: BrandAsset | null): string | null {
  const path = assetUrl(kind, asset)
  return path ? `${appUrl()}${path}` : null
}

export function assetLimit(kind: BrandAssetKind): number {
  return BRAND_ASSET_LIMITS[kind]
}
