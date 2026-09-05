import { forgetAdminSession, loginAdmin, loginUser, USERS } from './support/session'
import { expect, test, type Cookie, type Page } from '@playwright/test'

const ADMIN = { email: 'admin@demo.sa', password: 'admin1234' }
const USER = USERS.waleed

/**
 * كوكيّا الجلستين محفوظان ويُعاد استعمالهما.
 *
 * تسجيل دخول حقيقي في كل اختبار يستنفد حدّ المعدّل (الإدارة 5 محاولات/دقيقة)
 * فتفشل الاختبارات المتأخّرة بـ429 — وهو الحدّ يعمل بحق لا عيب فيه. نسجّل
 * الدخول مرّة ونحقن الكوكي بعدها، فنختبر الميزات لا آلية الدخول.
 */



test.describe('لوحة الإدارة', () => {
  test('لوحة الإدارة محميّة ولا تُفتح بلا تسجيل', async ({ page }) => {
    await page.goto('/admin/users')
    await expect(page).toHaveURL(/\/admin\/login/)
    await expect(page.getByRole('heading', { name: 'لوحة الإدارة' })).toBeVisible()
  })

  test('جلسة الإدارة وجلسة المستخدم تعملان معًا في المتصفّح نفسه', async ({ page }) => {
    await loginUser(page)
    await loginAdmin(page)

    // الأدمن داخل لوحته
    await page.goto('/admin/users')
    await expect(page.getByRole('heading', { name: 'المستخدمون' })).toBeVisible()

    // وحساب المستخدم ما زال مفتوحًا في الوقت نفسه
    await page.goto('/account/listings')
    await expect(page.getByRole('heading', { name: 'إدارة لوحاتي' })).toBeVisible()

    // وخروج الإدارة لا يمسّ جلسة المستخدم
    await page.goto('/admin')
    await page.getByRole('button', { name: 'خروج' }).click()
    await page.waitForURL('**/admin/login')
    // الجلسة المحفوظة لم تعد صالحة بعد الخروج
    forgetAdminSession()

    await page.goto('/account/listings')
    await expect(page.getByRole('heading', { name: 'إدارة لوحاتي' })).toBeVisible()
  })

  test('المؤشرات وصفحات الإدارة تعرض بيانات المنصّة', async ({ page }) => {
    await loginAdmin(page)
    await expect(page.getByRole('heading', { name: 'مؤشرات المنصّة' })).toBeVisible()

    for (const [href, heading] of [
      ['/admin/users', 'المستخدمون'],
      ['/admin/listings', 'الإعلانات'],
      ['/admin/orders', 'الصفقات'],
      ['/admin/deposits', 'العرابين'],
      ['/admin/transactions', 'الحركات المالية'],
      ['/admin/faq', 'الأسئلة الشائعة'],
    ] as const) {
      await page.goto(href)
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    }
  })

  test('الأدمن يشحن رصيد مستخدم فيظهر في محفظته وكشف حسابه', async ({ browser }) => {
    const adminContext = await browser.newContext()
    const userContext = await browser.newContext()
    const adminPage = await adminContext.newPage()
    const userPage = await userContext.newPage()

    await loginAdmin(adminPage)
    await loginUser(userPage)

    // الرصيد قبل الشحن
    await userPage.goto('/account/wallet')
    const before = await userPage.locator('text=الرصيد الكلي').locator('..').innerText()

    await adminPage.goto('/admin/users')
    await adminPage.getByRole('link', { name: new RegExp(USER.name) }).first().click()
    await adminPage.waitForURL(/\/admin\/users\/U\d{2}-\d{5}/)

    await adminPage.getByRole('button', { name: 'شحن رصيد' }).click()
    await adminPage.getByLabel('المبلغ بالريال').fill('1234')
    await adminPage.getByLabel('ملاحظة (اختيارية)').fill('اختبار شامل')
    await adminPage.getByRole('button', { name: 'تأكيد شحن' }).click()
    await expect(adminPage.getByText(/تم شحن/)).toBeVisible()

    // يظهر فورًا في كشف حساب المستخدم
    await userPage.goto('/account/wallet')
    await expect(userPage.getByText('اختبار شامل')).toBeVisible()
    const after = await userPage.locator('text=الرصيد الكلي').locator('..').innerText()
    expect(after).not.toBe(before)

    await adminContext.close()
    await userContext.close()
  })

  test('إضافة سؤال شائع تُظهره في الصفحة العامة', async ({ page }) => {
    await loginAdmin(page)
    await page.goto('/admin/faq')

    const question = `سؤال اختباري ${Date.now()}`
    await page.getByRole('button', { name: 'أضف سؤالًا' }).click()
    await page.getByLabel('السؤال').fill(question)
    await page.getByLabel('الإجابة').fill('إجابة اختبارية كافية الطول لتجاوز التحقّق.')
    await page.getByRole('button', { name: 'حفظ' }).click()
    await expect(page.getByText('أُضيف السؤال')).toBeVisible()

    await page.goto('/faq')
    await expect(page.getByRole('button', { name: new RegExp(question) })).toBeVisible()
  })
})

