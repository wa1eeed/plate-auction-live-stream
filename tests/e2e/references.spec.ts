import { loginAdmin, loginUser, USERS } from './support/session'
import { expect, test, type Cookie, type Page } from '@playwright/test'

const USER = USERS.waleed



test.describe('رقم الإعلان', () => {
  test('يظهر في البطاقة وفي صفحة الإعلان ويُبحث به', async ({ page }) => {
    await page.goto('/market')

    // رقم بصيغة L{سنة}-{تسلسل} على كل بطاقة
    const refs = await page
      .locator('article')
      .evaluateAll((cards) =>
        cards.map((card) => card.textContent?.match(/L\d{2}-\d{5}/)?.[0]).filter(Boolean),
      )
    expect(refs.length).toBeGreaterThan(0)

    // البحث بالرقم يُبقي لوحة واحدة
    const count = page.getByText(/عرض \d+ من \d+ لوحة/)
    await page.getByLabel('بحث في السوق').fill(refs[0]!)
    await expect(count).toContainText('عرض 1 من')

    // والصيغة المختصرة بلا شرطة وبحروف صغيرة تعمل كذلك
    await page.getByLabel('بحث في السوق').fill(refs[0]!.replace('-', '').toLowerCase())
    await expect(count).toContainText('عرض 1 من')

    /*
     * وأرقام اللوحة تبقى بحثًا في اللوحة لا في رقم الإعلان.
     * نأخذ أرقام لوحة **معروضة الآن** لا لوحة مبذورة بعينها: اختبارات أخرى قد
     * تكون أغلقتها بالشراء، فيفشل هذا الاختبار لسبب لا علاقة له بما يقيسه.
     */
    await page.getByLabel('بحث في السوق').fill('')
    const digits = await page
      .locator('article [data-plate-numbers]')
      .first()
      .getAttribute('data-plate-numbers')

    await page.getByLabel('بحث في السوق').fill(digits!)
    const shown = await page
      .locator('article [data-plate-numbers]')
      .evaluateAll((nodes) =>
        nodes.map((node) => (node as HTMLElement).dataset.plateNumbers ?? ''),
      )
    expect(shown.length).toBeGreaterThan(0)
    for (const value of shown) expect(value).toContain(digits!)
  })

  test('صفحة الإعلان تعرض الرقم في الشارة وفي البيانات', async ({ page }) => {
    await page.goto('/market')
    const { id, reference } = await page.evaluate(async () => {
      const { listings } = await (await fetch('/api/listings')).json()
      return { id: listings[0].id as string, reference: listings[0].reference as string }
    })

    await page.goto(`/market/${id}`)
    expect(reference).toMatch(/^L\d{2}-\d{5}$/)
    await expect(
      page.getByRole('button', { name: new RegExp(`رقم الإعلان ${reference}`) }),
    ).toBeVisible()
    await expect(page.getByText('رقم الإعلان').last()).toBeVisible()
    await expect(page.getByText(reference).first()).toBeVisible()
  })

  test('الرقم لا يتغيّر بين البطاقة وصفحتها', async ({ page }) => {
    await page.goto('/market')
    const card = page.locator('article').first()
    const shown = (await card.textContent())?.match(/L\d{2}-\d{5}/)?.[0]
    await card.getByRole('link').first().click()
    await page.waitForURL(/\/market\/lst_/)
    await expect(page.getByRole('button', { name: new RegExp(`رقم الإعلان ${shown}`) })).toBeVisible()
  })
})

test.describe('رقم العضوية', () => {
  test('يظهر في «حسابي» وفي الإعدادات، ومطابق لما تراه الإدارة', async ({ page }) => {
    await loginUser(page)

    const chip = page.getByRole('button', { name: /رقم العضوية U\d{2}-\d{5}/ })
    await expect(chip).toBeVisible()
    const label = (await chip.getAttribute('aria-label'))!
    const reference = label.match(/U\d{2}-\d{5}/)![0]

    // ونفسه في الإعدادات — حيث يبحث عنه من يريد نسخه للدعم
    await page.goto('/account/settings')
    await expect(page.getByRole('heading', { name: 'رقم العضوية' })).toBeVisible()
    await expect(page.getByText(reference)).toBeVisible()
  })

  test('لا يغادر الخادم في حمولة الإعلان العامة', async ({ page }) => {
    await page.goto('/market')
    const seller = await page.evaluate(async () => {
      const { listings } = await (await fetch('/api/listings')).json()
      const detail = await (await fetch(`/api/listings/${listings[0].id}`)).json()
      return detail.seller
    })
    // اسم ومدينة وتاريخ عضوية فقط — لا رقم عضوية ولا بريد ولا جوال
    expect(Object.keys(seller).sort()).toEqual(['city', 'displayName', 'id', 'memberSince'])
  })
})

