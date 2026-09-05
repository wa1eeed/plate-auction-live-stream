import { loginAdmin, loginUser, USERS } from './support/session'
import { expect, test, type Cookie, type Page } from '@playwright/test'

const BUYER = { email: 'majed@demo.sa', password: 'demo1234' }
const SELLER = { email: 'waleed@demo.sa', password: 'demo1234' }



/** يضبط العمولة من داخل الصفحة — `page.request` لا يحمل كوكي الجلسة. */
async function setCommission(
  page: Page,
  body: Record<string, unknown>,
): Promise<void> {
  const result = await page.evaluate(async (payload) => {
    const response = await fetch('/api/admin/settings/commission', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return { ok: response.ok, body: await response.text() }
  }, body)
  expect(result.ok, result.body).toBe(true)
}

const OFF = { enabled: false, mode: 'percent', percent: 0, fixed: 0, min: 0, max: 0 }

test.describe('عمولة المنصّة', () => {
  test('تُضبط من الإعدادات وتُعرض معاينتها قبل الحفظ', async ({ page }) => {
    await loginAdmin(page)
    /*
     * نُهيّئ الحالة التي نختبرها بدل افتراضها.
     *
     * اختبارات أخرى تُفعّل العمولة (صفحة السداد تحتاجها مُفعّلة)، والخادم
     * مشترك بين الملفّات — فافتراض «معطّلة ابتداءً» يربط نجاح هذا الاختبار
     * بترتيب تشغيل غيره.
     */
    await setCommission(page, { seller: OFF, buyer: OFF, vatEnabled: false, vatPercent: 15 })
    await page.goto('/admin/settings')
    await page.getByRole('tab', { name: 'العمولة والضريبة' }).click()

    await expect(page.getByRole('heading', { name: 'عمولة البائع' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'عمولة المشتري' })).toBeVisible()
    // معطّلة ابتداءً: لا تُقتطع من أحد بلا قرار
    await expect(page.getByText(/العمولة معطّلة على الطرفين/)).toBeVisible()

    await page.getByRole('switch', { name: 'تفعيل عمولة البائع' }).click()
    await page.getByLabel('النسبة (٪)').first().fill('2')
    await page.getByRole('switch', { name: 'تفعيل ضريبة القيمة المضافة' }).click()

    // المعاينة تُظهر الأثر على أسعار حقيقية
    const preview = page.getByRole('table')
    await expect(preview).toContainText('80,000')
    await page.getByRole('button', { name: 'حفظ إعدادات العمولة' }).click()
    await expect(page.getByText('حُفظت إعدادات العمولة')).toBeVisible()

    // نُعيدها معطّلة كي لا تتسرّب بين الاختبارات
    await setCommission(page, { seller: OFF, buyer: OFF, vatEnabled: false, vatPercent: 15 })
  })

  test('تُعرض للمشتري قبل الشراء لا بعده، وتُقتطع عند الاكتمال وتُقيَّد إيرادًا', async ({
    browser,
  }) => {
    const adminContext = await browser.newContext()
    const buyerContext = await browser.newContext()
    const adminPage = await adminContext.newPage()
    const buyerPage = await buyerContext.newPage()

    await loginAdmin(adminPage)
    await setCommission(adminPage, {
      seller: { enabled: true, mode: 'percent', percent: 2, fixed: 0, min: 0, max: 0 },
      buyer: { enabled: true, mode: 'fixed', percent: 0, fixed: 300, min: 0, max: 0 },
      vatEnabled: true,
      vatPercent: 15,
    })

    /*
     * البائع يُنشئ لوحته الخاصة بهذا الاختبار بدل استهلاك لوحة مبذورة.
     * شراء لوحة من البذرة يُغلقها فتختفي من السوق، فتفشل اختبارات أخرى تعتمد
     * عليها — تلوّثٌ بين الاختبارات لا علاقة له بما نختبره هنا.
     */
    const sellerContext = await browser.newContext()
    const sellerPage = await sellerContext.newPage()
    await sellerPage.goto('/login')
    await sellerPage.getByLabel('البريد الإلكتروني').fill(SELLER.email)
    await sellerPage.getByLabel('كلمة المرور').fill(SELLER.password)
    await sellerPage.getByRole('button', { name: 'دخول', exact: true }).click()
    await sellerPage.waitForURL('**/account')

    const target = await sellerPage.evaluate(async () => {
      const created = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          plateType: 'private',
          arabicLetters: 'عمل',
          latinLetters: 'EZL',
          plateNumbers: '9317',
          emblem: 'palm-swords-black',
          saleType: 'fixed',
          price: 40_000,
          startingPrice: 0,
          minimumIncrement: 0,
          reservePrice: 0,
          minimumOffer: 0,
          durationSeconds: 86_400,
        }),
      })
      const { listing } = await created.json()
      await fetch(`/api/listings/${listing.id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'publish' }),
      })
      return { id: listing.id as string }
    })

    await buyerPage.goto('/login')
    await buyerPage.getByLabel('البريد الإلكتروني').fill(BUYER.email)
    await buyerPage.getByLabel('كلمة المرور').fill(BUYER.password)
    await buyerPage.getByRole('button', { name: 'دخول', exact: true }).click()
    await buyerPage.waitForURL('**/account')
    // يُقرأ رقم عضويته وهو في حسابه — بمُحدِّدٍ ينتظر ظهوره لا بنصٍّ يُلتقط قبل الرسم
    const reference = (await buyerPage.getByText(/^U26-\d+$/).first().textContent())?.trim()
    expect(reference, 'رقم عضوية المشتري غير ظاهر في حسابه').toBeTruthy()

    // العمولة ظاهرة **قبل** الضغط: 300 + 15٪ = 345
    await buyerPage.goto(`/market/${target.id}`)
    await expect(buyerPage.getByText(/عمولة المنصّة على هذه الصفقة/)).toBeVisible()
    await expect(buyerPage.getByText(/345/).first()).toBeVisible()

    const orderId = await buyerPage.evaluate(async (id) => {
      const response = await fetch(`/api/listings/${id}/buy`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clientRequestId: `e2e-commission-${Date.now()}` }),
      })
      return (await response.json()).orderId as string
    }, target.id)

    /*
     * نشحن رصيد المشتري ليكفي الثمن والعمولة.
     *
     * وكان يُبحث عنه بمسح `tbody tr` في صفحة المستخدمين — وقد صارت بطاقات لا
     * جدولًا، فلا يجد صفًّا، ويمضي الشحن إلى `/users/undefined/wallet` **بلا
     * أن يعترض**: يبقى الاختبار أخضر حتى تنفد بذرةُ رصيدٍ لم يشحنها أحد.
     * فالمعرّف يُقرأ من رقم عضويته، وكلّ خطوةٍ ترفع خطأها.
     */
    const topUp = await adminPage.evaluate(async (ref) => {
      const detail = await (await fetch(`/admin/users/${ref}`)).text()
      const userId = detail.match(/usr_[a-z0-9]{10,}/)?.[0]
      if (!userId) return { ok: false, body: 'لم يُستخرج معرّف المستخدم من ملفّه' }
      const response = await fetch(`/api/admin/users/${userId}/wallet`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'topup', amount: 200_000, note: 'اختبار العمولة' }),
      })
      return { ok: response.ok, body: await response.text() }
    }, reference!)
    expect(topUp.ok, topUp.body).toBe(true)

    /*
     * المشتري يسدّد من محفظته فتكتمل الصفقة وتُقتطع العمولة.
     *
     * كان الاختبار يختصر الطريق بتعليم الأدمن الصفقة مكتملة — وهو ما صار
     * مرفوضًا بـ`ORDER_NOT_PAID`: لا إتمام قبل وصول المال.
     */
    const paid = await buyerPage.evaluate(async (id) => {
      const response = await fetch(`/api/checkout/${id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ method: 'wallet' }),
      })
      return { ok: response.ok, body: await response.text() }
    }, orderId)
    expect(paid.ok, paid.body).toBe(true)

    /*
     * والمسار كاملًا: السداد يحجز، وعمولة البائع تُخصم من عائده لحظة الإفراج.
     * فالبائع يرفع إثبات النقل، والمشتري يؤكّد، فيُفرَج.
     */
    const transferred = await sellerPage.evaluate(async (id) => {
      const response = await fetch(`/api/orders/${id}/transfer`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ note: 'نُقلت الملكية في أبشر — اختبار' }),
      })
      return { ok: response.ok, body: await response.text() }
    }, orderId)
    expect(transferred.ok, transferred.body).toBe(true)

    // الإفراج قرار إدارة بعد تحقّقها — لا تأكيد من المشتري
    const released = await adminPage.evaluate(async (id) => {
      const response = await fetch(`/api/admin/orders/${id}/dispute`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision: 'release', reason: 'تحقّقنا من النقل' }),
      })
      return { ok: response.ok, body: await response.text() }
    }, orderId)
    expect(released.ok, released.body).toBe(true)

    await adminPage.goto('/admin/revenue')
    await expect(adminPage.getByRole('heading', { name: 'إيرادات المنصّة' })).toBeVisible()
    for (const label of [
      'عمولة من البائع',
      'ضريبة على عمولة البائع',
      'عمولة من المشتري',
      'ضريبة على عمولة المشتري',
    ]) {
      await expect(adminPage.getByText(label).first()).toBeVisible()
    }

    /*
     * وتظهر في كشف حساب المشتري خصمًا — يُبحث عنها في الجدول لا في الصفحة.
     *
     * فوق الكشف منتقي نوعٍ خياراتُه بأسماء القيود نفسها، و`getByText` تصل إلى
     * `<option>` مخفيّ داخل قائمةٍ مغلقة فتُصيبه قبل الصفّ المقصود.
     */
    await buyerPage.goto('/account/wallet')
    await expect(
      buyerPage.locator('table').getByText('عمولة المنصّة').first(),
    ).toBeVisible()

    await setCommission(adminPage, { seller: OFF, buyer: OFF, vatEnabled: false, vatPercent: 15 })
    await adminContext.close()
    await buyerContext.close()
    await sellerContext.close()
  })
})