test.describe('المحفظة والعربون', () => {
  test('صفحة المحفظة تعرض الرصيد والمحجوز والمتاح وكشف الحساب', async ({ page }) => {
    await loginUser(page)
    await page.goto('/account/wallet')

    await expect(page.getByRole('heading', { name: 'محفظتي' })).toBeVisible()
    await expect(page.getByText('الرصيد الكلي')).toBeVisible()
    await expect(page.getByText('محجوز كعرابين')).toBeVisible()
    await expect(page.getByText('المتاح للمزايدة')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'كشف الحساب' })).toBeVisible()
  })

  test('العربون يُحجز عند المزايدة ويظهر في المحفظة', async ({ page }) => {
    await loginUser(page)

    const response = await page.request.get('/api/listings')
    const { listings } = (await response.json()) as {
      listings: { id: string; saleType: string; status: string; sellerName: string }[]
    }
    const target = listings.find(
      (l) => l.saleType === 'auction' && l.status === 'active' && l.sellerName !== USER.name,
    )
    expect(target, 'لا يوجد مزاد صالح').toBeTruthy()

    await page.goto(`/market/${target!.id}`)
    // بيان العربون ظاهر قبل المزايدة
    await expect(page.getByText(/عربون/).first()).toBeVisible()

    await page.goto('/account/wallet')
    await expect(page.getByText('محجوز كعرابين')).toBeVisible()
  })

  test('الأسئلة الشائعة تظهر أسفل صفحة المزاد', async ({ page }) => {
    const response = await page.request.get('/api/listings')
    const { listings } = (await response.json()) as { listings: { id: string; status: string }[] }
    const target = listings.find((l) => l.status === 'active')!

    await page.goto(`/market/${target.id}`)
    await expect(page.getByRole('heading', { name: 'أسئلة شائعة قبل المزايدة' })).toBeVisible()
    await expect(page.getByRole('button', { name: /السعر الاحتياطي/ })).toBeVisible()
  })

  test('شريط المزايدة الثابت يظهر على الجوال ولا يغطّي المحتوى', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await loginUser(page)

    const response = await page.request.get('/api/listings')
    const { listings } = (await response.json()) as {
      listings: { id: string; saleType: string; status: string; sellerName: string }[]
    }
    const target = listings.find(
      (l) => l.saleType === 'auction' && l.status === 'active' && l.sellerName !== USER.name,
    )!

    await page.goto(`/market/${target.id}`)

    /*
     * يُقصَد الشريط الثابت وحده.
     *
     * صندوق المزايدة واحدٌ للشاشتين، ونسخة العمود الجانبي في الشجرة مخفيّةً
     * بـ`display:none` دون `lg`. فيُطابق الاسمُ المعرِّف نسختين، ولا يميّز
     * بينهما إلّا الموضع.
     */
    const bar = page.locator('.fixed.bottom-0')
    await expect(bar.getByLabel('مبلغ المزايدة')).toBeVisible()
    await expect(bar.getByLabel('زيادة المبلغ')).toBeVisible()

    // ولا نسخة ثانية ظاهرة معه — واجهةٌ واحدة لفعلٍ واحد
    await expect(page.getByLabel('مبلغ المزايدة')).toHaveCount(2)
    await expect(page.locator('[aria-label="مبلغ المزايدة"]:visible')).toHaveCount(1)

    // لا تمرير أفقي، والمحتوى لا يختفي خلف الشريط
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    )
    expect(overflow).toBe(false)

    /*
     * وآخر المحتوى فوق الشريط لا خلفه.
     *
     * كان المتن يحجز `pb-52` ثابتة والشريط يبلغ ٢٥٧ بكسل، وارتفاعه ليس ثابتًا
     * أصلًا: يزيد بسطر العربون وبرقاقات الزيادة. فصار يقيس نفسه ويكتبه.
     */
    const clear = await page.evaluate(() => {
      const barEl = document.querySelector('.fixed.bottom-0') as HTMLElement | null
      const main = document.getElementById('main')!
      if (!barEl) return true
      const pad = parseFloat(getComputedStyle(main).paddingBottom)
      return pad >= barEl.offsetHeight
    })
    expect(clear, 'الشريط يغطّي آخر المحتوى').toBe(true)
  })
})

