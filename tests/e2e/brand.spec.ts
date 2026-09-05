import { expect, test, type Page } from '@playwright/test'
import { loginAdmin, USERS } from './support/session'

/** الهويّة الافتراضية — تُعاد بعد كل اختبار فلا يرث غيره اسمًا مبدَّلًا. */
const DEFAULTS = {
  name: 'سوق تداول لوحات المركبات',
  shortName: 'سوق اللوحات',
  heroBadge: 'سوق تداول لوحات المركبات',
  heroTitle: 'لوحتك تسوى أكثر',
  heroHighlight: 'بِعها بسعرها الصح',
  heroBody: 'اعرض لوحتك بيع مباشر، أو بمزاد، أو استقبل عليها عروض.',
  primaryColor: '#D6A84B',
  metaTitle: 'سوق تداول لوحات المركبات',
  metaDescription:
    'سوق ويب لتداول لوحات المركبات السعودية: اعرض لوحتك للبيع المباشر أو بمزاد أو استقبل العروض.',
  keywords: [],
  legalName: '',
  sameAs: [],
  geoRegion: 'SA',
  geoPlace: 'السعودية',
  googleSiteVerification: '',
  logo: null,
  icon: null,
  ogImage: null,
}

async function setBrand(page: Page, patch: Record<string, unknown>) {
  const result = await page.evaluate(async (body) => {
    const response = await fetch('/api/admin/settings/brand', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    return { ok: response.ok, body: await response.text() }
  }, { ...DEFAULTS, ...patch })
  expect(result.ok, result.body).toBe(true)
}

test.describe('هويّة المنصّة من اللوحة', () => {
  /*
   * كل ما يُبدَّل هنا كان مكتوبًا في الكود، فتغيير اسمٍ يحتاج نشرًا. وهو أوّل
   * ما يبدّله من ينصب نسخته.
   */
  test('الاسم والنصّ واللون والصورة تسري على الموقع', async ({ browser }) => {
    const adminContext = await browser.newContext()
    const adminPage = await adminContext.newPage()
    await loginAdmin(adminPage)

    // صورة مشاركة صغيرة تُصنع في المتصفّح — لا ملفّ في المستودع لاختبارٍ واحد
    const og = await adminPage.evaluate(() => {
      const canvas = document.createElement('canvas')
      canvas.width = 120
      canvas.height = 63
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#0f766e'
      ctx.fillRect(0, 0, 120, 63)
      return canvas.toDataURL('image/png').split(',')[1]
    })

    await setBrand(adminPage, {
      name: 'مزاد اللوحات',
      shortName: 'مزاد',
      heroTitle: 'عنوان من اللوحة',
      heroHighlight: 'سطر مميّز',
      metaTitle: 'مزاد اللوحات السعودية',
      primaryColor: '#0f766e',
      geoRegion: 'SA-01',
      googleSiteVerification: 'verify-token',
      ogImage: { data: og, mime: 'image/png', fileName: 'og.png' },
    })

    const visitor = await browser.newContext()
    const page = await visitor.newPage()
    await page.goto('/')

    // العنوان والنصّ
    await expect(page).toHaveTitle('مزاد اللوحات السعودية')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('عنوان من اللوحة')

    /*
     * واللون يبلغ الأزرار لا الجذر وحده.
     *
     * السمة الفاتحة معلنة على `html` وعلى قشرة الصفحة معًا، فقاعدةٌ على
     * `:root` تكسب عند الأولى ويُعاد التعريف الأصلي عند الثانية — فيقول
     * الجذر إنّ اللون تبدّل والأزرار ذهبيّة. رُصد حيًّا.
     */
    const bg = await page
      .getByRole('link', { name: /شاهد سوق اللوحات/ })
      .evaluate((el) => getComputedStyle(el).backgroundColor)
    const [r, g, b] = bg.match(/\d+/g)!.map(Number)
    expect(g, `الأخضر لا يغلب في ${bg}`).toBeGreaterThan(r)
    expect(b, `الأزرق لا يغلب الأحمر في ${bg}`).toBeGreaterThan(r)

    // وبطاقة المشاركة: رابطٌ مطلق يجلبه خادم واتساب من الخارج
    const ogUrl = await page.locator('meta[property="og:image"]').getAttribute('content')
    expect(ogUrl, 'لا صورة مشاركة').toMatch(/^https?:\/\//)
    const asset = await page.request.get(ogUrl!)
    expect(asset.status()).toBe(200)
    expect(asset.headers()['content-type']).toContain('image/png')

    // وما تقرؤه محرّكات الإجابة
    const ld = await page.locator('script[type="application/ld+json"]').first().textContent()
    const org = JSON.parse(ld!)
    expect(org['@type']).toBe('Organization')
    expect(org.name).toBe('مزاد اللوحات')
    expect(
      await page.locator('meta[name="google-site-verification"]').getAttribute('content'),
    ).toBe('verify-token')
    expect(await page.locator('meta[name="geo.region"]').getAttribute('content')).toBe('SA-01')

    await setBrand(adminPage, {})
    await visitor.close()
    await adminContext.close()
  })

  test('يرفض ما ليس لونًا وما يتجاوز حدّ الحجم', async ({ page }) => {
    await loginAdmin(page)
    const bad = await page.evaluate(async (body) => {
      const response = await fetch('/api/admin/settings/brand', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      return response.status
    }, { ...DEFAULTS, primaryColor: '</style><script>alert(1)</script>' })
    expect(bad).toBe(422)

    // وأصلٌ يتجاوز الحدّ يُرفض بالحجم لا يُقبل فيُثقل السجلّ
    const big = await page.evaluate(async (body) => {
      const response = await fetch('/api/admin/settings/brand', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...body,
          icon: { data: 'A'.repeat(700_000), mime: 'image/png', fileName: 'big.png' },
        }),
      })
      return response.status
    }, DEFAULTS)
    expect(big).toBe(413)
  })
})

