import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * **عنوانُ التطبيق يُخبز — فالخطأ فيه لا يُصلَح إلّا بمراجعة متجر.**
 *
 * `server.url` يُكتب في الحزمة وقت البناء. ونُقل نطاقُ المنصّة فسقطت كلُّ
 * نسخةٍ مثبَّتة: تقرأ من مضيفٍ يردّ 503، ولا سبيل إلى تبديله إلّا بنسخةٍ
 * جديدة تمرّ بالمراجعة — أيّامًا لا ساعات.
 *
 * فما يُقاس هنا شيئان: أنّ العنوان يُؤخذ من البيئة لا من قيمةٍ في الكود،
 * وأنّ `allowNavigation` تقبل نطاقاتٍ تُدرَج **قبل** النقل — فيصير النقلُ
 * بتحويلٍ من القديم بلا بناءٍ ثانٍ.
 */
async function loadConfig(env: Record<string, string | undefined>) {
  vi.resetModules()
  const saved = { ...process.env }
  Object.assign(process.env, env)
  try {
    return (await import('../../capacitor.config')).default
  } finally {
    process.env = saved
  }
}

afterEach(() => {
  vi.resetModules()
})

describe('إعدادُ الغلاف الأصيل', () => {
  it('يأخذ العنوان من البيئة، ويسمح بمضيفه', async () => {
    const config = await loadConfig({ NEXT_PUBLIC_APP_URL: 'https://example.test/' })

    expect(config.server?.url).toBe('https://example.test')
    expect(config.server?.allowNavigation).toContain('example.test')
    // ولا HTTP مكشوف: الجلسة تسافر في الكوكي
    expect(config.server?.cleartext).toBe(false)
  })

  it('ويقبل نطاقاتٍ إضافية ببدائلها — فالنقلُ لا يحتاج بناءً', async () => {
    const config = await loadConfig({
      NEXT_PUBLIC_APP_URL: 'https://old.test',
      CAPACITOR_ALLOWED_HOSTS: '*.payone.one, new.test',
    })

    expect(config.server?.allowNavigation).toEqual(
      expect.arrayContaining(['old.test', '*.payone.one', 'new.test']),
    )
  })

  /*
   * **ولا نطاقَ إنتاجٍ في الكود.**
   *
   * كتابةُ نطاقٍ حقيقيٍّ افتراضًا تُخرج — عند نسيان المتغيّر — تطبيقًا يقرأ
   * من نطاقٍ قديم بلا أن يشكو أحد، وهو ما وقع في `v1.0.3`. و`localhost`
   * يصرخ في أوّل فتحة، والصارخُ خيرٌ من الصامت.
   */
  it('وبلا متغيّرٍ يقع على التطوير لا على نطاقٍ حقيقيّ', async () => {
    const config = await loadConfig({ NEXT_PUBLIC_APP_URL: undefined })

    expect(config.server?.url).toMatch(/^http:\/\/localhost/)
  })

  it('ولا يُكرّر مضيفًا أُدرج مرّتين', async () => {
    const config = await loadConfig({
      NEXT_PUBLIC_APP_URL: 'https://same.test',
      CAPACITOR_ALLOWED_HOSTS: 'same.test,same.test',
    })

    const hosts = config.server?.allowNavigation ?? []
    expect(hosts.filter((host) => host === 'same.test')).toHaveLength(1)
  })
})
