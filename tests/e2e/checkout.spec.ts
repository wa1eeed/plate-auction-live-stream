import { expect, test, type Page } from '@playwright/test'
import { loginAdmin, loginUser, USERS } from './support/session'

async function setCommission(page: Page, buyerPercent: number, vatPercent: number) {
  const result = await page.evaluate(
    async ([percent, vat]) => {
      const response = await fetch('/api/admin/settings/commission', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          seller: { enabled: false, mode: 'percent', percent: 0, fixed: 0, min: 0, max: 0 },
          buyer: { enabled: true, mode: 'percent', percent, fixed: 0, min: 0, max: 0 },
          vatEnabled: vat > 0,
          vatPercent: vat,
        }),
      })
      return { ok: response.ok, body: await response.text() }
    },
    [buyerPercent, vatPercent],
  )
  expect(result.ok, result.body).toBe(true)
}

test.describe('صفحة السداد', () => {
  test('البريك داون يشمل العمولة وضريبتها، والمجموع مطابق', async ({ browser }) => {
    const adminContext = await browser.newContext()
    const buyerContext = await browser.newContext()
    const adminPage = await adminContext.newPage()
    const buyerPage = await buyerContext.newPage()

    await loginAdmin(adminPage)
    await setCommission(adminPage, 2.5, 15)

    await loginUser(buyerPage, USERS.majed)
    await buyerPage.goto('/account/purchases')

    // زرّ «أكمل السداد» ينقل إلى صفحة السداد
    const pay = buyerPage.getByRole('link', { name: 'أكمل السداد' }).first()
    await expect(pay).toBeVisible()
    await pay.click()
    await buyerPage.waitForURL(/\/checkout\/ord_/)

    await expect(buyerPage.getByRole('heading', { name: 'إتمام السداد' })).toBeVisible()

    // البريك داون كامل: القيمة، العربون، العمولة، الضريبة، المطلوب
    for (const label of [
      'قيمة الصفقة',
      'عمولة المنصّة',
      'ضريبة القيمة المضافة (على العمولة)',
      'المطلوب سداده',
    ]) {
      await expect(buyerPage.getByText(label, { exact: true })).toBeVisible()
    }

    // والمجموع = القيمة − العربون + العمولة + الضريبة
    const numbers = await buyerPage.evaluate(() => {
      const read = (label: string) => {
        const dt = [...document.querySelectorAll('dt')].find(
          (el) => el.textContent?.trim() === label,
        )
        const raw = dt?.nextElementSibling?.textContent?.replace(/[^\d.]/g, '') ?? ''
        return Number(raw)
      }
      return {
        amount: read('قيمة الصفقة'),
        commission: read('عمولة المنصّة'),
        vat: read('ضريبة القيمة المضافة (على العمولة)'),
        due: read('المطلوب سداده'),
        deposit: Number(
          [...document.querySelectorAll('dt')]
            .find((el) => el.textContent?.includes('العربون'))
            ?.nextElementSibling?.textContent?.replace(/[^\d.]/g, '') ?? 0,
        ),
      }
    })
    expect(numbers.commission).toBeGreaterThan(0)
    expect(numbers.vat).toBeGreaterThan(0)
    expect(numbers.due).toBeCloseTo(
      numbers.amount - numbers.deposit + numbers.commission + numbers.vat,
      2,
    )

    await adminContext.close()
    await buyerContext.close()
  })

  test('وسيلة معطّلة تُعرض بسببها ولا تُخفى', async ({ page }) => {
    await loginUser(page, USERS.majed)
    await page.goto('/account/purchases')
    await page.getByRole('link', { name: 'أكمل السداد' }).first().click()
    await page.waitForURL(/\/checkout\/ord_/)

    // داخل نموذج السداد وحده — الترويسة فيها أزرار `aria-pressed` أخرى
    const methods = page.locator('form button[aria-pressed]')
    expect(await methods.count()).toBe(3)
    // كلٌّ يحمل سببًا أو حالًا — لا زرّ صامت
    for (let index = 0; index < 3; index += 1) {
      await expect(methods.nth(index)).not.toBeEmpty()
    }
  })

  test('السداد من المحفظة يحجز المبلغ وينقل إلى صفحة الشكر', async ({ browser }) => {
    const adminContext = await browser.newContext()
    const buyerContext = await browser.newContext()
    const adminPage = await adminContext.newPage()
    const buyerPage = await buyerContext.newPage()

    await loginAdmin(adminPage)
    await loginUser(buyerPage, USERS.majed)

    // نشحن رصيده ليكفي
    const userId = await adminPage.evaluate(async () => {
      const html = await (await fetch('/admin/users/U26-00003')).text()
      return html.match(/usr_[a-z0-9]{10,}/)?.[0] ?? null
    })
    await adminPage.evaluate(async (id) => {
      await fetch(`/api/admin/users/${id}/wallet`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'topup', amount: 80_000, note: 'اختبار السداد' }),
      })
    }, userId)

    await buyerPage.goto('/account/purchases')
    await buyerPage.getByRole('link', { name: 'أكمل السداد' }).first().click()
    await buyerPage.waitForURL(/\/checkout\/ord_/)

    await buyerPage.locator('form button[aria-pressed]').first().click()
    await buyerPage.getByRole('button', { name: /ادفع من رصيدي/ }).click()

    // صفحة الشكر، ومعها رقم العملية وزرّ الانتقال للطلب
    await buyerPage.waitForURL(/\/checkout\/ord_[a-z0-9]+\/thanks/)
    await expect(buyerPage.getByRole('heading', { name: 'تمّ سدادك بنجاح' })).toBeVisible()
    // ويقول صراحةً إن المال محجوز لا مُفرَج — وإلا ظنّ المشتري اللوحة ملكه
    await expect(buyerPage.getByText(/محفوظ لدى المنصّة/).first()).toBeVisible()
    await expect(buyerPage.getByText(/P\d{2}-\d{5}/)).toBeVisible()

    const toOrder = buyerPage.getByRole('link', { name: 'عرض الطلب' })
    await expect(toOrder).toBeVisible()
    await toOrder.click()
    // الرابط يحمل القسم الذي صارت فيه المعاملة، فلا يبحث عنها من سدّد للتوّ
    await buyerPage.waitForURL(/\/account\/purchases\?stage=running/)
    await expect(buyerPage.getByText(/المبلغ محجوز/).first()).toBeVisible()

    await adminContext.close()
    await buyerContext.close()
  })
})