test.describe('الدفع', () => {
  test('إعدادات الدفع تمنع تفعيل Tap بلا مفتاح وتقبل الحوالة البنكية', async ({ page }) => {
    await loginAdmin(page)
    await page.goto('/admin/settings')
    await page.getByRole('tab', { name: 'الدفع' }).click()

    await expect(page.getByRole('heading', { name: 'بوابة Tap' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'الحوالة البنكية' })).toBeVisible()
    // حالة تهيئة المفاتيح ظاهرة، ولا يُطلب مفتاح في أي حقل
    await expect(page.getByText('بلا مفتاح').first()).toBeVisible()
    await expect(page.getByText(/TAP_TEST_SECRET_KEY/)).toBeVisible()

    await page.getByLabel('اسم البنك').fill('مصرف الاختبار')
    await page.getByLabel('اسم صاحب الحساب').fill('سوق اللوحات')
    await page.getByLabel('الآيبان').fill('SA0380000000608010167519')
    await page.getByLabel('تفعيل الحوالة البنكية').click()
    await page.getByRole('button', { name: 'حفظ الإعدادات' }).click()
    await expect(page.getByText('حُفظت إعدادات الدفع')).toBeVisible()
  })

  test('المستخدم يطلب حوالة والأدمن يؤكّدها فيُضاف الرصيد', async ({ browser }) => {
    const adminContext = await browser.newContext()
    const userContext = await browser.newContext()
    const adminPage = await adminContext.newPage()
    const userPage = await userContext.newPage()

    await loginAdmin(adminPage)
    // نضمن تفعيل الحوالة أيًّا كان ترتيب تنفيذ الاختبارات.
    // الطلب من داخل الصفحة لا عبر `page.request`: الأخير لا يحمل كوكي الجلسة.
    const settingsResult = await adminPage.evaluate(async () => {
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
    expect(settingsResult.ok, settingsResult.body).toBe(true)

    await loginUser(userPage)
    await userPage.goto('/account/wallet')
    await userPage.getByRole('button', { name: 'شحن الرصيد' }).click()
    await userPage.getByLabel('المبلغ بالريال').fill('750')
    await userPage.getByRole('button', { name: 'إنشاء طلب التحويل' }).click()
    await expect(userPage.getByText(/أُنشئت عملية التحويل/)).toBeVisible()

    // بيانات الحساب والمرجع ظاهران للمستخدم
    await expect(userPage.getByText('SA0380000000608010167519')).toBeVisible()
    // RegExp حقيقي لا نصّ: `'text=/P\d{2}/'` يُفقد الشرطات المائلة عند تحويله سلسلةً
    const reference = await userPage.getByText(/P\d{2}-\d{5}/).first().innerText()

    await userPage.getByLabel('رقم عملية التحويل').first().fill('TRX-E2E')
    await userPage.getByRole('button', { name: 'حوّلت المبلغ' }).click()
    await expect(userPage.getByText(/بانتظار تحقّق الإدارة/)).toBeVisible()

    // الأدمن يجدها ويؤكّدها
    await adminPage.goto('/admin/payments')
    await expect(adminPage.getByText(reference)).toBeVisible()
    await adminPage.getByRole('button', { name: 'تأكيد', exact: true }).first().click()
    await adminPage.getByRole('button', { name: 'تأكيد وإضافة الرصيد' }).click()
    await expect(adminPage.getByText('أُضيف الرصيد للمستخدم')).toBeVisible()

    // وينعكس على المستخدم
    await userPage.goto('/account/wallet')
    await expect(userPage.getByText('مدفوعة').first()).toBeVisible()

    await adminContext.close()
    await userContext.close()
  })
})

test.describe('العدّاد التنازلي', () => {
  test('يعرض كتل الأرقام ووحداتها وشريط التقدّم', async ({ page }) => {
    const response = await page.request.get('/api/listings')
    const { listings } = (await response.json()) as {
      listings: { id: string; saleType: string; status: string }[]
    }
    const auction = listings.find((l) => l.saleType === 'auction' && l.status === 'active')!

    await page.goto(`/market/${auction.id}`)
    const timer = page.getByRole('timer').first()
    await expect(timer).toBeVisible()
    await expect(timer).toContainText('الوقت المتبقّي')
    await expect(timer).toContainText('ثانية')
    await expect(page.getByText(/مضى \d+٪ من مدّة المزاد/)).toBeVisible()
  })

  test('العدّاد يتحرّك فعليًا لا يجمد على لحظة الجلب', async ({ page }) => {
    const response = await page.request.get('/api/listings')
    const { listings } = (await response.json()) as {
      listings: { id: string; saleType: string; status: string }[]
    }
    const auction = listings.find((l) => l.saleType === 'auction' && l.status === 'active')!

    await page.goto(`/market/${auction.id}`)
    const timer = page.getByRole('timer').first()
    await expect(timer).toBeVisible()

    // نقرأ كتلة الثواني لا `aria-label`: الأخير مختصر عمدًا فلا يُعلن
    // لقارئ الشاشة رقمًا جديدًا كل ثانية.
    const seconds = timer.locator('span', { hasText: /^\d{2}$/ }).last()
    const first = await seconds.innerText()
    await page.waitForTimeout(2_200)
    expect(await seconds.innerText()).not.toBe(first)
  })

  test('بطاقة السوق تعرض عدّادًا حيًّا مربوطًا بوقت الخادم', async ({ page }) => {
    await page.goto('/market')
    await expect(page.getByRole('timer').first()).toBeVisible()
  })
})

test.describe('لوحة المستخدم والإشعارات', () => {
  test('لوحة الحساب تعرض المحفظة والأرقام والأقسام', async ({ page }) => {
    await loginUser(page)
    await page.goto('/account')

    await expect(page.getByRole('heading', { level: 1 })).toContainText(USER.name)
    await expect(page.getByText('الرصيد المتاح للمزايدة')).toBeVisible()
    await expect(page.getByText('لوحاتي المعروضة')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'مزادات أنت فيها' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'آخر التنبيهات' })).toBeVisible()
  })

  test('تجاوز المزايدة يُنشئ إشعارًا ويظهر في الجرس وقسم «يحتاج تصرّفك»', async ({ browser }) => {
    const mine = await browser.newContext()
    const rival = await browser.newContext()
    const minePage = await mine.newPage()
    const rivalPage = await rival.newPage()

    await loginUser(minePage)

    const response = await minePage.request.get('/api/listings')
    const { listings } = (await response.json()) as {
      listings: { id: string; saleType: string; status: string; sellerName: string }[]
    }
    const auction = listings.find(
      (l) => l.saleType === 'auction' && l.status === 'active' && l.sellerName !== USER.name,
    )!

    // أزايد أنا أولًا
    await minePage.evaluate(async (id) => {
      const detail = await (await fetch(`/api/listings/${id}`)).json()
      await fetch(`/api/listings/${id}/bids`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          amount: detail.nextBidAmount / 100,
          isCustomAmount: false,
          clientRequestId: `e2e-mine-${Date.now()}`,
        }),
      })
    }, auction.id)

    // ثم يتجاوزني منافس
    await rivalPage.goto('/login')
    await rivalPage.getByLabel('البريد الإلكتروني').fill('majed@demo.sa')
    await rivalPage.getByLabel('كلمة المرور').fill('demo1234')
    await rivalPage.getByRole('button', { name: 'دخول', exact: true }).click()
    await rivalPage.waitForURL('**/account')

    await rivalPage.evaluate(async (id) => {
      const detail = await (await fetch(`/api/listings/${id}`)).json()
      await fetch(`/api/listings/${id}/bids`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          amount: detail.nextBidAmount / 100,
          isCustomAmount: false,
          clientRequestId: `e2e-rival-${Date.now()}`,
        }),
      })
    }, auction.id)

    await minePage.goto('/account')
    await expect(minePage.getByRole('heading', { name: 'يحتاج تصرّفك' })).toBeVisible()
    await expect(minePage.getByText(/تجاوزك مزايد في/)).toBeVisible()

    // والجرس يحمل العدّاد ويفتح على الإشعار
    const bell = minePage.getByRole('button', { name: /الإشعارات/ })
    await expect(bell).toHaveAttribute('aria-label', /غير مقروء/)
    await bell.click()
    await expect(minePage.getByText('تجاوزك مزايد آخر').first()).toBeVisible()

    await mine.close()
    await rival.close()
  })
})

