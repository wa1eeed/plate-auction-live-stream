import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * نصوص المتجرين وأصولهما — تُقاس لا تُقدَّر.
 *
 * وحدودُ الحقول ليست إرشادًا: App Store Connect يرفض الحفظ عند تجاوزها،
 * وPlay يرفض الإصدار بلا رسمٍ دعائيّ. واكتشافُ ذلك في لوحة المتجر بعد
 * تجهيز كلّ شيء إضاعةُ جولةٍ كاملة.
 */

const ROOT = join(__dirname, '..', '..')
const LISTING = join(ROOT, 'store-assets', 'STORE_LISTING.md')

/** كتل النصّ بالترتيب الذي تظهر به في الملفّ. */
function blocks(): string[] {
  const text = readFileSync(LISTING, 'utf8')
  return [...text.matchAll(/```\n(.*?)\n```/gs)].map((m) => m[1])
}

const LIMITS: Array<[string, number | null]> = [
  ['اسم App Store', 30],
  ['العنوان الفرعيّ', 30],
  ['الكلمات المفتاحية', 100],
  ['النصّ الدعائيّ', 170],
  ['وصف App Store', 4000],
  ['ملاحظات المراجعة', null],
  ['اسم Play', 30],
  ['الوصف القصير', 80],
]

describe('نصوص المتجرين', () => {
  it('كلُّ حقلٍ داخل حدّه — والمتجر يرفض لا يقصّ', () => {
    const found = blocks()
    expect(found.length, 'عدد الكتل تغيّر — راجع ترتيب الحقول').toBe(LIMITS.length)

    for (const [index, [name, limit]] of LIMITS.entries()) {
      const body = found[index]
      expect(body.length, `«${name}» فارغ`).toBeGreaterThan(0)
      if (limit !== null) {
        expect(body.length, `«${name}» تجاوز ${limit} حرفًا (${body.length})`).toBeLessThanOrEqual(limit)
      }
    }
  })

  it('الكلمات المفتاحية بفواصل بلا مسافات — والمسافة تُحسب من المئة', () => {
    const keywords = blocks()[2]
    expect(keywords).not.toMatch(/,\s/)
    expect(keywords.split(',').length).toBeGreaterThanOrEqual(8)
  })

  it('روابط الدعم والخصوصية والشروط مذكورةٌ كاملة', () => {
    const text = readFileSync(LISTING, 'utf8')
    for (const url of [
      'https://mazad.nx.sa/privacy',
      'https://mazad.nx.sa/about',
      'https://mazad.nx.sa/terms',
    ]) {
      expect(text, `الرابط ${url} غائب`).toContain(url)
    }
  })
})

describe('أصول المتجرين', () => {
  const REQUIRED = [
    'store-assets/play-icon-512.png',
    'store-assets/play-feature-1024x500.png',
    'store-assets/screenshots/ios-6.7/1-market.png',
    'store-assets/screenshots/android/1-market.png',
  ]

  it('موجودةٌ كلُّها — والرسم الدعائيّ يرفض Play الإصدار بدونه', () => {
    for (const path of REQUIRED) {
      expect(existsSync(join(ROOT, path)), `الأصل ${path} غير موجود`).toBe(true)
    }
  })

  it('لقطات iOS بمقاس 6.7 بوصة الذي تشترطه أبل', () => {
    /* PNG: العرض والارتفاع في ترويسة IHDR — البايتات 16..24 */
    const buffer = readFileSync(join(ROOT, 'store-assets/screenshots/ios-6.7/1-market.png'))
    expect(buffer.readUInt32BE(16)).toBe(1290)
    expect(buffer.readUInt32BE(20)).toBe(2796)
  })

  it('الرسم الدعائيّ 1024×500 بالضبط — لا يُقبل غيره', () => {
    const buffer = readFileSync(join(ROOT, 'store-assets/play-feature-1024x500.png'))
    expect(buffer.readUInt32BE(16)).toBe(1024)
    expect(buffer.readUInt32BE(20)).toBe(500)
  })
})