test.describe('الأدمن يصحّح بيانات مستخدم', () => {
  /*
   * ما لا يُعدَّل عمدًا: رقم العضوية — مكتوبٌ في فواتير وصفقات صدرت — والرصيد،
   * له مساره المحاسبيّ بقيدٍ ومرجع لا بتحرير حقل.
   */
  test('يعدّل الاسم والمدينة، ويرفض بريدًا مأخوذًا', async ({ page }) => {
    await loginAdmin(page)
    await page.goto('/admin/users')

    const row = page.locator('tr[data-row], li[data-row]').first()
    const id = await row.getAttribute('data-row')
    await page.goto(`/admin/users/${id}`)

    const before = await page.evaluate(async (userId) => {
      const response = await fetch(`/api/admin/users/${userId}`)
      return response.status
    }, id)
    expect([404, 405]).toContain(before) // لا قراءة عبر هذا المسار — التعديل فقط

    await page.getByRole('button', { name: 'تعديل البيانات' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await dialog.getByLabel('المدينة').fill('أبها')
    await dialog.getByRole('button', { name: 'حفظ' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByText('أبها').first()).toBeVisible()

    /*
     * وبريدٌ لحسابٍ آخر يُرفض: هو مفتاح الدخول، وتكراره يمنع صاحبه الأصلي.
     *
     * ويُختار البريد المُزاحِم بعد قراءة بريد هذا الحساب: الصفّ الأوّل ليس
     * لصاحبٍ بعينه، ووضع بريد الحساب على نفسه تعديلٌ مشروع لا تضارب.
     */
    const mine = await page.evaluate(() => document.body.innerText)
    const other = [USERS.majed.email, USERS.waleed.email, USERS.sara.email].find(
      (email) => !mine.includes(email),
    )!

    const clash = await page.evaluate(
      async ({ userId, email }) => {
        const response = await fetch(`/api/admin/users/${userId}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            displayName: 'اسم',
            email,
            phone: null,
            city: null,
            social: { tiktok: null, snapchat: null, instagram: null },
            payout: { bankName: '', iban: '', accountName: '' },
          }),
        })
        return response.status
      },
      { userId: id, email: other },
    )
    expect(clash).toBe(409)
  })
})
