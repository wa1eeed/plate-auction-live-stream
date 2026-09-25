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

describe('مسار المعرض', () => {
  /*
   * `@` ما دام له معرّف علنيّ، و`/u/<id>` وإلّا. وتُبنى في موضعٍ واحد كي لا
   * يفترق ما يُنسخ في الحساب عمّا يعود إليه الزائر من صفحة اللوحة.
   */
  it('يختصر بالمعرّف العلنيّ ويحتفظ بالداخليّ', async () => {
    const { showcasePath } = await import('@/lib/domain/reference')
    expect(showcasePath('waleed')).toBe('/@waleed')
    expect(showcasePath('usr_17c8063b77a146f1a137')).toBe('/u/usr_17c8063b77a146f1a137')
  })
})

/**
 * **الفافيكون لا يصير أيقونةَ التطبيق.**
 *
 * وهما عهدان مختلفان: الفافيكون يجلس في شريط تبويب فيجوز أن يكون شفّافًا
 * وغيرَ مربّع وصغيرًا، وأيقونةُ الشاشة الرئيسية يضع النظامُ عليها قناعًا
 * مستديرًا فتلزمها مربّعةً معتمةً إلى أطرافها.
 *
 * وكان المرفوعُ يحكمهما معًا، فظهرت على الجوّال أيقونةٌ ٣٠١×٣٠١ بزوايا
 * `rgb(237,246,244)` — زوايا بيضاء داخل استدارة القناع — بينما
 * `app-icon.png` المصمَّمة لهذا معتمةٌ إلى أطرافها ولم تُستعمل.
 */
describe('أيقونةُ التثبيت لا تتبع المرفوع', () => {
  const bytes = Buffer.from('لا صورة')
  const uploaded = {
    data: bytes.toString('base64'),
    mime: 'image/png',
    fileName: 'favicon.png',
    bytes: bytes.byteLength,
    updatedAt: new Date().toISOString(),
  }

  it('البيانُ يعلن المرسومة وحدها ولو رُفع فافيكون', async () => {
    const { resetStoreForTests, createSeededMemoryStore, getStore } = await import('@/lib/store')
    resetStoreForTests(createSeededMemoryStore())
    await getStore().updateBrandSettings({ icon: uploaded })

    const manifest = (await import('@/app/manifest')).default
    const { icons } = await manifest()
    const sources = (icons ?? []).map((row) => row.src)

    expect(sources).toContain('/app-icon.png')
    // ولا أثر للمرفوع: لا مسارَ `/brand/` بينها
    expect(sources.some((src) => src.includes('/brand/'))).toBe(false)

    resetStoreForTests()
  })
})
