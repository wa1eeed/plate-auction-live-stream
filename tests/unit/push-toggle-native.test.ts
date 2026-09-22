import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * مفتاح الإشعارات — **الغلاف يُفصل قبل أيّ واجهة ويب**.
 *
 * وهذا حارسُ ترتيبٍ في المصدر لا فحصُ سلوك، وسببه أنّ العطب كان في الترتيب
 * نفسه: المسار كان واحدًا، فيمرّ الغلاف الأصيل بثلاث واجهاتٍ لا وجود لها
 * فيه — وأقتلُها `Notification`، **وهي غير معرَّفة في WKWebView على iOS**.
 *
 * فيُرمى `ReferenceError`، والـeffect كان بلا `try`، فتبقى الحالة `loading`.
 * و`loading` تعني `return null` — **فلا يُرسم مفتاحٌ إطلاقًا**: لا يُمنح
 * إذن، ولا يُسجَّل جهاز، ولا يصل إشعارٌ واحد. وكلُّه بلا رسالة خطأ.
 *
 * ومحاكاةُ ذلك في متصفّحٍ تقيس أداة الاختبار أكثر ممّا تقيس الكود (جُرّب
 * فلم ينفتح الدُرج أصلًا). والترتيب في المصدر هو الشرط المقصود، فيُقاس.
 */

/**
 * ويُقرأ الكود **مجرَّدًا من التعليقات**.
 *
 * وأوّلُ صياغةٍ لم تفعل، فالتقطت ذِكرَ `Notification.permission` **في تعليقٍ
 * يشرح العطب** وحسبته استعمالًا — فسقط الفحص على كودٍ سليم. وحارسٌ يقرأ
 * مصدرًا يجب أن يقرأ ما يُنفَّذ منه لا ما يُشرح فيه.
 */
function code(path: string): string {
  return readFileSync(join(__dirname, '..', '..', path), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

const SOURCE = code('src/components/layout/push-toggle.tsx')

describe('مفتاح الإشعارات في الغلاف الأصيل', () => {
  it('يُفصل الغلاف **قبل** لمس `Notification`', () => {
    const nativeBranch = SOURCE.indexOf('if (isNativeShell()) {')
    const notificationUse = SOURCE.indexOf('Notification.permission')

    expect(nativeBranch, 'لا فرعَ للغلاف').toBeGreaterThan(-1)
    expect(notificationUse, 'لم تعد `Notification` تُستعمل؟ راجع الفحص').toBeGreaterThan(-1)
    expect(
      nativeBranch,
      '`Notification` تُلمس قبل فصل الغلاف — وهي غير معرَّفة في WKWebView',
    ).toBeLessThan(notificationUse)
  })

  it('وقبل `serviceWorker` و`pushManager` — ولا وجود لهما فيه', () => {
    const nativeBranch = SOURCE.indexOf('if (isNativeShell()) {')
    for (const api of ['navigator.serviceWorker.ready', 'pushManager']) {
      const at = SOURCE.indexOf(api)
      if (at === -1) continue
      expect(nativeBranch, `«${api}» يُلمس قبل فصل الغلاف`).toBeLessThan(at)
    }
  })

  it('ولا يشترط مفتاح VAPID على الغلاف — فقناتُه غيرُ قناة الويب', () => {
    const nativeBranch = SOURCE.indexOf('if (isNativeShell()) {')
    const vapidGate = SOURCE.indexOf('!config.publicKey')
    expect(vapidGate, 'لا حارسَ لمفتاح VAPID؟ راجع الفحص').toBeGreaterThan(-1)
    expect(nativeBranch, 'الغلاف يمرّ بحارس VAPID — فيُخفى المفتاح بلا سبب').toBeLessThan(
      vapidGate,
    )
  })

  it('والـeffect محروسٌ — فواجهةٌ ناقصة تُعرض «مطفأ» لا عدمًا صامتًا', () => {
    /* `loading` تعني `return null`، فاستثناءٌ غير ملتقَط يُخفي المفتاح */
    const effect = SOURCE.slice(SOURCE.indexOf('useEffect(() => {'))
    const iife = effect.slice(0, effect.indexOf('})()'))
    expect(iife, 'الـeffect بلا `try` — واستثناءٌ فيه يُخفي المفتاح').toContain('try {')
  })
})
