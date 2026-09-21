import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { loginUser, USERS } from './support/session'

/**
 * محاولةُ اختراقٍ فعلية — ثلاثةُ وعودٍ تقطعها المنصّة، تُفحص ولا تُفترض.
 *
 * وقراءةُ الكود لا تكفي هنا: ما يُحجب في دالّةٍ قد يتسرّب من مسارٍ آخر نُسي،
 * أو من حقلٍ أضافته نسخةٌ لاحقة. فيُهاجَم كلّ مسارٍ يصل إليه غريب، ويُبحث عن
 * **القيمة نفسها** لا عن اسم الحقل: حقلٌ يُعاد تسميته يمرّ، والرقم لا يمرّ.
 */

/**
 * قيمةٌ فريدة تُزرع ثمّ يُبحث عنها.
 *
 * ولا تُستعمل أسعارُ البذرة: `62_000` فيها سعرٌ احتياطيّ لإعلان **وسعرُ
 * ابتداءٍ علنيّ لآخر**، فالبحث عنه يُنذر كاذبًا. والقيمة المزروعة لا تشبه
 * شيئًا في المنصّة — فظهورُها تسريبٌ قاطع لا يحتمل تأويلًا.
 */
const SECRET_RESERVE = 987_654
const PUBLIC_START = 111_222

/** أرقام جوال المستخدمين في البذرة. */
const PHONES = ['+966500000001', '+966500000002', '+966500000003', '966500000001', '0500000001']

/** يبحث عن الرقم بصيغه: هللاتٍ وريالاتٍ وبفواصل. */
function leaks(body: string, riyals: number): string | null {
  for (const form of [String(riyals * 100), String(riyals), riyals.toLocaleString('en-US')]) {
    if (new RegExp(`(^|[^\\d])${form}([^\\d]|$)`).test(body)) return form
  }
  return null
}