test.describe('العمولة معطّلة: لا أثر لها في حساب البائع', () => {
  /*
   * تعطيلها يُخرج المال كاملًا — فلا تبقى جملةٌ تعِد بخصمٍ لا يقع.
   *
   * الأسطر الرقمية كانت تختفي وحدها بصفر العمولة (`> 0`)، والجُمل حولها تبقى
   * تقول «بعد خصم عمولة المنصّة وضريبتها» في «مبيعاتي» وفي بطاقة التفصيل وفي
   * «كيف يعمل». فيقرأ البائع خصمًا لم يقع ويبحث عن أثره في كشفه فلا يجده.
   */
  test('لا سطر عمولة ولا جملة تَعِد بخصم — في مبيعاتي وفي «كيف يعمل»', async ({ browser }) => {
    const adminContext = await browser.newContext()
    const adminPage = await adminContext.newPage()
    await loginAdmin(adminPage)
    await setCommission(adminPage, { seller: OFF, buyer: OFF, vatEnabled: false, vatPercent: 15 })

    const sellerContext = await browser.newContext()
    const sellerPage = await sellerContext.newPage()
    await loginUser(sellerPage, SELLER)

    await sellerPage.goto('/account/sales')
    await expect(sellerPage.getByRole('heading', { name: 'مبيعاتي' })).toBeVisible()
    await expect(sellerPage.getByText('عمولة المنصّة')).toHaveCount(0)
    await expect(sellerPage.getByText('بعد خصم عمولة المنصّة وضريبتها')).toHaveCount(0)
    // ويُقال له صراحةً إنّ ما يصله كامل، فلا يُترك يخمّن
    await expect(sellerPage.getByText('بلا عمولة').first()).toBeVisible()

    // والصفحة التي تشرح القاعدة تصف القاعدة السارية لا المكتوبة في الملفّ
    await sellerPage.goto('/how-it-works')
    await expect(sellerPage.getByText('بعد خصم عمولة المنصّة وضريبتها')).toHaveCount(0)

    /*
     * وفواتيره القديمة تبقى — عمدًا.
     *
     * التعطيل يسري على ما يأتي لا على ما مضى: الفاتورة سجلٌّ لعمولةٍ اقتُطعت
     * فعلًا، ومحوُها يمحو أثرًا ماليًّا وقع. وما لا يقع هو **إصدار جديد**:
     * `issueCommissionInvoice` يرتدّ بلا فاتورة إذا كان أساس العمولة صفرًا.
     */

    await adminContext.close()
    await sellerContext.close()
  })
})

