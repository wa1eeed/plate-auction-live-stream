import { expect, test } from '@playwright/test'
import { loginAdmin } from './support/session'

/**
 * صفحات المنصّة تُحرَّر من الإدارة لا من الملفّ.
 *
 * وما يهمّ ليس أنّ الحقل يُحفظ، بل أنّ ما يُكتب في الإدارة هو نفسه ما يقرؤه
 * الزائر — فبين الاثنين مخزنٌ وقالبٌ ومسار، وكلٌّ منها موضع انقطاع.
 */
test.describe('صفحات المنصّة', () => {
  test('«من نحن» و«الشروط» تُعرضان بنصّهما، ومربوطتان في التذييل', async ({ page }) => {
    await page.goto('/about')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('من نحن')

    await page.goto('/terms')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('الشروط والأحكام')

    // ولا تُترك صفحةً لا يبلغها إلا من يعرف رابطها
    await expect(page.getByRole('link', { name: 'من نحن' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'الشروط والأحكام' }).first()).toBeVisible()
  })

  test('ما يُحرَّر في الإدارة يُقرأ في الصفحة العلنية', async ({ page }) => {
    await loginAdmin(page)
    await page.goto('/admin/pages')

    const title = page.getByLabel('عنوان الصفحة').first()
    await expect(title).toBeVisible()
    await title.fill('عن سوق اللوحات')

    await page.getByRole('button', { name: 'احفظ كل الصفحات' }).click()
    await expect(page.getByText('حُفظت صفحات المنصّة')).toBeVisible({ timeout: 15_000 })

    await page.goto('/about')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('عن سوق اللوحات')
  })

  test('قسم الطمأنينة في الواجهة يتبع ما في الإدارة', async ({ page }) => {
    await loginAdmin(page)
    await page.goto('/admin/pages')
    await page.getByRole('tab', { name: /قسم الطمأنينة/ }).click()

    const heading = page.getByLabel('العنوان').first()
    await heading.fill('اشترِ وأنت مطمئن')
    await page.getByRole('button', { name: 'احفظ كل الصفحات' }).click()
    await expect(page.getByText('حُفظت صفحات المنصّة')).toBeVisible({ timeout: 15_000 })

    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'اشترِ وأنت مطمئن' })).toBeVisible()
  })

  /*
   * المخفيّة تُخفى فعلًا.
   *
   * إخفاءٌ يترك الصفحة تُفتح بمن يعرف رابطها ليس إخفاءً، وإنّما هو إزالةٌ من
   * القوائم — وهذا فرقٌ يُكتشف بعد النشر لا قبله.
   */
  test('إخفاء الصفحة يمنعها ولو عُرف رابطها', async ({ page }) => {
    await loginAdmin(page)
    await page.goto('/admin/pages')
    await page.getByRole('tab', { name: /الشروط والأحكام/ }).click()

    await page.getByRole('button', { name: 'ظاهرة للناس' }).click()
    await page.getByRole('button', { name: 'احفظ كل الصفحات' }).click()
    await expect(page.getByText('حُفظت صفحات المنصّة')).toBeVisible({ timeout: 15_000 })

    const response = await page.goto('/terms')
    expect(response?.status()).toBe(404)
  })
})
