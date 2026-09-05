import { describe, expect, it } from 'vitest'
import { brandColorCss, brandPalette } from '@/lib/server/brand-service'

describe('اشتقاق لون المنصّة', () => {
  it('يشتقّ ثلاث درجات من لونٍ واحد، والفاتحة أغمق من الداكنة', () => {
    const palette = brandPalette('#d6a84b')!
    expect(palette).not.toBeNull()
    expect(palette.dark).toHaveLength(3)
    expect(palette.light).toHaveLength(3)

    /*
     * النصّ في السمة الفاتحة على أبيض، فدرجته أغمق لا أفتح.
     *
     * ولو نُسخت درجات الداكنة كما هي لخرج ذهبيٌّ فاتح على ورقٍ أبيض — يُقرأ
     * بالكاد، ويسقط في تباين WCAG.
     */
    const luminance = (hex: string) =>
      [1, 3, 5].reduce((sum, i) => sum + parseInt(hex.slice(i, i + 2), 16), 0)
    expect(luminance(palette.light[1])).toBeLessThan(luminance(palette.dark[1]))
  })

  it('يرفض ما ليس لونًا فلا يُحقن نصٌّ في وسم التنسيق', () => {
    for (const bad of ['أحمر', '#12', 'red', '#ggghhh', '</style><script>']) {
      expect(brandPalette(bad), bad).toBeNull()
      expect(brandColorCss(bad), bad).toBe('')
    }
  })

  it('يُعلن الفاتحة على كل حامل للسمة لا على الجذر وحده', () => {
    /*
     * السمة موضوعة على `html` وعلى قشرة الصفحة معًا، وملفّ التنسيق يُعلن
     * الفاتحة بـ`[data-theme="light"]`. فقاعدةٌ على `:root` وحده تكسب عند
     * `html` ويُعاد التعريف الأصلي عند القشرة — فترث الأزرار الذهبيّ القديم
     * بينما يقول الجذر إنّ اللون تبدّل. رُصد حيًّا.
     */
    const css = brandColorCss('#0f766e')
    expect(css).toContain(':root{')
    expect(css).toMatch(/\[data-theme='light'\]\[data-theme\]/)
  })
})