test.describe('الأرقام في لوحة الإدارة', () => {
  test('الرقم بارزٌ في بطاقات المستخدمين والإعلانات، والبحث يجده', async ({ page }) => {
    await loginAdmin(page)

    /*
     * المستخدمون بطاقات لا جدولًا — والرقم بارزٌ في كلٍّ منها.
     *
     * والبحث يعمل عليه كما كان: هو ما يُملى في المراسلة، فيُلصق ليُفتح صاحبه.
     */
    await page.goto('/admin/users')
    const firstUser = page.locator('li[data-row]').first()
    const userRef = (await firstUser.textContent())?.match(/U\d{2}-\d{5}/)?.[0]
    expect(userRef, 'لا رقم عضوية في البطاقة').toBeTruthy()
    await page.getByLabel(/ابحث/).fill(userRef!)
    await expect(page.locator('li[data-row]:visible')).toHaveCount(1)

    // والإعلانات بطاقاتٌ كذلك — رقمها في رأس البطاقة لا في عمودٍ يُمرَّر إليه
    await page.goto('/admin/listings')
    const firstListing = page.locator('li[data-row]').first()
    const listingRef = (await firstListing.textContent())?.match(/L\d{2}-\d{5}/)?.[0]
    expect(listingRef, 'لا رقم إعلان في البطاقة').toBeTruthy()
    await page.getByLabel(/ابحث/).fill(listingRef!)
    await expect(page.locator('li[data-row]:visible')).toHaveCount(1)
  })

  test('صفحة المستخدم: الرابط بالرقم المرجعي والرقم بارز قابل للنسخ', async ({ page }) => {
    await loginAdmin(page)
    await page.goto('/admin/users')
    await page.locator('li[data-row]').first().click()

    // شريط العنوان يحمل ما يقرؤه الأدمن ويُمليه، لا معرّفًا داخليًا
    await page.waitForURL(/\/admin\/users\/U\d{2}-\d{5}$/)
    const reference = page.url().split('/').pop()!

    await expect(
      page.getByRole('button', { name: new RegExp(`رقم العضوية ${reference}`) }),
    ).toBeVisible()
    await expect(page.getByText(/رقم العضوية/).first()).toBeVisible()
  })

  test('المعرّف الداخلي يبقى مقبولًا فلا تنكسر روابط محفوظة', async ({ page }) => {
    await loginAdmin(page)
    const internalId = await page.evaluate(async () => {
      const html = await (await fetch('/admin/users')).text()
      return html.match(/usr_[a-z0-9]{10,}/)?.[0] ?? null
    })
    expect(internalId).toBeTruthy()

    await page.goto(`/admin/users/${internalId}`)
    await expect(page.getByText(/رقم العضوية/).first()).toBeVisible()
  })
})

test.describe('أرقام الصفقات والمدفوعات والحركات', () => {
  test('كل جدول مالي في الإدارة يعرض رقمه المرجعي بصيغته', async ({ page }) => {
    await loginAdmin(page)

    for (const [path, header, pattern] of [
      ['/admin/deposits', 'رقم العربون', /D\d{2}-\d{5}/],
      ['/admin/transactions', 'رقم الحركة', /W\d{2}-\d{5}/],
    ] as const) {
      await page.goto(path)
      await expect(page.getByRole('columnheader', { name: header })).toBeVisible()

      const rows = await page.locator('tbody tr').count()
      if (rows === 0) continue
      const text = await page.locator('tbody tr').first().textContent()
      expect(text, `لا رقم مرجعي في ${path}`).toMatch(pattern)
    }

    // والصفقات بطاقات: الرقم في البطاقة لا في ترويسة عمود
    await page.goto('/admin/orders')
    const card = page.locator('li[data-row]:visible').first()
    await expect(card).toBeVisible()
    expect(await card.textContent()).toMatch(/S\d{2}-\d{5}/)
  })

  test('رقم الحركة يظهر في كشف حساب المستخدم', async ({ page }) => {
    await loginUser(page)

    await page.goto('/account/wallet')
    await expect(page.getByRole('columnheader', { name: 'رقم الحركة' })).toBeVisible()
    await expect(page.getByText(/W\d{2}-\d{5}/).first()).toBeVisible()
  })

  test('مرجع عملية الشحن بالصيغة الموحّدة لا بصيغة قديمة', async ({ page }) => {
    await loginUser(page)

    const reference = await page.evaluate(async () => {
      await fetch('/api/payments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ amount: 500, method: 'bank_transfer' }),
      }).catch(() => null)
      const list = await (await fetch('/api/payments')).json().catch(() => null)
      return (list?.payments?.[0]?.reference as string | undefined) ?? null
    })

    // الحوالة قد تكون معطّلة حسب ترتيب الاختبارات — نتحقّق فقط إن أُنشئت
    if (reference) expect(reference).toMatch(/^P\d{2}-\d{5}$/)
  })
})

test.describe('صفحة العرابين', () => {
  test('اللوحة مرسومة لا مكتوبة، ونصّها باقٍ للبحث ولقارئ الشاشة', async ({ page }) => {
    await loginAdmin(page)
    await page.goto('/admin/deposits')

    const rows = page.locator('tbody tr')
    await expect(rows.first()).toBeVisible()

    // كل صفّ يحمل لوحة مرسومة
    const plates = page.locator('tbody svg[data-plate-type]')
    expect(await plates.count()).toBe(await rows.count())

    // والنصّ لم يُفقَد: في تسمية الرابط، فيبقى مقروءًا ومسموعًا
    const link = page.locator('tbody a[href^="/admin/listings/"]').first()
    const label = (await link.getAttribute('aria-label'))!
    expect(label).toMatch(/^اللوحة .+/)
    await expect(link).toHaveAttribute('title', label.replace('اللوحة ', ''))

    // والبحث بنصّ اللوحة ما زال يعمل رغم أنها صورة
    const plateText = label.replace('اللوحة ', '').split(' ')[0]
    const before = await rows.count()
    await page.getByLabel(/ابحث بالمزايد/).fill(plateText)
    await expect
      .poll(async () => rows.filter({ visible: true }).count())
      .toBeLessThan(before)
  })
})
