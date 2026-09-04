import { expect, test, type Page } from '@playwright/test'
import { loginAdmin, loginUser, USERS } from './support/session'

/**
 * مزاد يستطيع هذا المزايد المزايدة فيه **فعلًا**.
 *
 * لا يكفي أن يكون جاريًا وليس له: العربون شرط دخول، وقد تكون اختبارات سابقة
 * حجزت رصيده. نسأل الخادم عن كل مرشّح حتى نجد ما يملك عربونه أو محجوزًا له.
 */
async function pickBiddableAuction(page: Page, notSeller: string) {
  const { listings } = (await (await page.request.get('/api/listings')).json()) as {
    listings: {
      id: string
      saleType: string
      status: string
      sellerName: string
      bidCount: number
    }[]
  }
  const candidates = listings
    .filter((l) => l.saleType === 'auction' && l.status === 'active' && l.sellerName !== notSeller)
    // مزادٌ عليه مزايدة أولى: أوّل مزايدة تساوي السعر الافتتاحي فيبقى الرقم
    // المعروض كما هو، فلا يُثبت تغيّرُه شيئًا
    .sort((a, b) => b.bidCount - a.bidCount)

  for (const candidate of candidates) {
    const detail = await page.evaluate(
      async (id) =>
        (await (await fetch(`/api/listings/${id}`)).json()) as Record<
          string,
          number | string | boolean
        >,
      candidate.id,
    )
    // من هو الأعلى أصلًا لا يستطيع رفع مزايدته — `ALREADY_HIGHEST`
    if (detail.iAmHighest) continue
    const held = detail.myDepositStatus === 'held'
    const affordable = Number(detail.myAvailableBalance) >= Number(detail.depositAmount)
    if (held || affordable) return candidate
  }
  throw new Error('لا مزاد يستطيع هذا المزايد دخوله')
}

test.describe('المزاد لحظي', () => {
  test('مزايدة من متصفّح آخر تظهر بلا تحديث الصفحة', async ({ browser }) => {
    const watcher = await browser.newContext()
    const bidder = await browser.newContext()
    const watcherPage = await watcher.newPage()
    const bidderPage = await bidder.newPage()

    await loginUser(bidderPage, USERS.majed)
    const auction = await pickBiddableAuction(bidderPage, 'ماجد الشهري')

    // المشاهد زائر عادي على صفحة المزاد
    await watcherPage.goto(`/market/${auction.id}`)
    const price = watcherPage.locator('[data-live-price]').first()
    const ledgerCount = watcherPage.getByText(/\d+ مقبولة/)
    await expect(price).toBeVisible()
    await expect(ledgerCount).toBeVisible()

    // نُثبّت عدّاد التنقّل: أي تحديث للصفحة يزيده فيفضح المزامنة الكاذبة
    const navigationsBefore = await watcherPage.evaluate(
      () => performance.getEntriesByType('navigation').length,
    )
    const ledgerBefore = await ledgerCount.innerText()

    // المزايدة تقع في سياق متصفّح مستقلّ تمامًا
    const placed = await bidderPage.evaluate(async (id) => {
      const detail = await (await fetch(`/api/listings/${id}`)).json()
      const response = await fetch(`/api/listings/${id}/bids`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          amount: detail.nextBidAmount / 100,
          isCustomAmount: false,
          clientRequestId: `e2e-rt-${Date.now()}`,
        }),
      })
      return { ok: response.ok, body: await response.text(), amount: detail.nextBidAmount }
    }, auction.id)
    expect(placed.ok, placed.body).toBe(true)

    /*
     * الكشف هو الدليل القاطع: عدده يزيد مع كل مزايدة مقبولة مهما كان المبلغ.
     * الرقم المعروض وحده لا يكفي — أوّل مزايدة في مزادٍ بلا مزايدات تساوي
     * السعر الافتتاحي، فيبقى النصّ كما هو وإن وصل الحدث.
     */
    await expect(ledgerCount).not.toHaveText(ledgerBefore, { timeout: 6_000 })

    // والسعر المعروض صار مبلغ المزايدة الجديدة
    const expected = new Intl.NumberFormat('en-US').format(placed.amount / 100)
    await expect(price).toContainText(expected)

    // ولا تحديث واحد للصفحة طوال ذلك
    expect(
      await watcherPage.evaluate(() => performance.getEntriesByType('navigation').length),
    ).toBe(navigationsBefore)

    await watcher.close()
    await bidder.close()
  })

  test('كشف المزايدات ينمو لحظيًا عند المشاهد', async ({ browser }) => {
    const watcher = await browser.newContext()
    const bidder = await browser.newContext()
    const watcherPage = await watcher.newPage()
    const bidderPage = await bidder.newPage()

    await loginUser(bidderPage, USERS.waleed)
    const auction = await pickBiddableAuction(bidderPage, 'وليد العتيبي')

    await watcherPage.goto(`/market/${auction.id}`)
    const ledgerCount = watcherPage.getByText(/\d+ مقبولة/)
    await expect(ledgerCount).toBeVisible()
    const before = await ledgerCount.innerText()

    await bidderPage.evaluate(async (id) => {
      const detail = await (await fetch(`/api/listings/${id}`)).json()
      await fetch(`/api/listings/${id}/bids`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          amount: detail.nextBidAmount / 100,
          isCustomAmount: false,
          clientRequestId: `e2e-ledger-${Date.now()}`,
        }),
      })
    }, auction.id)

    await expect(ledgerCount).not.toHaveText(before, { timeout: 6_000 })

    await watcher.close()
    await bidder.close()
  })
})

