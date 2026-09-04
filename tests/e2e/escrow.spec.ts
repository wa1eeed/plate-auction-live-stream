import { expect, test, type Page } from '@playwright/test'
import { loginAdmin, loginUser, USERS } from './support/session'

const SELLER = USERS.waleed
const BUYER = USERS.majed

async function enableBank(page: Page) {
  const result = await page.evaluate(async () => {
    const response = await fetch('/api/admin/settings/payments', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tapEnabled: false,
        tapMode: 'test',
        bankTransferEnabled: true,
        bankName: 'مصرف الاختبار',
        bankAccountName: 'سوق اللوحات',
        bankIban: 'SA0380000000608010167519',
        bankAccountNumber: '',
        bankInstructions: '',
      }),
    })
    return { ok: response.ok, body: await response.text() }
  })
  expect(result.ok, result.body).toBe(true)
}

/**
 * صفقة خاصّة بهذا الاختبار، محجوزة أمانةً.
 *
 * لا نستهلك لوحة مبذورة: الصفقات القابلة للسداد في البذرة معدودة، وملفّ
 * اختبار يلتهم واحدة يترك التالي بلا شيء — فيمرّ وحده ويسقط في التشغيل الكامل.
 * فيُنشئ البائع لوحته، ويشتريها المشتري، ويؤكّد الأدمن الحوالة.
 */
