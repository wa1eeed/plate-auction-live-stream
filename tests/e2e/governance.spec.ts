import { loginAdmin, loginUser, USERS } from './support/session'
import { expect, test, type Cookie, type Page } from '@playwright/test'

const USER = USERS.waleed




test.describe('حوكمة موحّدة للمزادات', () => {
  test('نموذج الإدراج يعرض قواعد المنصّة ولا يسمح بتعديلها', async ({ page }) => {
    await loginUser(page)
    await page.goto('/account/listings/new')

    await page.getByRole('button', { name: /^مزاد/ }).click()

    // القواعد معروضة ليعرفها البائع — وأوّلها ما يُقتطع منه
    const notice = page.getByText('قواعد المنصّة المطبَّقة على عرضك').locator('..')
    await expect(notice).toContainText('عمولة المنصّة عليك')
    await expect(notice).toContainText('العربون المطلوب من كل مزايد')
    await expect(notice).toContainText('مهلة سداد المشتري')
    await expect(notice).toContainText('التمديد التلقائي')

    // وتُقال لصاحب البيع المباشر أيضًا، بلا صفوف المزاد
    await page.getByRole('button', { name: /^بيع مباشر/ }).click()
    const fixed = page.getByText('قواعد المنصّة المطبَّقة على عرضك').locator('..')
    await expect(fixed).toContainText('عمولة المنصّة عليك')
    await expect(fixed).not.toContainText('التمديد التلقائي')
    await page.getByRole('button', { name: /^مزاد/ }).click()

    // ولا حقل واحد منها قابل للتحرير
    for (const label of [/العربون/, /مهلة السداد/, /مدّة التمديد/, /نافذة التمديد/]) {
      expect(await page.getByLabel(label).count(), `حقل قابل للتحرير: ${label}`).toBe(0)
    }

    // السعر الافتتاحي يقبل صفرًا، والاحتياطي معه شرحه
    await page.getByLabel('السعر الافتتاحي (ريال)').fill('0')
    await expect(page.getByText('ما السعر الاحتياطي؟')).toBeVisible()
  })

  test('حروف اللوحة ثلاث قوائم تحمل الحرف ومقابله اللاتيني', async ({ page }) => {
    await loginUser(page)
    await page.goto('/account/listings/new')

    const first = page.getByLabel('الحرف 1')
    const second = page.getByLabel('الحرف 2')
    const third = page.getByLabel('الحرف 3')
    await expect(first).toBeVisible()

    // ما بعد الخانة الأولى مقفل حتى تُملأ
    await expect(second).toBeDisabled()

    await first.click()
    // كل خيار يحمل الحرف العربي ومقابله اللاتيني
    await expect(page.getByRole('option', { name: /ا\s*A/ })).toBeVisible()
    await expect(page.getByRole('option', { name: /ص\s*X/ })).toBeVisible()
    await expect(page.getByRole('option', { name: /م\s*Z/ })).toBeVisible()
    await page.getByRole('option', { name: /ا\s*A/ }).click()

    await expect(second).toBeEnabled()
    await second.click()
    await page.getByRole('option', { name: /ب\s*B/ }).click()

    // الحروف اللاتينية تُشتقّ تلقائيًا من الجدول المعتمد
    await expect(page.locator('svg[data-plate-letters="اب"]').first()).toBeVisible()
    await expect(page.getByLabel('الحروف اللاتينية')).toHaveText('AB')

    await expect(third).toBeEnabled()
    await third.click()
    await page.getByRole('option', { name: /ح\s*J/ }).click()
    await expect(page.getByLabel('الحروف اللاتينية')).toHaveText('ABJ')

    // إفراغ خانة يُسقط ما بعدها: «ا _ ح» ليست لوحة صالحة
    await second.click()
    await page.getByRole('option', { name: 'بلا حرف' }).click()
    await expect(page.getByLabel('الحروف اللاتينية')).toHaveText('A')
    await expect(page.locator('svg[data-plate-letters="ا"]').first()).toBeVisible()
  })

  test('إعدادات المزاد في الإدارة تُغيّر العربون المعروض للبائع', async ({ browser }) => {
    const adminContext = await browser.newContext()
    const userContext = await browser.newContext()
    const adminPage = await adminContext.newPage()
    const userPage = await userContext.newPage()

    await loginAdmin(adminPage)
    await adminPage.goto('/admin/settings')
    await adminPage.getByRole('tab', { name: 'قواعد المزاد' }).click()
    await expect(adminPage.getByRole('heading', { name: 'العربون' })).toBeVisible()

    await adminPage.getByLabel('مهلة سداد الفائز (ساعة)').fill('96')
    await adminPage.getByRole('button', { name: 'حفظ قواعد المزاد' }).click()
    await expect(adminPage.getByText('حُفظت قواعد المزاد').first()).toBeVisible()

    await loginUser(userPage)
    await userPage.goto('/account/listings/new')
    await userPage.getByRole('button', { name: /^مزاد/ }).click()
    await expect(userPage.getByText('96 ساعة')).toBeVisible()

    // نُعيد القيمة الافتراضية كي لا تتسرّب بين الاختبارات.
    // نتحقّق من أثرها على صفحة البائع لا من ظهور إشعار: الإشعار الأول قد يكون
    // ما زال معروضًا فيُطابق الثاني وهْمًا.
    await adminPage.getByLabel('مهلة سداد الفائز (ساعة)').fill('48')
    await adminPage.getByRole('button', { name: 'حفظ قواعد المزاد' }).click()

    await userPage.reload()
    await userPage.getByRole('button', { name: /^مزاد/ }).click()
    await expect(userPage.getByText('48 ساعة')).toBeVisible()

    await adminContext.close()
    await userContext.close()
  })
})

