import { expect, test } from '@playwright/test'
import { loginUser, USERS } from './support/session'

/**
 * معرض لوحات يُشارَك.
 *
 * صاحب اللوحات يعرضها في مجالسه، ولم يكن له إلا أن يرسل رابط كل لوحة وحدها —
 * أو يرسل السوق كلّه ويقول «ابحث عن اسمي».
 */
test.describe('معرض البائع العام', () => {
  test('يعرض لوحاته ببطاقات السوق، ولا يكشف ما لا يُنشر', async ({ page, browser }) => {
    await loginUser(page, USERS.waleed)
    await page.goto('/account/listings')

    // العنوان صار «إدارة لوحاتي» — تمييزًا عن المعرض الذي يُشارَك
    await expect(page.getByRole('heading', { name: 'إدارة لوحاتي' })).toBeVisible()

    const showcase = await page.getByRole('link', { name: /معرضي العام/ }).getAttribute('href')
    expect(showcase, 'لا رابط للمعرض').toMatch(/^\/u\//)

    /*
     * يُزار بلا حساب: هو صفحةٌ عامّة تُشارَك مع من لا يعرف المنصّة أصلًا.
     */
    const guest = await browser.newContext()
    const visitor = await guest.newPage()
    await visitor.goto(showcase!)

    await expect(visitor.getByRole('heading', { level: 1 })).toContainText(USERS.waleed.name)
    const cards = visitor.locator('article')
    expect(await cards.count()).toBeGreaterThan(0)

    /*
     * ولا يخرج منه ما لا يخرج في السوق.
     *
     * البريد والجوّال بيّنان، و**رقم العضوية** أخفى: يُقتبَس في المراسلة
     * والفواتير، ونشره في صفحةٍ تُشارَك يجعله معلومًا لمن لا يحتاجه.
     */
    const html = await visitor.content()
    expect(html).not.toContain('@demo.sa')
    expect(html, 'رقم العضوية في صفحة عامّة').not.toMatch(/U2\d-\d{5}/)

    await guest.close()
  })

  test('الرجوع من اللوحة يعود إلى المعرض لا إلى السوق', async ({ page }) => {
    await loginUser(page, USERS.waleed)
    await page.goto('/account/listings')
    const showcase = (await page.getByRole('link', { name: /معرضي العام/ }).getAttribute('href'))!

    await page.goto(showcase)
    const first = page.locator('article a').first()
    const href = await first.getAttribute('href')
    // الرابط يحمل أصل الزيارة
    expect(href).toContain('?from=')

    await page.goto(href!)
    /*
     * من فتح رابطًا شاركه صاحب اللوحات لم يمرّ بالسوق ولا يعرفه، فإعادته إليه
     * تُخرجه من حيث دخل.
     */
    const back = page.locator('main a').first()
    await expect(back).toContainText(USERS.waleed.name)
    expect(await back.getAttribute('href')).toBe(showcase)

    // وبلا `from` يعود إلى السوق كما كان
    await page.goto(href!.split('?')[0])
    await expect(page.locator('main a').first()).toHaveAttribute('href', '/market')

    // و`from` لمعرضٍ لا وجود له لا يصنع رابطًا مكسورًا
    await page.goto(`${href!.split('?')[0]}?from=usr_none`)
    await expect(page.locator('main a').first()).toHaveAttribute('href', '/market')
  })
})