test.describe('حراسة المصادرة على الخادم', () => {
  test('الخادم يرفض مصادرة عربون مزاد جارٍ ولو أُرسل الطلب مباشرة', async ({ page }) => {
    await loginAdmin(page)

    const result = await page.evaluate(async () => {
      const html = await (await fetch('/admin/deposits')).text()
      const doc = new DOMParser().parseFromString(html, 'text/html')
      const id = doc.querySelector('tr[data-row]')?.getAttribute('data-row')
      if (!id) return { skipped: true as const }

      const response = await fetch(`/api/admin/deposits/${id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision: 'forfeit', reason: 'محاولة تجاوز الحارس' }),
      })
      return { skipped: false as const, status: response.status, body: await response.json() }
    })

    expect(result.skipped, 'لا عرابين في البيانات').toBe(false)
    if (result.skipped) return
    expect(result.status).toBe(409)
    // إمّا لا صفقة أصلًا، أو المهلة ما زالت قائمة — كلاهما رفض من الخادم
    expect(['NO_ORDER_FOR_DEPOSIT', 'FORFEIT_TOO_EARLY']).toContain(result.body?.error?.code)
  })
})

test.describe('الوصول بلوحة المفاتيح', () => {
  test('أوّل تبويب يقود إلى رابط تخطّي التنقّل، ويصل المحتوى', async ({ page }) => {
    await page.goto('/market')
    /*
     * ينتظر استقرار الصفحة قبل أن يُجرَّب التنقّل بلوحة المفاتيح: هيكل
     * الانتظار يُستبدل بالمحتوى، والاستبدال يُفقد التركيز — وهو سباق في
     * الاختبار لا عيب في ترتيب التبويب.
     */
    await expect(page.getByRole('tab').first()).toBeVisible()
    await page.keyboard.press('Tab')

    const skip = page.getByRole('link', { name: 'تخطّي إلى المحتوى' })
    await expect(skip).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/#main/)
    await expect(page.locator('#main')).toBeVisible()
  })

  test('لوحة الإدارة تحمل معلَم main ورابط التخطّي', async ({ page }) => {
    await loginAdmin(page)
    await page.goto('/admin/users')
    await expect(page.getByRole('main')).toBeVisible()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'تخطّي إلى المحتوى' })).toBeFocused()
  })
})
