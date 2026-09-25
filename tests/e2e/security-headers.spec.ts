import { expect, test } from './support/hydrated'
import { type ConsoleMessage } from '@playwright/test'
import { loginUser, USERS } from './support/session'

/**
 * ترويسات الأمان — تُقاس على الردّ، وخرقُ السياسة يُلتقط من المتصفّح.
 *
 * وفحصُ وجود الترويسة وحده لا يكفي: `CSP` تُرسَل وتبدو سليمةً ثمّ تحجب حزمةً
 * من حزم الإطار، فتُعرض الصفحة بلا تفاعل — بلا خطأ في الشبكة ولا في الخادم،
 * وإنّما سطرٌ في وحدة تحكّم المتصفّح وحدها. فيُقرأ ذلك السطر هنا.
 */

const REQUIRED = {
  'strict-transport-security': /max-age=\d{7,}/,
  'x-content-type-options': /^nosniff$/,
  'x-frame-options': /^DENY$/,
  'referrer-policy': /strict-origin/,
  'permissions-policy': /camera=\(\)/,
  'cross-origin-opener-policy': /same-origin/,
} as const

/** رسائل وحدة التحكّم التي تدلّ على حجبٍ بالسياسة. */
function violations(messages: ConsoleMessage[]): string[] {
  return messages
    .map((m) => m.text())
    .filter((t) => /Content Security Policy|Refused to (load|execute|apply|connect)/i.test(t))
}

test.describe('ترويسات الأمان', () => {
  test('كلّ ترويسةٍ مطلوبة حاضرةٌ بقيمتها', async ({ request }) => {
    const headers = (await request.get('/')).headers()

    for (const [name, pattern] of Object.entries(REQUIRED)) {
      expect(headers[name], `الترويسة «${name}» غائبة`).toBeDefined()
      expect(headers[name], `«${name}» بقيمةٍ غير متوقّعة`).toMatch(pattern)
    }
  })

  test('سياسة المحتوى تمنع السكربت الدخيل وتُثبِّت الإطار', async ({ request }) => {
    const csp = (await request.get('/')).headers()['content-security-policy']
    expect(csp, 'لا سياسة محتوى').toBeDefined()

    // nonce يتغيّر في كلّ طلب — وثباتُه يعني سياسةً مخزَّنة لا مولَّدة
    expect(csp).toMatch(/'nonce-[a-f0-9]{16,}'/)
    expect(csp).toContain("'strict-dynamic'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("base-uri 'self'")
    // في الإنتاج وحده — والتطوير يحتاج eval لإعادة التحميل الساخن
    expect(csp).not.toContain("'unsafe-eval'")

    const second = (await request.get('/')).headers()['content-security-policy']
    expect(second, 'الـnonce لا يتغيّر بين طلبين').not.toBe(csp)
  })

  test('الصفحات العامّة تعمل بلا خرقٍ للسياسة', async ({ page }) => {
    const messages: ConsoleMessage[] = []
    page.on('console', (m) => messages.push(m))

    for (const path of ['/', '/market', '/how-it-works', '/login']) {
      await page.goto(path)
      await expect(page.locator('#main, main').first()).toBeVisible()
    }

    expect(violations(messages), 'حُجب موردٌ بالسياسة').toHaveLength(0)
  })

  test('صفحات المستخدم تعمل بلا خرقٍ للسياسة', async ({ page }) => {
    const messages: ConsoleMessage[] = []
    page.on('console', (m) => messages.push(m))

    await loginUser(page, USERS.buyer)
    for (const path of ['/account/wallet', '/account/bids', '/account/settings']) {
      await page.goto(path)
      await expect(page.locator('#main, main').first()).toBeVisible()
    }

    expect(violations(messages), 'حُجب موردٌ بالسياسة').toHaveLength(0)
  })

  test('المزايدة اللحظية تصل — والسياسة لا تحجب المقبس', async ({ page }) => {
    const messages: ConsoleMessage[] = []
    page.on('console', (m) => messages.push(m))

    await page.goto('/market')
    const card = page.locator('a[href^="/market/"]').first()
    await card.click()
    await expect(page.locator('#main, main').first()).toBeVisible()

    // يكفي ألّا يُحجب `connect-src`: الوصل نفسه تحرسه فحوص اللحظية
    expect(violations(messages).filter((v) => /connect/i.test(v))).toHaveLength(0)
  })
})