async function fundedOrder(
  sellerPage: Page,
  buyerPage: Page,
  adminPage: Page,
  plate: { arabicLetters: string; latinLetters: string; plateNumbers: string },
): Promise<{ id: string; reference: string }> {
  const listingId = await sellerPage.evaluate(async (plateInput) => {
    const created = await fetch('/api/listings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        plateType: 'private',
        emblem: 'palm-swords-black',
        saleType: 'fixed',
        price: 40_000,
        startingPrice: 0,
        minimumIncrement: 0,
        reservePrice: 0,
        minimumOffer: 0,
        durationSeconds: 86_400,
        ...plateInput,
      }),
    })
    const { listing } = await created.json()
    await fetch(`/api/listings/${listing.id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'publish' }),
    })
    return listing.id as string
  }, plate)

  const orderId = await buyerPage.evaluate(async (id) => {
    const response = await fetch(`/api/listings/${id}/buy`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clientRequestId: `e2e-escrow-${id}` }),
    })
    return (await response.json()).orderId as string
  }, listingId)

  const started = await buyerPage.evaluate(async (id) => {
    const response = await fetch(`/api/checkout/${id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ method: 'bank_transfer' }),
    })
    return (await response.json()) as { paymentReference: string }
  }, orderId)

  const confirmed = await adminPage.evaluate(async (reference) => {
    const html = await (await fetch('/admin/payments')).text()
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const row = [...doc.querySelectorAll('tbody tr')].find((r) =>
      r.textContent?.includes(reference),
    )
    const response = await fetch(`/api/admin/payments/${row!.getAttribute('data-row')}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decision: 'confirm', note: 'وصلت' }),
    })
    return { ok: response.ok, body: await response.text() }
  }, started.paymentReference)
  expect(confirmed.ok, confirmed.body).toBe(true)

  /*
   * صفوف حساب المستخدم مفتاحها الرقم المرجعي لا المعرّف الداخلي.
   *
   * ويُقرأ من الصفحة الحيّة لا بـ`fetch`: صفحة الصفقات صارت تُبثّ خلف هيكل
   * انتظار، فأوّل ما يصل من HTML هو الهيكل — و`DOMParser` لا يجمع ما يأتي
   * بعده في قوالب البثّ.
   */
  await adminPage.goto('/admin/orders')
  const reference =
    (await adminPage.locator(`[data-row="${orderId}"]`).first().textContent())?.match(
      /S\d{2}-\d{5}/,
    )?.[0] ?? ''
  expect(reference, 'لم يُعثر على الرقم المرجعي للصفقة').not.toBe('')

  return { id: orderId, reference }
}

/**
 * الصفقات مقسّمة أقسامًا بالدور، فيُفتح القسم الذي تقع فيه الحالة المختبَرة.
 *
 * وننتظر `aria-selected` بعد النقر لا نكتفي به: النقر قبل تمام الترطيب يقع
 * على زرّ لم يُربط بعد فيضيع بلا أثر، ثم يفشل التأكيد بعده لسببٍ غير سببه.
 */
async function openStage(page: Page, label: string) {
  const tab = page.getByRole('tab', { name: new RegExp(label) })
  await expect(tab).toBeVisible()
  await tab.click()
  await expect(tab).toHaveAttribute('aria-selected', 'true')
}

test.describe('مسار الصفقة في الواجهة', () => {
  test('السداد يحجز، والبائع ينقل، والإدارة تتحقّق فتحوّل المبلغ', async ({ browser }) => {
    const adminContext = await browser.newContext()
    const buyerContext = await browser.newContext()
    const sellerContext = await browser.newContext()
    const adminPage = await adminContext.newPage()
    const buyerPage = await buyerContext.newPage()
    const sellerPage = await sellerContext.newPage()

    await loginAdmin(adminPage)
    await enableBank(adminPage)
    await loginUser(sellerPage, SELLER)
    await loginUser(buyerPage, BUYER)

    const order = await fundedOrder(sellerPage, buyerPage, adminPage, {
      arabicLetters: 'ركب',
      latinLetters: 'RKB',
      plateNumbers: '7411',
    })

    // المشتري يرى المبلغ محجوزًا، ومساره خمس محطّات — والدور على البائع فالقسم «تحت الإجراء»
    await buyerPage.goto('/account/purchases')
    await openStage(buyerPage, 'تحت الإجراء')
    const purchase = buyerPage.locator(`li[data-row="${order.reference}"]`)
    await expect(purchase.getByText(/المبلغ محجوز/).first()).toBeVisible()
    // الشريط خمس محطّات باسم كلمةٍ لكلٍّ — لا خمس جمل تحت خمس نقاط
    const rail = purchase.locator('ol').first()
    await expect(rail.locator('> li')).toHaveCount(5)
    await expect(rail.locator('> li')).toContainText(['طلب', 'سداد', 'نقل', 'تحقّق', 'تحويل'])
    // وموضع المال معلن **جملةً مرئية** لا كلمةً في رقاقة: محجوز لا عند أحد الطرفين
    await expect(purchase.locator('[data-money="held"]')).toHaveText(
      'المبلغ محجوز أمانةً لدى المنصّة',
    )
    // ولا يُطالَب بفعل — لكنّ باب السؤال مفتوح
    await expect(purchase.getByRole('button', { name: 'أكّد الاستلام' })).toHaveCount(0)
    await expect(purchase.getByRole('button', { name: 'استفسار أو اعتراض' })).toBeVisible()

    // الدور على البائع — ويقرأ صفحته بصوته لا بصوت المشتري
    await sellerPage.goto('/account/sales')
    await openStage(sellerPage, 'بانتظار ردّك')
    const sale = sellerPage.locator(`li[data-row="${order.reference}"]`)
    await sale.locator('details').first().evaluate((el: HTMLDetailsElement) => (el.open = true))
    await expect(sale).toContainText('وصل مبلغ المشتري وحُجز أمانةً')
    await expect(sale).not.toContainText('اشتريت اللوحة')
    await expect(sale).not.toContainText('وصل مبلغك')
    /*
     * وما يقبضه لا ما يدفعه.
     *
     * والصيغة تتبع العمولة: «صافي ما يصلك» حين تُقتطع، و«ما يصلك» حين تكون
     * معطّلة — فلا يُوعَد بصافٍ من لا يُخصم منه شيء. والمقصود هنا الصوت لا
     * الصيغة، فيُطابَق ما يشترك فيه الاثنان.
     */
    await expect(sale.getByText(/ما يصلك/)).toBeVisible()
    await sale.getByRole('button', { name: 'أكّد نقل الملكية' }).click()
    await sellerPage.getByLabel('بيان النقل').fill('نُقلت في أبشر برقم 998877')
    await sellerPage.getByRole('button', { name: 'رفع الإثبات' }).click()
    await expect(sellerPage.getByText('وصل إثباتك — بانتظار تحقّق الإدارة')).toBeVisible()

    // ثم الدور على الإدارة: لا مطلوب من المشتري وباب سؤاله مفتوح
    await buyerPage.goto('/account/purchases')
    await openStage(buyerPage, 'تحت الإجراء')
    await expect(purchase.getByText('تحقّق الإدارة من النقل').first()).toBeVisible()
    await expect(purchase.getByText('لا مطلوب منك').first()).toBeVisible()
    await expect(purchase.getByRole('button', { name: 'استفسار أو اعتراض' })).toBeVisible()

    // والإدارة تجدها في «بانتظار قرارك» بما يُفعل لا بحالتها وحدها
    await adminPage.goto('/admin/orders')
    await openStage(adminPage, 'بانتظار قرارك')
    const adminRow = adminPage.locator(`[data-row="${order.id}"]`)
    await expect(adminRow).toContainText('تحقّق من نقل الملكية ثم حوّل المبلغ')
    await expect(adminRow).toContainText('نُقلت في أبشر برقم 998877')

    await adminRow.getByRole('button', { name: 'حوّل للبائع' }).click()
    await adminPage.getByLabel(/سبب|ملاحظة/).first().fill('تحقّقنا من النقل في أبشر')
    await adminPage.getByRole('button', { name: /تأكيد|تنفيذ/ }).last().click()
    await expect(adminPage.getByText('وصل المبلغ إلى البائع')).toBeVisible()

    await buyerPage.goto('/account/purchases')
    await openStage(buyerPage, 'معاملة مكتملة')
    await expect(purchase.getByText('اكتملت — وصل المبلغ للبائع')).toBeVisible()

    /*
     * والسطر المالي يقول ما وقع لا ما كان.
     *
     * كان يُقرأ بجملة الحجز — «محجوز أمانةً حتى تُنقل الملكية» — على صفقةٍ
     * خرج مالها من زمن، فيبحث صاحبها عن مالٍ ذهب إلى البائع.
     */
    await expect(purchase).toContainText('ذهب المبلغ إلى البائع واللوحة باسمك')
    await expect(purchase).not.toContainText('حتى تتحقّق الإدارة من نقل الملكية')

    await adminContext.close()
    await buyerContext.close()
    await sellerContext.close()
  })

  test('الأقسام تُقسّم بالدور، والبحث يعلو عليها', async ({ browser }) => {
    const buyerContext = await browser.newContext()
    const buyerPage = await buyerContext.newPage()
    await loginUser(buyerPage, BUYER)
    await buyerPage.goto('/account/purchases')

    // ثلاثة أقسام ثابتة، وعدّاد كلٍّ ظاهر فلا يختفي عن صاحبه ما ينتظره
    const tabs = buyerPage.getByRole('tab')
    await expect(tabs).toHaveCount(3)
    await expect(tabs).toContainText(['بانتظار ردّك', 'تحت الإجراء', 'معاملة مكتملة'])

    // ويُفتح على ما ينتظر ردّه لا على الأوّل ترتيبًا
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'true')
    // وما فيه لا يظهر في قسم غيره
    await openStage(buyerPage, 'معاملة مكتملة')
    await expect(buyerPage.getByText('اكتملت — وصل المبلغ للبائع').first()).toBeVisible()
    await expect(buyerPage.getByRole('link', { name: 'أكمل السداد' })).toHaveCount(0)

    await buyerContext.close()
  })

  test('الاعتراض يوقف تحويل المبلغ ويظهر للإدارة بقرارَين', async ({ browser }) => {
    const adminContext = await browser.newContext()
    const buyerContext = await browser.newContext()
    const sellerContext = await browser.newContext()
    const adminPage = await adminContext.newPage()
    const buyerPage = await buyerContext.newPage()
    const sellerPage = await sellerContext.newPage()

    await loginAdmin(adminPage)
    await enableBank(adminPage)
    await loginUser(sellerPage, SELLER)
    await loginUser(buyerPage, BUYER)

    const order = await fundedOrder(sellerPage, buyerPage, adminPage, {
      arabicLetters: 'ركب',
      latinLetters: 'RKB',
      plateNumbers: '7412',
    })

    const disputed = await buyerPage.evaluate(async (id) => {
      const response = await fetch(`/api/orders/${id}/dispute`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: 'لم تُنقل الملكية باسمي' }),
      })
      return { ok: response.ok, body: await response.text() }
    }, order.id)
    expect(disputed.ok, disputed.body).toBe(true)

    await buyerPage.goto('/account/purchases')
    // الاعتراض عند الإدارة، فمعاملته عند المشتري «تحت الإجراء»
    await openStage(buyerPage, 'تحت الإجراء')
    // الحالة في الشارة، والمطلوب الآن في نداء المرحلة — كلاهما يقول الشيء نفسه
    await expect(
      buyerPage.locator(`li[data-row="${order.reference}"]`).getByText('اعتراض قيد المراجعة').first(),
    ).toBeVisible()

    // والإدارة تجد القرارَين لا ثالث لهما
    await adminPage.goto('/admin/orders')
    await openStage(adminPage, 'بانتظار قرارك')
    const row = adminPage.locator(`[data-row="${order.id}"]`)
    await expect(row.getByRole('button', { name: 'حوّل للبائع' })).toBeVisible()
    await expect(row.getByRole('button', { name: 'أعد للمشتري' })).toBeVisible()

    await adminContext.close()
    await buyerContext.close()
    await sellerContext.close()
  })
})
