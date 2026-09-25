import { expect, test } from './support/hydrated'
import { type Page } from '@playwright/test'
import { stableCount } from '../support/ui'

const USERS = {
  waleed: { email: 'waleed@demo.sa', password: 'demo1234', name: 'وليد العتيبي' },
  sara: { email: 'sara@demo.sa', password: 'demo1234', name: 'سارة القحطاني' },
  majed: { email: 'majed@demo.sa', password: 'demo1234', name: 'ماجد الشهري' },
}

async function login(page: Page, user: { email: string; password: string }) {
  await page.goto('/login')
  await page.getByLabel('البريد الإلكتروني').fill(user.email)
  await page.getByLabel('كلمة المرور').fill(user.password)
  await page.getByRole('button', { name: 'دخول', exact: true }).click()
  await page.waitForURL('**/account')
}

/**
 * يجلب إعلانًا بطريقة بيع معيّنة لا يملكها المستخدم الحالي.
 *
 * و`last` ليس ترفًا: اختباران يقبلان عرضًا على الإعلان نفسه يتعارضان —
 * الأوّلُ يترك صفقةً تنتظر سدادها، والمنصّةُ لا تقبل ثانيةً على لوحةٍ واحدة
 * حتى تُسدَّد الأولى. فيأخذ كلٌّ طرفًا من القائمة.
 */
async function findListing(
  page: Page,
  saleType: 'auction' | 'fixed' | 'offers',
  excludeSeller: string,
  options: { last?: boolean } = {},
) {
  const response = await page.request.get('/api/listings')
  const { listings } = (await response.json()) as {
    listings: { id: string; saleType: string; status: string; sellerName: string }[]
  }
  const matches = listings.filter(
    (l) => l.saleType === saleType && l.status === 'active' && l.sellerName !== excludeSeller,
  )
  const found = options.last ? matches[matches.length - 1] : matches[0]
  expect(found, `لا يوجد إعلان ${saleType} متاح`).toBeTruthy()
  return found.id
}

/**
 * يُخلي مقعدَ العرض على إعلانٍ قبل استعماله.
 *
 * والخادمُ المحلّيّ يُعاد استعماله بين التشغيلات (`reuseExistingServer`)،
 * فعرضٌ وضعه تشغيلٌ سابق يبقى قائمًا — فلا يجد التشغيلُ التالي حقلَ المبلغ
 * أصلًا، بل «عرضك الحالي». فيُسحب أوّلًا، ويبقى الاختبار صالحًا للتكرار.
 */
async function clearStandingOffer(page: Page) {
  const withdraw = page.getByRole('button', { name: 'اسحب العرض' })
  if ((await withdraw.count()) === 0) return
  await withdraw.first().click()
  await expect(page.getByLabel('مبلغ العرض')).toBeVisible({ timeout: 15_000 })
}

