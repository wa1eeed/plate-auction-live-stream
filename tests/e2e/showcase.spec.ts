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

    // بابٌ مستقلّ في القائمة، لا زرًّا في صفحة الإدارة
    await page.getByRole('link', { name: 'معرض لوحاتي' }).first().click()
    await expect(page.getByRole('heading', { name: 'معرض لوحاتي' })).toBeVisible()

    /*
     * `/@<المعرّف>` لا `/u/<رقم>`.
     *
     * الرابط يُملى في مجلس ويُكتب في وصف حساب، فكلّ حرفٍ زائد فيه يُقرأ. و`@`
     * وحدها تقول إنّ ما بعدها شخص.
     */
    const showcase = await page
      .getByRole('link', { name: 'معاينة' })
      .getAttribute('href')
    expect(showcase, 'الرابط ليس بصيغة @').toMatch(/^\/@/)

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
    await page.goto('/account/showcase')
    const showcase = (await page.getByRole('link', { name: 'معاينة' }).getAttribute('href'))!

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

    /*
     * والصيغة القديمة `/u/<x>` تبقى عاملة.
     *
     * الروابط تُشارَك في مجموعات وتُحفظ، فمن غيّر معرّفه — أو أرسل رابطًا قبل
     * أن يختار واحدًا — لا تنكسر عليه.
     */
    await page.goto(showcase.replace('/@', '/u/'))
    await expect(page.getByRole('heading', { level: 1 })).toContainText(USERS.waleed.name)
  })
})

test.describe('المعرّف العلنيّ عند التسجيل', () => {
  /*
   * يُختار في النموذج لا بعده.
   *
   * كان يُختار من صفحة المعرض بعد التسجيل، فيبقى صاحبه برابطٍ رقميّ طويل حتى
   * يكتشف تلك الصفحة. والفحص أثناء الكتابة لا عند الإرسال: من ملأ النموذج
   * كلّه ثمّ رُدّ عليه «المعرّف مأخوذ» يعيد قراءة كل حقلٍ ليعرف أين أخطأ.
   */
  test('يُفحص توفّره وأنت تكتب، ويُرفض المأخوذ والمحجوز', async ({ page }) => {
    await page.goto('/register')

    const handle = page.getByLabel('معرّفك')
    await expect(handle).toBeVisible()

    await handle.fill('waleed')
    await expect(page.getByText('مأخوذ — جرّب غيره')).toBeVisible()

    await handle.fill('admin')
    await expect(page.getByText('هذا المعرّف محجوز')).toBeVisible()

    const fresh = `tester${Date.now().toString(36)}`
    await handle.fill(fresh)
    await expect(page.getByText(new RegExp(`متاح`))).toBeVisible()

    // ويصير رابط معرضه فور إنشاء حسابه
    await page.getByLabel('الاسم').fill('سعد التجريبي')
    await page.getByLabel('البريد الإلكتروني').fill(`${fresh}@demo.sa`)
    await page.getByLabel('كلمة المرور').fill('demo1234')
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'إنشاء الحساب' }).click()

    await page.waitForURL(/\/account/, { timeout: 20_000 })
    await page.goto(`/@${fresh}`)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('سعد التجريبي')
  })
})
