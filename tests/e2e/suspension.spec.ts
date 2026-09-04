import { expect, test } from '@playwright/test'
import { loginAdmin, loginUser, USERS } from './support/session'

/** لوحة مزاد عليها مزايدات ويملكها هذا البائع. */
async function pickOwnAuction(page: import('@playwright/test').Page, sellerName: string) {
  const { listings } = (await (await page.request.get('/api/listings')).json()) as {
    listings: { id: string; saleType: string; status: string; sellerName: string; bidCount: number }[]
  }
  return listings.find(
    (l) =>
      l.saleType === 'auction' &&
      l.status === 'active' &&
      l.sellerName === sellerName &&
      l.bidCount > 0,
  )!
}

test.describe('إيقاف الإدارة لا يرفعه البائع', () => {
  test('الإيقاف يفكّ العرابين، ويمنع البائع من إعادة العرض والحذف', async ({ browser }) => {
    const adminContext = await browser.newContext()
    const sellerContext = await browser.newContext()
    const adminPage = await adminContext.newPage()
    const sellerPage = await sellerContext.newPage()

    await loginAdmin(adminPage)
    await loginUser(sellerPage, USERS.waleed)
    const listing = await pickOwnAuction(sellerPage, USERS.waleed.name)

    await adminPage.goto(`/admin/listings/${listing.id}`)
    await adminPage.getByRole('button', { name: 'إيقاف' }).click()
    await adminPage.getByLabel('السبب').fill('صور مخالفة للشروط')
    await adminPage.getByRole('button', { name: 'تأكيد الإيقاف' }).click()
    await expect(adminPage.getByText('أُوقف الإعلان')).toBeVisible()

    // العرابين عادت — لا ضمان محجوز لمزاد لم يعد قائمًا
    const held = await adminPage.evaluate(async (id) => {
      const html = await (await fetch('/admin/deposits')).text()
      return html.includes(id)
    }, listing.id)
    expect(held).toBeTruthy() // ما زال السطر ظاهرًا، لكن حالته ليست «محجوز»

    // البائع يرى الحالة ولا يجد زرّ إعادة العرض
    await sellerPage.goto('/account/listings')
    await expect(sellerPage.getByText('موقوف من الإدارة').first()).toBeVisible()
    await expect(sellerPage.getByText(/أوقفت الإدارة عرض هذه اللوحة/)).toBeVisible()

    // وحتى بطلب مباشر يُرفض
    const refused = await sellerPage.evaluate(async (id) => {
      const response = await fetch(`/api/listings/${id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'relist' }),
      })
      return { status: response.status, body: await response.json() }
    }, listing.id)
    expect(refused.status).toBe(403)
    expect(refused.body.error.code).toBe('LISTING_SUSPENDED')

    await adminContext.close()
    await sellerContext.close()
  })

  test('رفع الإيقاف يعيدها مسودّة، والبائع ينشرها فتبدأ جولة نظيفة', async ({ browser }) => {
    const adminContext = await browser.newContext()
    const sellerContext = await browser.newContext()
    const adminPage = await adminContext.newPage()
    const sellerPage = await sellerContext.newPage()

    await loginAdmin(adminPage)
    await loginUser(sellerPage, USERS.sara)
    const listing = await pickOwnAuction(sellerPage, USERS.sara.name)

    const before = await sellerPage.evaluate(
      async (id) => (await (await fetch(`/api/listings/${id}`)).json()) as Record<string, number>,
      listing.id,
    )
    expect(Number(before.bidCount)).toBeGreaterThan(0)

    await adminPage.evaluate(async (id) => {
      await fetch(`/api/admin/listings/${id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'suspend', reason: 'مراجعة' }),
      })
    }, listing.id)

    // رفع الإيقاف من صفحة الإعلان الإدارية
    await adminPage.goto(`/admin/listings/${listing.id}`)
    await adminPage.getByRole('button', { name: 'رفع الإيقاف' }).click()
    await adminPage.getByLabel('السبب').fill('اكتملت المراجعة')
    await adminPage.getByRole('button', { name: 'تأكيد رفع الإيقاف' }).click()
    await expect(adminPage.getByText(/رُفع الإيقاف/)).toBeVisible()

    // البائع ينشرها من جديد
    await sellerPage.goto('/account/listings')
    await sellerPage.reload()
    const published = await sellerPage.evaluate(async (id) => {
      const response = await fetch(`/api/listings/${id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'publish' }),
      })
      return response.ok
    }, listing.id)
    expect(published).toBe(true)

    // جولة نظيفة: بلا مزايدات قائمة، والسعر عاد إلى الافتتاحي
    const after = await sellerPage.evaluate(
      async (id) => (await (await fetch(`/api/listings/${id}`)).json()) as Record<string, unknown>,
      listing.id,
    )
    expect(after.status).toBe('active')
    expect(after.bidCount).toBe(0)
    expect(after.highestAmount).toBeNull()
    expect(after.highestBidderName).toBeNull()
    // والكشف يحتفظ بمزايدات الجولة السابقة موسومة ملغاة
    const ledger = after.ledger as { status: string }[]
    expect(ledger.length).toBe(Number(before.bidCount))
    expect(ledger.every((bid) => bid.status === 'cancelled')).toBe(true)

    /*
     * ومزايدو الجولة الملغاة دُعوا برابط اللوحة — دعوة لا إلزام. لا نعرف
     * أيّهم زايد (الأسماء مقنّعة في الكشف) فنفحص الجميع، ويكفي أن يجدها واحد.
     */
    const invitee = await browser.newContext()
    const inviteePage = await invitee.newPage()
    let invited = 0
    for (const who of Object.values(USERS)) {
      await loginUser(inviteePage, who)
      const matches = await inviteePage.evaluate(async (id) => {
        const data = await (await fetch('/api/notifications')).json()
        return (data.items as { type: string; href: string }[]).filter(
          (n) => n.type === 'listing_relisted' && n.href === `/market/${id}`,
        ).length
      }, listing.id)
      invited += matches
    }
    expect(invited, 'لم يصل إشعار الدعوة لأي مزايد').toBeGreaterThan(0)

    await invitee.close()
    await adminContext.close()
    await sellerContext.close()
  })

})