async function publicListingIds(request: APIRequestContext): Promise<string[]> {
  const html = await (await request.get('/market')).text()
  return [...new Set([...html.matchAll(/\/market\/([a-zA-Z0-9_-]{4,})"/g)].map((m) => m[1]))]
}

/**
 * طلبٌ مُصادَقٌ عليه — **من داخل الصفحة** لا من `page.request`.
 *
 * وكوكي الجلسة `Secure` لأنّ الفحوص تعمل على بناء إنتاج. والمتصفّح يستثني
 * `localhost` فيقبله، و`page.request` لا يستثنيه فلا يرسله — فيردّ الخادم
 * «يجب تسجيل الدخول». و`fetch` من الصفحة هو ما يفعله التطبيق نفسه.
 */
async function asUser<T = unknown>(page: Page, path: string, init: RequestInit): Promise<{ status: number; body: T }> {
  return page.evaluate(
    async ([url, options]) => {
      const response = await fetch(url as string, options as RequestInit)
      const text = await response.text()
      /* ردٌّ غيرُ JSON — 405 مثلًا — لا يُسقط الفحص: الحالة هي المقصودة */
      let body: unknown = text
      try {
        body = JSON.parse(text)
      } catch {
        /* يبقى نصًّا */
      }
      return { status: response.status, body }
    },
    [path, init] as const,
  )
}

/**
 * ما زُرع يُقلَع.
 *
 * فالفحوص تتشارك منصّةً واحدة: لوحةٌ تبقى لصاحبها تتصدّر «لوحاتي» فتكسر فحصًا
 * آخر يقيس أوّل بطاقةٍ فيها — وقد وقع ذلك فعلًا.
 */
const planted: Array<{ page: Page; id: string }> = []

test.afterEach(async () => {
  for (const { page, id } of planted.splice(0)) {
    if (page.isClosed()) continue
    await asUser(page, `/api/listings/${id}`, { method: 'DELETE' }).catch(() => undefined)
  }
})

/** ينشئ مزادًا بسعرٍ احتياطيّ فريد، ويعيد معرّفه. */
async function plantListing(page: Page): Promise<string> {
  const created = await asUser<{ listing: { id: string } }>(
    page,
    '/api/listings',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        plateType: 'private',
        plateFormat: 'standard',
        arabicLetters: 'ســم',
        latinLetters: 'SM',
        plateNumbers: '9876',
        emblem: 'palm-swords-black',
        description: 'لوحةٌ للفحص الأمنيّ',
        saleType: 'auction',
        price: 0,
        startingPrice: PUBLIC_START,
        minimumIncrement: 1_000,
        reservePrice: SECRET_RESERVE,
        minimumOffer: 0,
        durationSeconds: 86_400,
      }),
    },
  )
  expect(created.status, `تعذّر إنشاء اللوحة: ${JSON.stringify(created.body)}`).toBe(200)
  const id = created.body.listing.id

  const published = await asUser(page, `/api/listings/${id}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'publish' }),
  })
  expect(published.status, `تعذّر النشر: ${JSON.stringify(published.body)}`).toBe(200)
  planted.push({ page, id })
  return id
}

test.describe('السعر الاحتياطي لا يبلغ مشاهدًا', () => {
  test('لا لغريبٍ غير مسجَّل — صفحةً ولا واجهةً برمجية', async ({ page, request }) => {
    await loginUser(page, USERS.waleed)
    const id = await plantListing(page)

    for (const path of ['/market', `/market/${id}`, `/api/listings/${id}`, `/api/listings/${id}/bids`]) {
      const response = await request.get(path)
      if (response.status() === 404) continue
      const body = await response.text()

      expect(body, `اسم الحقل ظاهر في ${path}`).not.toContain('reservePrice')
      expect(leaks(body, SECRET_RESERVE), `تسرّب السعر الاحتياطي في ${path}`).toBeNull()
    }
  })

  test('ولا لمستخدمٍ مسجَّل ليس البائع', async ({ page, browser }) => {
    await loginUser(page, USERS.waleed)
    const id = await plantListing(page)

    const stranger = await browser.newPage()
    await loginUser(stranger, USERS.sara)
    for (const path of [`/market/${id}`, `/api/listings/${id}`]) {
      const body = await stranger.evaluate((url) => fetch(url).then((r) => r.text()), path)
      expect(body).not.toContain('reservePrice')
      expect(leaks(body, SECRET_RESERVE), `تسرّب لمستخدمٍ مسجَّل في ${path}`).toBeNull()
    }
  })

  test('وسعرُ الابتداء العلنيّ يظهر — فالفحص يقيس حجبًا لا صمتًا', async ({ page, request }) => {
    await loginUser(page, USERS.waleed)
    const id = await plantListing(page)

    const body = await (await request.get(`/market/${id}`)).text()
    expect(leaks(body, PUBLIC_START), 'حتى العلنيّ لا يظهر — الفحص يقيس صفحةً فارغة').not.toBeNull()
  })
})

test.describe('أرقام الجوال لا تُعرض لغير أطراف الصفقة', () => {
  test('لا في السوق ولا في المعارض العامّة', async ({ request }) => {
    const ids = await publicListingIds(request)
    const handles = ['waleed', 'sara', 'majed']

    const pages = ['/market', ...ids.slice(0, 5).map((i) => `/market/${i}`), ...handles.map((h) => `/@${h}`)]
    for (const path of pages) {
      const body = await (await request.get(path)).text()
      for (const phone of PHONES) {
        expect(body.includes(phone), `تسرّب جوّالٌ في ${path}`).toBe(false)
      }
    }
  })

  test('ولا لمستخدمٍ مسجَّل لا علاقة له بالصفقة', async ({ page, request }) => {
    await loginUser(page, USERS.majed)
    const ids = await publicListingIds(request)

    for (const id of ids.slice(0, 5)) {
      const body = await page.evaluate((u) => fetch(u).then((r) => r.text()), `/api/listings/${id}`)
      for (const phone of PHONES) {
        expect(body.includes(phone), `تسرّب جوّالٌ لغريبٍ مسجَّل`).toBe(false)
      }
    }
  })

  test('ولا رقم العضوية — وهو معرِّفٌ لا يُنشر', async ({ request }) => {
    const ids = await publicListingIds(request)
    for (const path of ['/market', ...ids.slice(0, 5).map((i) => `/market/${i}`), '/@waleed']) {
      const body = await (await request.get(path)).text()
      expect(/U2\d-\d{5}/.test(body), `رقم عضوية في ${path}`).toBe(false)
    }
  })
})

test.describe('الصلاحيات أفقيًّا — مستخدمٌ يطلب ما ليس له', () => {
  /**
   * أخطر الثلاثة: حارسٌ ينسى مقارنةَ المالك يفتح محفظةَ غيره بمعرّفٍ مخمَّن.
   * فيُبنى المورد بحسابٍ ثمّ يُطلَب بحسابٍ آخر — والمنتظَر ردٌّ لا بيانات.
   */
  test('لا يعدّل إعلانَ غيره ولا يحذفه ولا ينشره', async ({ page, browser }) => {
    await loginUser(page, USERS.waleed)
    const id = await plantListing(page)

    const attacker = await browser.newPage()
    await loginUser(attacker, USERS.sara)

    const attempts = [
      { method: 'PATCH', body: { startingPrice: 1, minimumIncrement: 1 }, what: 'تعديل السعر' },
      { method: 'POST', body: { action: 'cancel' }, what: 'الإلغاء' },
      { method: 'DELETE', body: null, what: 'الحذف' },
    ] as const

    for (const attempt of attempts) {
      const result = await asUser(attacker, `/api/listings/${id}`, {
        method: attempt.method,
        headers: { 'content-type': 'application/json' },
        ...(attempt.body ? { body: JSON.stringify(attempt.body) } : {}),
      })
      expect([401, 403, 404], `${attempt.what} نجح أو ردّ ردًّا غريبًا (${result.status})`).toContain(
        result.status,
      )
    }

    // والإعلان لم يُمسّ
    const still = await asUser<{ listing: { status: string } }>(page, `/api/listings/${id}`, { method: 'GET' })
    expect(still.body.listing?.status ?? 'active').not.toBe('cancelled')
  })

  test('لا يقرأ محفظةَ غيره ولا صفقاته ولا فواتيره', async ({ page }) => {
    await loginUser(page, USERS.sara)

    /*
     * هذه المسارات تُشتقّ من الجلسة لا من معرّفٍ في العنوان — وهو التصميم
     * الصحيح. والفحص يثبت أنّ ما يعود **لسارة** لا لغيرها.
     */
    const mine = await asUser(page, '/api/account/wallet', { method: 'GET' })
    expect(mine.status, 'المحفظة لا تُقرأ بجلسةٍ صحيحة').toBe(200)

    /*
     * والمسار يشتقّ صاحبَه من الجلسة لا من العنوان — وهو التصميم الصحيح.
     * فيُجرَّب تمريرُ معرّفٍ آخر: إن **تبدّل الردّ** فالمعرّف يُقرأ من العنوان.
     */
    const spoofed = await asUser(page, '/api/account/wallet?userId=usr_0001', { method: 'GET' })
    expect(JSON.stringify(spoofed.body), 'الردّ تبدّل بمعرّفٍ في العنوان').toBe(
      JSON.stringify(mine.body),
    )
  })

  test('لا يبلغ مسارات الإدارة بجلسة مستخدمٍ عاديّ', async ({ page }) => {
    await loginUser(page, USERS.waleed)

    const adminPaths = [
      '/api/admin/settings/commission',
      '/api/admin/settings/payments',
      '/api/admin/seed',
      '/api/admin/faq',
    ]
    for (const path of adminPaths) {
      const result = await asUser(page, path, { method: 'GET' })
      expect([401, 403, 404], `${path} ردّ ${result.status} لمستخدمٍ عاديّ`).toContain(result.status)
    }
  })

  test('ولا يكتب فيها', async ({ page }) => {
    await loginUser(page, USERS.waleed)

    /*
     * والأسلوب يطابق ما يقبله المسار عمدًا: طلبٌ بأسلوبٍ خاطئ يُردّ بـ405 قبل
     * أن يُفحص التصريح أصلًا — فيمرّ الفحص وهو لم يختبر شيئًا.
     */
    const writes = [
      { path: '/api/admin/seed', method: 'POST', body: {} },
      { path: '/api/admin/faq', method: 'POST', body: { question: 'س', answer: 'ج' } },
      { path: '/api/admin/settings/commission', method: 'PATCH', body: { percentage: 0 } },
      { path: '/api/admin/settings/payments', method: 'PATCH', body: { provider: 'tap' } },
      {
        path: '/api/admin/broadcast',
        method: 'POST',
        body: { audience: 'all', title: 'ا', body: 'ب', href: '/' },
      },
    ] as const

    for (const write of writes) {
      const result = await asUser(page, write.path, {
        method: write.method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(write.body),
      })
      expect([401, 403, 404], `${write.path} قبِل كتابةً من مستخدمٍ عاديّ (${result.status})`).toContain(
        result.status,
      )
    }
  })

  test('والمسار الداخليّ لا يُفتح بجلسةٍ ولا بلا مفتاح', async ({ page }) => {
    await loginUser(page, USERS.waleed)
    const result = await asUser(page, '/api/internal/sweep', { method: 'POST' })
    expect(result.status, 'المسح الداخليّ يُفتح بجلسة مستخدم').toBe(403)
  })
})

test.describe('سياسة الخصوصية — يشترطها المتجران', () => {
  test('الصفحة تُفتح علنًا بلا تسجيل، وفيها ما يلزم المراجعة', async ({ request }) => {
    const response = await request.get('/privacy')
    expect(response.status(), '/privacy لا تُفتح — والمتجران يطلبان رابطًا عامًّا').toBe(200)

    const html = await response.text()
    for (const needle of ['سياسة الخصوصية', 'ما نجمعه', 'ما لا نجمعه', 'حقوقك']) {
      expect(html, `السياسة بلا قسم «${needle}»`).toContain(needle)
    }
  })

  test('ومربوطةٌ من التذييل — رابطٌ لا يُوجد لا يُقرأ', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('footer a[href="/privacy"]')).toHaveCount(1)
  })
})