test.describe('تنقّل لوحة الإدارة', () => {
  test('التنقّل مجمَّع بعناوين أقسامه', async ({ page }) => {
    await loginAdmin(page)
    const nav = page.getByRole('navigation', { name: 'أقسام الإدارة' })
    for (const group of ['التشغيل', 'المال', 'النظام']) {
      await expect(nav.getByText(group, { exact: true })).toBeVisible()
    }
  })

  test('رابط السوق يفتح في نافذة جديدة فلا تُغادر الإدارة لوحتها', async ({ page }) => {
    await loginAdmin(page)
    const market = page.getByRole('banner').getByRole('link', { name: /عرض السوق/ })
    await expect(market).toHaveAttribute('target', '_blank')
    await expect(market).toHaveAttribute('rel', /noopener/)
  })

  test('اللوحة في جداول الإدارة تفتح صفحة الإعلان الإدارية لا السوق', async ({ page }) => {
    await loginAdmin(page)
    await page.goto('/admin/deposits')

    const plate = page.locator('tbody a[href^="/admin/listings/"]').first()
    await expect(plate).toBeVisible()
    await plate.click()
    await page.waitForURL(/\/admin\/listings\/[^/]+$/)

    // ما زلنا داخل اللوحة: التنقّل الإداري حاضر
    await expect(page.getByRole('navigation', { name: 'أقسام الإدارة' })).toBeVisible()
  })
})

test.describe('صفحة الإعلان في الإدارة', () => {
  test('تعرض المزاد وكشفه ومشاركيه، والاحتياطي ظاهر للإدارة وحدها', async ({ page }) => {
    await loginAdmin(page)

    // مزاد بعينه: البيع المباشر بلا سعر احتياطي فلا تصلح بطاقته للفحص
    const { listings } = (await (await page.request.get('/api/listings')).json()) as {
      listings: { id: string; saleType: string; status: string }[]
    }
    const auction = listings.find((l) => l.saleType === 'auction' && l.status === 'active')!
    await page.goto(`/admin/listings/${auction.id}`)

    for (const tab of ['كشف المزايدات', 'المشاركون', 'العرابين', 'العروض والصفقات']) {
      await expect(page.getByRole('tab', { name: new RegExp(tab) })).toBeVisible()
    }

    // الاحتياطي سرٌّ عن المزايدين لا عمّن يفصل بينهم
    await expect(page.getByText('السعر الاحتياطي')).toBeVisible()

    // وفيها رابط المشاهدة الحيّة في نافذة جديدة
    const live = page.getByRole('link', { name: /مشاهدة حيّة في السوق/ })
    await expect(live).toHaveAttribute('target', '_blank')
    await expect(live).toHaveAttribute('href', /^\/market\//)
  })

  test('تُفتح برقم الإعلان وبالمعرّف الداخلي معًا', async ({ page }) => {
    await loginAdmin(page)

    const html = await page.evaluate(async () => (await fetch('/admin/listings')).text())
    const reference = html.match(/L\d{2}-\d{5}/)![0]
    const internalId = html.match(/lst_[a-z0-9]{10,}/)![0]

    await page.goto(`/admin/listings/${reference}`)
    await expect(page.getByRole('tab', { name: /كشف المزايدات/ })).toBeVisible()

    await page.goto(`/admin/listings/${internalId}`)
    await expect(page.getByRole('tab', { name: /كشف المزايدات/ })).toBeVisible()
  })
})
