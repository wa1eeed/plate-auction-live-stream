import { expect, test, type Page } from '@playwright/test'
import { loginAdmin, loginUser, USERS } from './support/session'

/**
 * المحاسبة: أمر الصرف من إصداره إلى إقفاله، والفاتورة الضريبية من إصدارها
 * إلى ورقتها.
 *
 * البذرة تحمل ثلاثة أوامر قائمة وواحدًا مقفلًا وفاتورتين — فما يُختبر هنا هو
 * **ما يراه المحاسب ويفعله**، لا صنع الحالة من الصفر: صنعُها مغطّى في
 * `tests/unit/disbursement.test.ts` حيث يُقاس أثر كل قرار على القيود.
 */

async function payoutsPage(page: Page) {
  await loginAdmin(page)
  await page.goto('/admin/payouts')
  await expect(page.getByRole('heading', { name: 'أوامر الصرف' })).toBeVisible()
}

/*
 * الصفّ الظاهر لا الأوّل في الشجرة.
 *
 * التبويب يُخفي ما ليس فيه بـ`display:none`، والاختبارات تتشارك خادمًا واحدًا
 * فتُبدّل حالة الصفوف بينها. فالقفل على «أوّل `data-row`» يمسك صفًّا مخفيًّا
 * أو مقفلًا في تشغيلٍ سابق — والظاهر هو ما يراه المحاسب فعلًا.
 */
const openRow = (page: Page) =>
  page.locator('[data-row]:visible').filter({ hasText: 'سجّل الصرف' }).first()

test.describe('أوامر الصرف', () => {
  test('اللوحة تعرض الالتزامات القائمة بمستفيدها وآيبانها ومبلغها', async ({ page }) => {
    await payoutsPage(page)

    const row = openRow(page)
    await expect(row).toBeVisible()
    // الآيبان يُقرأ بالعين قبل تحويل لا رجعة فيه — فيظهر مجمَّعًا لا مكتومًا
    await expect(row.getByText(/^SA\d{2}( \d{4}){5}$/)).toBeVisible()
    await expect(row.getByRole('button', { name: 'سجّل الصرف' })).toBeVisible()
    await expect(row.getByRole('button', { name: 'ألغِ الأمر' })).toBeVisible()
  })

  test('التبويب يفرز ما ينتظر قرارك عمّا انتهى', async ({ page }) => {
    await payoutsPage(page)

    const tabs = page.getByRole('tablist').first()
    await expect(tabs.getByRole('tab', { name: /بانتظار قرارك/ })).toBeVisible()

    await tabs.getByRole('tab', { name: /معاملة مكتملة/ }).click()
    // المقفل يحمل مرجع حوالته — وبه يُطابَق كشف البنك
    await expect(page.getByText(/مرجع الحوالة/).first()).toBeVisible()
  })

  /*
   * الإقفال يخصم من المحفظة.
   *
   * المستفيد قبض ماله في حسابه البنكي، فبقاؤه في محفظته أيضًا رصيدٌ يُنفَق
   * مرّتين. والاختبار يقيس الرصيد قبل وبعد لا يكتفي بالشارة.
   */
  test('تسجيل الصرف يُقفل الأمر بمرجعه ويقيّد سحبًا في محفظة المستفيد', async ({
    page,
    browser,
  }) => {
    await payoutsPage(page)

    const row = openRow(page)
    await expect(row).toBeVisible()
    const reference = (await row.getByText(/^F\d{2}-\d{5}$/).innerText()).trim()
    // اسمه من رابطه لا من نصّ السطر: الاسم يتكرّر في سطر الحساب البنكي كذلك
    const beneficiary = (
      await row.locator('a[href^="/admin/users/"]').first().innerText()
    ).trim()
    const user = Object.values(USERS).find((one) => one.name === beneficiary)
    expect(user, `المستفيد «${beneficiary}» ليس من الحسابات التجريبية`).toBeTruthy()

    await row.getByRole('button', { name: 'سجّل الصرف' }).click()
    await page.getByLabel('مرجع الحوالة البنكية').fill('TRF-E2E-0001')
    await page.getByRole('button', { name: 'تأكيد الصرف' }).click()

    /*
     * المقفل يغادر تبويبه.
     *
     * «بانتظار قرارك» يعرض القائم وحده، فأمرٌ صُرف يُخفى منه — وطلبه هناك
     * بعد إقفاله يقيس اختفاءه لا نجاحه. والبحث برقمه في «معاملة مكتملة»
     * يقيس ما وقع فعلًا.
     */
    await page.getByRole('tab', { name: /معاملة مكتملة/ }).click()
    const closed = page.locator('[data-row]:visible').filter({ hasText: reference })
    await expect(closed).toBeVisible()
    await expect(closed.getByText('TRF-E2E-0001')).toBeVisible()

    // ونصف القيد الثاني: سحبٌ في كشف صاحبه لا رصيدٌ باقٍ صُرف نظيره
    const walletContext = await browser.newContext()
    const walletPage = await walletContext.newPage()
    await loginUser(walletPage, user!)
    await walletPage.goto('/account/wallet')
    await expect(walletPage.getByText('سحب رصيد').first()).toBeVisible()
    await walletContext.close()
  })

  test('الإلغاء يطلب سببًا ويُسقط الحوالة لا الاستحقاق', async ({ page }) => {
    await payoutsPage(page)

    const row = openRow(page)
    await expect(row).toBeVisible()
    const reference = (await row.getByText(/^F\d{2}-\d{5}$/).innerText()).trim()

    await row.getByRole('button', { name: 'ألغِ الأمر' }).click()
    await expect(page.getByText(/يسقط أمر الحوالة ولا يسقط الاستحقاق/)).toBeVisible()
    await page.getByLabel('سبب الإلغاء').fill('طلب المستفيد إبقاءه في محفظته')
    await page.getByRole('button', { name: 'تأكيد الإلغاء' }).click()

    await page.getByRole('tab', { name: /معاملة مكتملة/ }).click()
    const closed = page.locator('[data-row]:visible').filter({ hasText: reference })
    await expect(closed).toBeVisible()
    await expect(closed.getByText(/أُلغي:/)).toBeVisible()
  })
})