test.describe('سوق تداول اللوحات', () => {
  test('التصفّح العام يعمل بلا تسجيل، والتداول يتطلّب حسابًا', async ({ page }) => {
    await page.goto('/market')
    // المستوى الأول تحديدًا: «السوق» يظهر أيضًا عنوانَ عمود في التذييل
    /*
     * عنوان الصفحة موجودٌ غير مرئيّ.
     *
     * الشاشة الأولى في صفحة تصفّحٍ حقّها للمعروض لا لعنوانٍ يسمّي ما تحته،
     * لكنّ صفحةً بلا `h1` ناقصةُ البنية عند قارئ الشاشة ومحرّك البحث.
     */
    await expect(
      page.getByRole('heading', { name: 'السوق', exact: true, level: 1 }),
    ).toBeAttached()

    const cards = page.locator('article')
    await expect(cards.first()).toBeVisible({ timeout: 15_000 })
    // بعد الترطيب لا عنده: الخادم يكتب ما عنده والعميل يقصّه دفعةً أولى
    const total = await stableCount(cards)
    expect(total).toBeGreaterThan(1)

    // البحث بالأرقام يصفّي النتائج
    await page.getByLabel('بحث في السوق').fill('4040')
    await expect(cards).toHaveCount(1)
    await page.getByLabel('بحث في السوق').fill('')
    await expect(cards).toHaveCount(total)

    // الدخول على إعلان: التداول يطلب حسابًا ولا يظهر زر تنفيذ مباشر
    await cards.first().getByRole('link').first().click()
    await page.waitForURL(/\/market\/lst_[a-z0-9]+$/)
    await expect(page.getByRole('button', { name: /^زايد بـ|^اشترِ الآن بـ/ })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /سجّل و/ })).toBeVisible()

    // لا يتسرّب السعر الاحتياطي إلى صفحة عامة
    expect(await page.content()).not.toContain('reservePrice')
  })

  test('المزايدة تتم من صفحة الإعلان وتظهر في مزايداتي', async ({ page }) => {
    await login(page, USERS.majed)
    const listingId = await findListing(page, 'auction', USERS.majed.name)

    await page.goto(`/market/${listingId}`)
    const bidButton = page.getByRole('button', { name: /^زايد بـ/ })
    await expect(bidButton).toBeVisible({ timeout: 15_000 })
    await bidButton.click()

    // تظهر المزايدة في الكشف فورًا وبلا مغادرة الصفحة
    await expect(page.getByText('أنت').first()).toBeVisible({ timeout: 15_000 })
    expect(page.url()).toContain(`/market/${listingId}`)

    await page.goto('/account/bids')
    await expect(page.getByText('أنت أعلى مزايد').first()).toBeVisible({ timeout: 15_000 })
  })

  test('الشراء المباشر ينشئ صفقة تظهر في مشترياتي ومبيعات البائع', async ({ browser }) => {
    const buyerContext = await browser.newContext()
    const buyer = await buyerContext.newPage()
    await login(buyer, USERS.majed)

    const listingId = await findListing(buyer, 'fixed', USERS.majed.name)
    await buyer.goto(`/market/${listingId}`)

    const buyButton = buyer.getByRole('button', { name: /^اشترِ الآن بـ/ })
    await expect(buyButton).toBeVisible({ timeout: 15_000 })
    await buyButton.click()

    await buyer.goto('/account/purchases')
    await expect(buyer.getByRole('heading', { name: 'مشترياتي' })).toBeVisible()
    await expect(buyer.getByText('بانتظار السداد').first()).toBeVisible({ timeout: 15_000 })

    // الإعلان لم يعد متاحًا للشراء
    await buyer.goto(`/market/${listingId}`)
    await expect(buyer.getByRole('button', { name: /^اشترِ الآن بـ/ })).toHaveCount(0)

    await buyerContext.close()
  })

  test('العرض يُرسل ويقبله البائع فتُغلق اللوحة', async ({ browser }) => {
    const buyerContext = await browser.newContext()
    const buyer = await buyerContext.newPage()
    await login(buyer, USERS.majed)

    const listingId = await findListing(buyer, 'offers', USERS.majed.name)
    const detail = await (await buyer.request.get(`/api/listings/${listingId}`)).json()
    const sellerName = detail.seller.displayName as string
    const amount = Math.round(detail.minimumOffer / 100) + 1_500

    await buyer.goto(`/market/${listingId}`)
    await clearStandingOffer(buyer)
    await buyer.getByLabel('مبلغ العرض').fill(String(amount))
    await buyer.getByRole('button', { name: 'أرسل العرض' }).click()
    await expect(buyer.getByText('عرضك الحالي')).toBeVisible({ timeout: 15_000 })

    // البائع يرى العرض ويقبله
    const sellerUser = Object.values(USERS).find((u) => u.name === sellerName)!
    const sellerContext = await browser.newContext()
    const seller = await sellerContext.newPage()
    await login(seller, sellerUser)

    await seller.goto('/account/offers')
    const acceptButton = seller.getByRole('button', { name: 'قبول' }).first()
    await expect(acceptButton).toBeVisible({ timeout: 15_000 })
    await acceptButton.click()
    await expect(seller.getByText('مقبول').first()).toBeVisible({ timeout: 15_000 })

    // الصفقة تظهر في مبيعات البائع — تحت الإجراء، فالدور فيها على المشتري
    await seller.goto('/account/sales')
    await seller.getByRole('tab', { name: /تحت الإجراء/ }).click()
    await expect(seller.getByText('عرض مقبول').first()).toBeVisible({ timeout: 15_000 })

    await buyerContext.close()
    await sellerContext.close()
  })

  /**
   * السوم — والمقصودُ إثباتُ **الرقم** لا الأزرار.
   *
   * فالمسار يمرّ برقمين: ما عرضه المشتري وما سام به البائع. والعطبُ الذي
   * يُخشى أن تقع الصفقةُ على الأوّل — يدفع المشتري ما لم يقبله البائع.
   * فيُقرأ المبلغ من صفحة المبيعات بعد تمام الجولة.
   */
  test('السوم يُرسل ويقبله المشتري فتقع الصفقة بمبلغ البائع', async ({ browser }) => {
    const buyerContext = await browser.newContext()
    const buyer = await buyerContext.newPage()
    await login(buyer, USERS.waleed)

    const listingId = await findListing(buyer, 'offers', USERS.waleed.name, { last: true })
    const detail = await (await buyer.request.get(`/api/listings/${listingId}`)).json()
    const sellerName = detail.seller.displayName as string
    const offered = Math.round(detail.minimumOffer / 100) + 1_500
    const counter = offered + 4_000

    await buyer.goto(`/market/${listingId}`)
    await clearStandingOffer(buyer)
    await buyer.getByLabel('مبلغ العرض').fill(String(offered))
    await buyer.getByRole('button', { name: 'أرسل العرض' }).click()
    await expect(buyer.getByText('عرضك الحالي')).toBeVisible({ timeout: 15_000 })

    // البائع يسوم بدل أن يقبل
    const sellerUser = Object.values(USERS).find((u) => u.name === sellerName)!
    const sellerContext = await browser.newContext()
    const seller = await sellerContext.newPage()
    await login(seller, sellerUser)

    await seller.goto('/account/offers')
    await seller.getByRole('button', { name: 'مقابل' }).first().click()
    await seller.getByLabel('سومُك').first().fill(String(counter))
    await seller.getByRole('button', { name: 'أرسل السوم' }).click()
    await expect(seller.getByText('بانتظار ردّ المشتري').first()).toBeVisible({ timeout: 15_000 })

    // والمشتري يقبل السوم
    await buyer.goto('/account/offers')
    await buyer.getByRole('tab', { name: /التي أرسلتها/ }).click()
    /*
     * يُنتظر ردُّ الخادم نفسه قبل الانتقال.
     *
     * فالنقرةُ تُرسل ولا تُتمّ، والانتقالُ إثرها يقطع الطلبَ في الطريق —
     * فتُقرأ صفحةُ المشتريات قبل أن تُنشأ الصفقة. وانتظارُ كلمةٍ على الشاشة
     * لا يكفي: «مقبول» قد تكون على عرضٍ آخر في القائمة، فيمضي الانتظار
     * فورًا ولم يقع شيء — وهو ما وقع فعلًا فسقط الاختبار على غير علّة.
     */
    const accepted = buyer.waitForResponse(
      (response) =>
        response.url().includes('/counter') && response.request().method() === 'PATCH',
    )
    await buyer.getByRole('button', { name: /^أقبل/ }).first().click()
    expect((await accepted).ok(), 'رُفض قبولُ السوم').toBe(true)

    // الرقمُ الفارق: الصفقةُ بمبلغ السوم لا بمبلغ العرض
    await buyer.goto('/account/purchases')
    const priced = buyer.getByText(counter.toLocaleString('en-US')).first()
    await expect(priced).toBeVisible({ timeout: 15_000 })
    await expect(buyer.getByText(offered.toLocaleString('en-US'))).toHaveCount(0)

    await buyerContext.close()
    await sellerContext.close()
  })

  /**
   * مبيعاتي صفوفٌ تُمسح، والتفصيلُ في صفحته.
   *
   * والمقصود إثباتُ **أنّ التفصيل لم يضع** حين خرج من الصفّ: السكّةُ
   * والتسويةُ وفعلُ المرحلة كانت في القائمة، فصارت خلف ضغطة — فإن لم تُفتح
   * فقد المستخدمُ ما كان بين يديه.
   */
  test('صفُّ المبيعات يُفضي إلى صفحة الصفقة بتفصيلها', async ({ page }) => {
    await login(page, USERS.waleed)
    await page.goto('/account/sales')

    const row = page.locator('li[data-row]').first()
    await expect(row).toBeVisible({ timeout: 15_000 })

    // الصفُّ نفسُه مختصر: لا سكّةَ فيه ولا تسوية
    await expect(page.getByText('تفاصيل المسار')).toHaveCount(0)

    const detail = await row.locator('a[href^="/account/orders/"]').first().getAttribute('href')
    expect(detail, 'الصفُّ لا يُفضي إلى صفحة الصفقة').toBeTruthy()

    await page.goto(detail!)
    await expect(page.getByRole('heading', { name: /صفقة (بيع|شراء)/ })).toBeVisible()
    // وما خرج من الصفّ يوجد هنا: السكّة والتسوية
    await expect(page.getByText('تفاصيل المسار')).toBeVisible()
    await expect(page.getByText(/قيمة الصفقة|ما يصلك/).first()).toBeVisible()
  })

  test('إضافة لوحة ونشرها في السوق', async ({ page }) => {
    await login(page, USERS.waleed)
    await page.goto('/account/listings/new')

    for (const [slot, letter] of [
      ['الحرف 1', /ب\s*B/],
      ['الحرف 2', /د\s*D/],
      ['الحرف 3', /ر\s*R/],
    ] as const) {
      await page.getByLabel(slot).click()
      await page.getByRole('option', { name: letter }).click()
    }
    await page.getByLabel(/أرقام اللوحة/).fill('7788')
    await expect(page.getByLabel('الحروف اللاتينية')).toHaveText('BDR')

    // بيع مباشر بسعر ثابت
    await page.getByRole('button', { name: /بيع مباشر/ }).click()
    await page.getByLabel(/سعر البيع/).fill('55000')
    await page.getByRole('button', { name: 'حفظ كمسودة' }).click()

    await page.waitForURL('**/account/listings')
    await expect(page.getByText('7788').first()).toBeVisible({ timeout: 15_000 })

    // النشر يُظهرها في السوق
    await page.getByRole('button', { name: 'انشر في السوق' }).first().click()
    await expect(page.getByText('معروض').first()).toBeVisible({ timeout: 15_000 })

    await page.goto('/market')
    await page.getByLabel('بحث في السوق').fill('7788')
    await expect(page.locator('article')).toHaveCount(1)
  })

  test('«حفظ ونشر» يضع اللوحة في السوق مباشرةً ويفتح بشارتها', async ({ page }) => {
    await login(page, USERS.waleed)
    await page.goto('/account/listings/new')

    for (const [slot, letter] of [
      ['الحرف 1', /ن\s*N/],
      ['الحرف 2', /و\s*U/],
      ['الحرف 3', /ر\s*R/],
    ] as const) {
      await page.getByLabel(slot).click()
      await page.getByRole('option', { name: letter }).click()
    }
    await page.getByLabel(/أرقام اللوحة/).fill('6161')

    /*
     * الطريق المعتاد أن تُعرض اللوحة لا أن تُركن مسودّة.
     *
     * وكان لا سبيل إلى السوق إلّا بحفظٍ ثمّ ذهابٍ إلى قائمة اللوحات ثمّ نشرٍ
     * من هناك — ثلاث خطوات لأمرٍ واحد.
     */
    await page.getByRole('button', { name: 'حفظ ونشر' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('نُشرت لوحتك في السوق', { timeout: 15_000 })
    await expect(dialog).toContainText('6161')

    // ورابط المعاينة يفتح لسانًا جديدًا: البائع لا يزال في مسار الإضافة
    const view = dialog.getByRole('link', { name: /شاهد لوحتك في السوق/ })
    await expect(view).toHaveAttribute('target', '_blank')
    await expect(view).toHaveAttribute('href', /^\/market\//)

    await dialog.getByRole('link', { name: /إدارة لوحاتي/ }).click()
    await page.waitForURL('**/account/listings')
    // «معروض» لا «مسودة»: النشر وقع فعلًا لا الحفظ وحده
    await expect(page.getByText('6161').first()).toBeVisible({ timeout: 15_000 })

    await page.goto('/market')
    await page.getByLabel('بحث في السوق').fill('6161')
    await expect(page.locator('article')).toHaveCount(1)
  })

  test('صفحات الحساب متجاوبة مع الجوال', async ({ page }) => {
    await page.setViewportSize({ width: 380, height: 820 })
    await login(page, USERS.waleed)

    for (const path of ['/account', '/account/listings', '/account/bids', '/account/purchases']) {
      await page.goto(path)
      /*
       * يُنتظر **الاستقرار** لا مهلةٌ ثابتة.
       *
       * `waitForTimeout(300)` يقيس عند لحظةٍ بعينها: يكفي على جهازٍ فارغ
       * ولا يكفي تحت حمل المجموعة، فشريط تبويبات الحساب يُقاس وهو يُوزَّع
       * بعدُ فيفيض عرضًا لا يبقى. والمقصود حالٌ مستقرّة لا لقطةٌ في الطريق —
       * وفيضٌ لا ينقضي يُخفق كما كان.
       */
      await expect
        .poll(
          () =>
            page.evaluate(
              () => document.documentElement.scrollWidth > window.innerWidth + 1,
            ),
          { message: `${path}: تمرير أفقي على الجوال` },
        )
        .toBe(false)
    }
  })
})