test.describe('كشف المزايدات', () => {
  test('يحمل ختمًا زمنيًا كاملًا بتوقيت جهاز المستخدم', async ({ page }) => {
    const { listings } = (await (await page.request.get('/api/listings')).json()) as {
      listings: { id: string; saleType: string; status: string; bidCount: number }[]
    }
    const auction = listings.find(
      (l) => l.saleType === 'auction' && l.status === 'active' && l.bidCount > 0,
    )!

    await page.goto(`/market/${auction.id}`)
    const ledger = page.getByRole('heading', { name: 'كشف المزايدات' }).locator('..')

    // المنطقة الزمنية مذكورة صراحة، والوقت عنصر <time> بقيمة ISO
    await expect(ledger).toContainText(/بتوقيت/)
    const stamp = page.locator('time[datetime]').first()
    await expect(stamp).toBeVisible()
    expect(await stamp.getAttribute('datetime')).toMatch(/^\d{4}-\d{2}-\d{2}T/)

    // والنصّ المعروض يتبع منطقة الجهاز لا منطقة الخادم
    const iso = (await stamp.getAttribute('datetime'))!
    const hhmm = await page.evaluate(
      (value) =>
        new Intl.DateTimeFormat('ar-SA-u-nu-latn', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(new Date(value)),
      iso,
    )
    expect(await stamp.innerText()).toContain(hhmm)
  })
})

test('مهل الضمان تُضبط من اللوحة وتسري على ما يُنشَر بعدها', async ({ page }) => {
  /*
   * كانتا ثابتتين في الكود بينما قيل إنهما قابلتان للضبط — فيبحث عنهما
   * الأدمن ولا يجدهما.
   */
  await loginAdmin(page)
  await page.goto('/admin/settings')

  await expect(page.getByLabel('مهلة نقل الملكية (ساعة)')).toBeVisible()
  const review = page.getByLabel('مهلة مراجعة الإدارة (ساعة)')
  await expect(review).toBeVisible()

  await review.fill('96')
  await page.getByRole('button', { name: /حفظ/ }).first().click()
  await expect(page.getByText(/حُفظت|تم الحفظ/).first()).toBeVisible()

  await page.reload()
  await expect(page.getByLabel('مهلة مراجعة الإدارة (ساعة)')).toHaveValue('96')
})