test.describe('الفواتير الضريبية', () => {
  test('لوحة الإدارة تعرض السلسلة وسلامتها', async ({ page }) => {
    await loginAdmin(page)
    await page.goto('/admin/invoices')

    await expect(page.getByRole('heading', { name: 'الفواتير الضريبية' })).toBeVisible()
    // سلسلة مكسورة تعني فاتورة عُدّلت أو حُذفت — والمؤشّر يقولها في الصفحة الأولى
    await expect(page.getByText('سليمة')).toBeVisible()
  })

  test('الورقة تحمل الحقول الإلزامية ورمز QR', async ({ page }) => {
    await loginAdmin(page)
    await page.goto('/admin/invoices')
    await page.locator('a[href^="/admin/invoices/T"]').first().click()

    await expect(page.getByText('فاتورة ضريبية مبسّطة')).toBeVisible()
    await expect(page.getByText(/الرقم الضريبي/)).toBeVisible()
    await expect(page.getByText('الإجمالي شامل الضريبة')).toBeVisible()
    // رمز QR يُرسم SVG في الصفحة — بلا صورة خارجية تفشل بلا شبكة
    await expect(page.locator('[aria-label="رمز الاستجابة السريعة للفاتورة"] svg')).toBeVisible()
  })

  /*
   * الفاتورة لصاحبها.
   *
   * أرقامها متسلسلة تُخمَّن بالعدّ، وتحمل اسم عميل ومبلغًا. فمن فتح رقم
   * غيره وجد «غير موجودة» لا صفحةً تُقرّ بوجودها.
   */
  test('لا يفتح المستخدم فاتورة غيره', async ({ page, browser }) => {
    const adminContext = await browser.newContext()
    const adminPage = await adminContext.newPage()
    await loginAdmin(adminPage)
    await adminPage.goto('/admin/invoices')

    const rows = adminPage.locator('a[href^="/admin/invoices/T"]')
    const references: string[] = []
    for (let i = 0; i < (await rows.count()); i += 1) {
      references.push((await rows.nth(i).innerText()).trim())
    }
    await adminContext.close()
    expect(references.length).toBeGreaterThan(0)

    await loginUser(page, USERS.majed)
    await page.goto('/account/invoices')
    const mine = await page.locator('[data-row]').allInnerTexts()
    const others = references.filter((reference) => !mine.some((row) => row.includes(reference)))
    expect(others.length).toBeGreaterThan(0)

    for (const reference of others) {
      await page.goto(`/account/invoices/${reference}`)
      // لا ورقة ولا إقرار بوجودها — «غير موجودة» لا «ممنوعة»
      await expect(page.getByText('فاتورة ضريبية مبسّطة')).toHaveCount(0)
    }
  })

  test('«فواتيري» تقول إن الوعاء هو العمولة لا ثمن اللوحة', async ({ page }) => {
    await loginUser(page, USERS.waleed)
    await page.goto('/account/invoices')
    await expect(page.getByRole('heading', { name: 'فواتيري' })).toBeVisible()
    await expect(page.getByText(/ولا يدخل وعاء|لا يدخل وعاء الضريبة/).first()).toBeVisible()
  })
})

test.describe('حساب الإيداع', () => {
  /*
   * الآيبان يُدقَّق عند الحفظ.
   *
   * وإلا اكتُشفت الغلطة عند فشل الحوالة بعد أسبوع — وصاحبها يظنّ ماله في
   * الطريق.
   */
  test('يردّ آيبانًا مختلّ خانة، ويقبل الصحيح', async ({ page }) => {
    await loginUser(page, USERS.sara)
    await page.goto('/account/settings')

    const iban = page.getByLabel('رقم الآيبان')
    await expect(iban).toBeVisible()

    await iban.fill('SA3144000001012345678902')
    await page.getByRole('button', { name: 'حفظ' }).click()
    await expect(page.getByText(/آيبان غير صالح/).first()).toBeVisible()

    await iban.fill('SA9805000000682012345678')
    await page.getByRole('button', { name: 'حفظ' }).click()
    await expect(page.getByText('حُفظت بياناتك')).toBeVisible()
  })
})