test.describe('سجلّ التدقيق والبحث', () => {
  test('يعرض الأفعال الإدارية بمنفّذها ويبحث فيها', async ({ page }) => {
    await loginAdmin(page)

    // نُحدث فعلًا إداريًا مضمونًا
    await page.goto('/admin/users')
    await page.getByRole('link', { name: new RegExp(USER.name) }).first().click()
    await page.waitForURL(/\/admin\/users\/U\d{2}-\d{5}/)
    await page.getByRole('button', { name: 'شحن رصيد' }).click()
    await page.getByLabel('المبلغ بالريال').fill('120')
    await page.getByRole('button', { name: 'تأكيد شحن' }).click()
    await expect(page.getByText(/تم شحن/)).toBeVisible()

    await page.goto('/admin/audit')
    await expect(page.getByRole('heading', { name: 'سجلّ التدقيق' })).toBeVisible()
    await expect(page.getByText('شحن رصيد').first()).toBeVisible()
    await expect(page.getByText('مدير المنصّة').first()).toBeVisible()

    // البحث يقلّص النتائج ثم يعيدها
    const search = page.getByLabel(/ابحث بالفعل/)
    await search.fill('لا-يوجد-هذا-الفعل')
    await expect(page.getByText(/لا نتائج تطابق/)).toBeVisible()
    await search.fill('')
    await expect(page.getByText('شحن رصيد').first()).toBeVisible()
  })
})
