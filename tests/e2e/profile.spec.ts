import { expect, test } from '@playwright/test'
import { loginAdmin, loginUser, USERS } from './support/session'

test.describe('الجوال وحسابات التواصل', () => {
  test('نموذج التسجيل يحمل الجوال والحسابات الثلاثة اختيارية', async ({ page }) => {
    await page.goto('/register')

    await expect(page.getByLabel(/رقم الجوال/)).toBeVisible()

    // مطويّة كي لا تُثقل نموذج تسجيل، ومفتوحها يجد الثلاثة
    await page.getByText('حسابات التواصل (اختيارية)').click()
    for (const label of ['تيك توك', 'سناب شات', 'إنستقرام']) {
      await expect(page.getByLabel(label)).toBeVisible()
    }
  })

  test('المستخدم يحفظ حساباته فتظهر للإدارة', async ({ browser }) => {
    const userContext = await browser.newContext()
    const adminContext = await browser.newContext()
    const userPage = await userContext.newPage()
    const adminPage = await adminContext.newPage()

    await loginUser(userPage, USERS.sara)
    await userPage.goto('/account/settings')

    const handle = `sara.live${Date.now().toString().slice(-5)}`
    // يُقبل الرابط الكامل كما يُقبل الاسم — الناس تلصق ما تنسخه
    await userPage.getByLabel('تيك توك').fill(`https://www.tiktok.com/@${handle}`)
    await userPage.getByLabel('سناب شات').fill(`@${handle}`)
    await userPage.getByRole('button', { name: 'حفظ' }).click()
    await expect(userPage.getByText('حُفظت بياناتك')).toBeVisible()

    // خُزّنت بلا @ وبلا رابط — شكل واحد لا شكلان للحساب نفسه
    await userPage.reload()
    await expect(userPage.getByLabel('تيك توك')).toHaveValue(handle)
    await expect(userPage.getByLabel('سناب شات')).toHaveValue(handle)

    await loginAdmin(adminPage)
    await adminPage.goto('/admin/users')
    await adminPage.getByRole('link', { name: new RegExp(USERS.sara.name) }).first().click()
    await adminPage.waitForURL(/\/admin\/users\/U\d{2}-\d{5}/)

    const card = adminPage.getByRole('heading', { name: 'وسائل التواصل' }).locator('..')
    await expect(card.getByText(`@${handle}`).first()).toBeVisible()
    // الرابط يفتح في نافذة جديدة ويقود إلى المنصّة نفسها
    const tiktok = card.getByRole('link', { name: /تيك توك/ })
    await expect(tiktok).toHaveAttribute('target', '_blank')
    await expect(tiktok).toHaveAttribute('href', new RegExp(`tiktok\\.com/@${handle}$`))

    await userContext.close()
    await adminContext.close()
  })

  test('جوال المستخدم يظهر للإدارة قابلًا للاتصال، ولا يظهر في السوق', async ({ page }) => {
    await loginAdmin(page)
    await page.goto('/admin/users')
    await page.getByRole('link', { name: new RegExp(USERS.waleed.name) }).first().click()
    await page.waitForURL(/\/admin\/users\/U\d{2}-\d{5}/)

    const phoneLink = page.getByRole('link', { name: /\+?9665\d{8}/ }).first()
    await expect(phoneLink).toBeVisible()
    await expect(phoneLink).toHaveAttribute('href', /^tel:/)

    // وحمولة السوق العامّة خالية منه
    const payload = await page.evaluate(async () => {
      const { listings } = await (await fetch('/api/listings')).json()
      const detail = await (await fetch(`/api/listings/${listings[0].id}`)).json()
      return JSON.stringify(detail)
    })
    expect(payload).not.toMatch(/\+?9665\d{8}/)
  })

  test('صفحة الإعلان الإدارية تعرض تواصل البائع وجوّال المزايدين', async ({ page }) => {
    await loginAdmin(page)
    const { listings } = (await (await page.request.get('/api/listings')).json()) as {
      listings: { id: string; saleType: string; status: string; bidCount: number }[]
    }
    const auction = listings.find(
      (l) => l.saleType === 'auction' && l.status === 'active' && l.bidCount > 0,
    )!

    await page.goto(`/admin/listings/${auction.id}`)
    await expect(page.getByRole('heading', { name: 'وسائل التواصل' })).toBeVisible()
    await expect(page.getByText('جوّاله')).toBeVisible()

    await page.getByRole('tab', { name: /المشاركون/ }).click()
    await expect(page.getByRole('columnheader', { name: 'التواصل' })).toBeVisible()
  })
})

test.describe('صفحة الإعلان على الجوال', () => {
  test('السعر تحت اللوحة مباشرة — قبل الوصف والكشف', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    const { listings } = (await (await page.request.get('/api/listings')).json()) as {
      listings: { id: string; saleType: string; status: string }[]
    }
    const auction = listings.find((l) => l.saleType === 'auction' && l.status === 'active')!

    await page.goto(`/market/${auction.id}`)
    // ينتظر اللوحة نفسها لا تحميل المستند: الصفحة تُصيَّر بعد هيكل انتظار
    await expect(page.locator('svg[data-plate-type]').first()).toBeVisible()

    const order = await page.evaluate(() => {
      const y = (selector: string) => {
        const el = document.querySelector(selector)
        return el ? Math.round(el.getBoundingClientRect().top) : NaN
      }
      return {
        plate: y('svg[data-plate-type]'),
        price: y('[data-live-price]'),
      }
    })
    expect(order.plate).toBeLessThan(order.price)

    // والسعر داخل أوّل شاشة بلا تمرير — هو المقصود عند البثّ والمشاركة
    const priceTop = await page
      .locator('[data-live-price]')
      .first()
      .evaluate((el) => Math.round(el.getBoundingClientRect().top))
    expect(priceTop).toBeLessThan(812)

    /*
     * وما دونهما بعدهما لا قبلهما.
     *
     * كان اسم البائع هو ما يُقاس به هذا الترتيب، وقد حُذف من الصفحة: لا
     * يُقرَّر به شراء لوحة. وكشف المزايدات حلّ محلّه — وهو أولى بالموضع لأنّه
     * سجلّ ما يُقرَّر به.
     */
    const ledgerTop = await page
      .getByRole('heading', { name: 'كشف المزايدات' })
      .evaluate((el) => Math.round(el.getBoundingClientRect().top))
    expect(ledgerTop).toBeGreaterThan(priceTop)

    // واسم البائع لم يعد في الصفحة أصلًا
    await expect(page.getByText('البائع', { exact: true })).toHaveCount(0)
  })

  test('الحاسوب يبقى عمودين بلا فجوة تحت اللوحة', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const { listings } = (await (await page.request.get('/api/listings')).json()) as {
      listings: { id: string; saleType: string; status: string }[]
    }
    const auction = listings.find((l) => l.saleType === 'auction' && l.status === 'active')!
    await page.goto(`/market/${auction.id}`)

    const gap = await page.evaluate(() => {
      const grid = document.querySelector('.grid.gap-6')!
      const [plate, details] = [...grid.children]
      return Math.round(
        details.getBoundingClientRect().top - plate.getBoundingClientRect().bottom,
      )
    })
    // فجوة الشبكة وحدها (24px) لا فراغ ناتج عن امتداد العمود على صفّين
    expect(gap).toBeLessThanOrEqual(32)
  })
})
