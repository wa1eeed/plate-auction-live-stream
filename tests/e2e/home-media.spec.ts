import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { loginAdmin, loginUser, USERS } from './support/session'

/*
 * فحوصُ واجهة الرئيسية — الستوريز والبنرات وتخزين الوسائط.
 *
 * وتُبنى محتوياتُها هنا لا تُبذَر: الرفع نفسه نصفُ ما يُقاس (النسبة والنوع
 * والصلاحية)، وبذرةٌ جاهزة تتخطّاه كلَّه.
 */

/**
 * كلُّ طلبٍ مُصادَقٍ عليه **من داخل الصفحة** لا من `page.request`.
 *
 * كوكي الجلسة `Secure` لأنّ الفحوص تعمل على بناء إنتاج. والمتصفّح يستثني
 * `localhost` فيقبله، و`page.request` لا يستثنيه فلا يرسله — فيردّ الخادم
 * «يجب تسجيل الدخول» ويُقرأ الفحصُ عطبًا في الصلاحيات. وهي نفسُ الحيلة
 * الموثَّقة في `attack.spec.ts`، و`fetch` من الصفحة هو ما يفعله التطبيق.
 */
async function api<T = unknown>(
  page: Page,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<{ status: number; body: T }> {
  return page.evaluate(
    async ([url, options]) => {
      const config = options as { method?: string; body?: unknown }
      const response = await fetch(url as string, {
        method: config.method ?? 'GET',
        headers: config.body ? { 'content-type': 'application/json' } : undefined,
        body: config.body ? JSON.stringify(config.body) : undefined,
      })
      const text = await response.text()
      let body: unknown = text
      try {
        body = JSON.parse(text)
      } catch {
        /* ردٌّ غيرُ JSON — الحالة هي المقصودة */
      }
      return { status: response.status, body: body as never }
    },
    [path, init ?? {}] as const,
  )
}

/** يقرأ حالةَ مسارٍ بلا جسم — للحدود والترويسات. */
async function head(page: Page, path: string) {
  return page.evaluate(async (url) => {
    const response = await fetch(url)
    return {
      status: response.status,
      cacheControl: response.headers.get('cache-control') ?? '',
      nosniff: response.headers.get('x-content-type-options') ?? '',
    }
  }, path)
}

const fixture = (name: string) =>
  readFileSync(join(process.cwd(), 'tests/fixtures/media', name)).toString('base64')

const MIME: Record<string, string> = {
  'banner-2x1.png': 'image/png',
  'banner-2x1.jpg': 'image/jpeg',
  'banner-2x1.webp': 'image/webp',
  'square.png': 'image/png',
}

/** يرفع بايتاتٍ عبر `FormData` مبنيّة **في الصفحة** — لعبور حارس الكوكي. */
async function upload(
  page: Page,
  input: { name: string; mime: string; base64: string; purpose: string; ownerId?: string },
): Promise<{ status: number; body: { key: string; width: number; height: number; error?: { message: string } } }> {
  return page.evaluate(async (data) => {
    const binary = atob(data.base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)

    const form = new FormData()
    form.append('file', new File([bytes], data.name, { type: data.mime }))
    form.append('purpose', data.purpose)
    if (data.ownerId) form.append('ownerId', data.ownerId)

    const response = await fetch('/api/admin/media', { method: 'POST', body: form })
    return { status: response.status, body: await response.json() }
  }, input)
}

const uploadFixture = (page: Page, name: string, purpose: string) =>
  upload(page, { name, mime: MIME[name]!, base64: fixture(name), purpose })

async function makeBanner(page: Page, fields: Record<string, unknown> = {}) {
  const uploaded = await uploadFixture(page, 'banner-2x1.png', 'banner')
  expect(uploaded.status).toBe(200)
  const created = await api(page, '/api/admin/banners', {
    method: 'POST',
    body: {
      title: 'إعلان الفحص',
      imageKey: uploaded.body.key,
      width: uploaded.body.width,
      height: uploaded.body.height,
      alt: 'إعلانٌ ترويجيّ للفحص',
      published: true,
      sortOrder: 0,
      ...fields,
    },
  })
  track(page, 'banners', created.body)
  return created
}

async function makeStory(page: Page, fields: Record<string, unknown> = {}) {
  const uploaded = await uploadFixture(page, 'square.png', 'story')
  expect(uploaded.status).toBe(200)
  const created = await api(page, '/api/admin/stories', {
    method: 'POST',
    body: {
      title: 'ستوري الفحص',
      mediaKey: uploaded.body.key,
      mediaKind: 'image',
      alt: 'محتوى الفحص',
      published: true,
      sortOrder: 0,
      durationSeconds: 3,
      ...fields,
    },
  })
  track(page, 'stories', created.body)
  return created
}

const MOBILE = { width: 390, height: 844 }

/**
 * ما زُرع يُقلَع — وإلّا تراكمت الستوريز فأفسدت الفحوص بعضها بعضًا.
 *
 * الفحوص تتشارك منصّةً واحدة في الذاكرة. وبنرٌ يبقى من فحصٍ سابق يتصدّر
 * الشريحة، وستوري يبقى يدخل بين «الأولى» و«الثانية» فيكسر فحص التنقّل —
 * **وقد كسره فعلًا**. ويتعدّى الضررُ الملفَّ: الرئيسيةُ يقيسها غيرُه.
 */
const planted: Array<{ page: Page; kind: 'banners' | 'stories'; id: string }> = []

function track(page: Page, kind: 'banners' | 'stories', body: unknown): void {
  const id = (body as { item?: { id?: string } })?.item?.id
  if (id) planted.push({ page, kind, id })
}

test.afterEach(async () => {
  for (const { page, kind, id } of planted.splice(0)) {
    if (page.isClosed()) continue
    await api(page, `/api/admin/${kind}/${id}`, { method: 'DELETE' }).catch(() => undefined)
  }
})

test.describe('رفع الوسائط', () => {
  test.beforeEach(async ({ page }) => {
    await loginAdmin(page)
  })

  test('يقيس البايتات لا الاسم: نسبةُ البنر تُفرض، والمقنَّع يُردّ', async ({ page }) => {
    const good = await uploadFixture(page, 'banner-2x1.png', 'banner')
    expect(good.status).toBe(200)
    expect(good.body).toMatchObject({ width: 1200, height: 600 })
    expect(good.body.key).toMatch(/^platform\/images\//)

    /* مربّعٌ في شريحةٍ نسبتها ٢:١ يُقصّ نصفُه — فيُردّ برسالةٍ تقول النسبة */
    const square = await uploadFixture(page, 'square.png', 'banner')
    expect(square.status).toBe(422)
    expect(square.body.error?.message).toContain('2:1')

    /*
     * **ملفٌّ يدّعي أنّه صورة.**
     *
     * لو صُدِّق النوعُ المعلن لَسكن الحاوية ثمّ قُدِّم من نطاقٍ يثق به
     * المتصفّح. والبايتات لا تكذب: ما لا يحمل توقيع صورةٍ يُردّ.
     */
    const disguised = await upload(page, {
      name: 'evil.png',
      mime: 'image/png',
      base64: Buffer.from('<script>alert(1)</script>'.padEnd(128, ' ')).toString('base64'),
      purpose: 'banner',
    })
    expect(disguised.status).toBe(422)

    /* ونوعٌ غيرُ مدعومٍ أصلًا يُردّ قبل أن تُقرأ بايتاته */
    const svg = await upload(page, {
      name: 'a.svg',
      mime: 'image/svg+xml',
      base64: Buffer.from('<svg/>').toString('base64'),
      purpose: 'banner',
    })
    expect(svg.status).toBe(415)
  })

  test('والصيغ الثلاث تُقرأ — PNG وJPEG بEXIF وWebP', async ({ page }) => {
    for (const name of ['banner-2x1.png', 'banner-2x1.jpg', 'banner-2x1.webp']) {
      const uploaded = await uploadFixture(page, name, 'banner')
      expect(uploaded.status, name).toBe(200)
      expect(uploaded.body, name).toMatchObject({ width: 1200, height: 600 })
    }
  })

  test('الرفع لا يُفتح لغير الإدارة', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()

    await page.goto('/')
    const anonymous = await uploadFixture(page, 'banner-2x1.png', 'banner')
    expect(anonymous.status).toBe(401)

    await loginUser(page, USERS.sara)
    const asUser = await uploadFixture(page, 'banner-2x1.png', 'banner')
    expect(asUser.status).toBe(401)

    await context.close()
  })

  test('المدّة المقلوبة والرابط الخبيث يُردّان', async ({ page }) => {
    const inverted = await makeBanner(page, {
      startsAt: '2026-10-01T00:00:00.000Z',
      endsAt: '2026-09-01T00:00:00.000Z',
    })
    expect(inverted.status).toBe(422)

    /* `javascript:` في بنرٍ يُضغط = تنفيذُ سكربتٍ في جلسة من ضغطه */
    expect((await makeBanner(page, { linkUrl: 'javascript:alert(1)' })).status).toBe(422)
    /* و`http` يُنذر المتصفّح في صفحةٍ آمنة */
    expect((await makeBanner(page, { linkUrl: 'http://example.com' })).status).toBe(422)
    /* والداخليّ والخارجيّ الآمن يُقبلان */
    expect((await makeBanner(page, { linkUrl: '/market?sale=auction' })).status).toBe(200)
    expect((await makeBanner(page, { linkUrl: 'https://example.com' })).status).toBe(200)
  })

  test('والستوري فدّيو بلا غلافٍ يُردّ — وإلّا بقيت الحلقة سوداء', async ({ page }) => {
    const uploaded = await uploadFixture(page, 'square.png', 'story')
    const response = await api(page, '/api/admin/stories', {
      method: 'POST',
      body: {
        title: 'بلا غلاف',
        mediaKey: uploaded.body.key,
        mediaKind: 'video',
        alt: 'فدّيو',
        published: true,
      },
    })
    expect(response.status).toBe(422)
  })
})

test.describe('الرئيسية على الجوال', () => {
  test('الستوريز والبنرات تظهر، والمنتهي لا يغادر الخادم', async ({ page }) => {
    await loginAdmin(page)
    await makeStory(page, { title: 'ستوري ظاهر', sortOrder: 5 })
    await makeBanner(page, { title: 'بنر ظاهر', alt: 'بنرٌ قائم', sortOrder: 5 })
    await makeBanner(page, {
      title: 'بنر منتهٍ',
      alt: 'بنرٌ انتهت مدّته',
      endsAt: new Date(Date.now() - 60_000).toISOString(),
    })
    await makeBanner(page, {
      title: 'بنر لم يبدأ',
      alt: 'بنرٌ لم تبدأ مدّته',
      startsAt: new Date(Date.now() + 3_600_000).toISOString(),
    })
    await makeBanner(page, { title: 'بنر مسودّة', alt: 'بنرٌ لم يُنشر', published: false })

    await page.setViewportSize(MOBILE)
    await page.goto('/')

    await expect(page.getByRole('region', { name: 'جديد المنصّة' })).toBeVisible()
    await expect(page.getByText('ستوري ظاهر')).toBeVisible()

    const banners = page.getByRole('region', { name: 'إعلانات المنصّة' })
    await expect(banners).toBeVisible()
    await expect(banners.getByAltText('بنرٌ قائم')).toBeVisible()

    /*
     * **لا يُقاس الإخفاء بل الغياب.**
     *
     * ما انتهت مدّته لا يُرسَل أصلًا — فلا يبقى رابطُ إعلانٍ مدفوعٍ انقضى في
     * مصدر الصفحة لمن قرأه. و`toBeHidden` كانت ستمرّ ولو وصل مخفيًّا.
     */
    const html = await page.content()
    expect(html).not.toContain('بنرٌ انتهت مدّته')
    expect(html).not.toContain('بنرٌ لم تبدأ مدّته')
    expect(html).not.toContain('بنرٌ لم يُنشر')
  })

  test('ولا تظهر على الحاسوب — الواجهة التعريفية تبقى كما هي', async ({ page }) => {
    await loginAdmin(page)
    await makeStory(page, { title: 'ستوري الحاسوب' })
    await makeBanner(page, { title: 'بنر الحاسوب', alt: 'بنرُ فحص الحاسوب' })

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')

    await expect(page.getByRole('region', { name: 'جديد المنصّة' })).toBeHidden()
    await expect(page.getByRole('region', { name: 'إعلانات المنصّة' })).toBeHidden()
    /* والرئيسية على حالها: أقسام اللوحات باقية */
    await expect(page.getByRole('heading', { name: 'مزادات جارية' })).toBeVisible()
  })

  test('الحلقة تفتح العارض، وينتقل بالضغط ويُغلق', async ({ page }) => {
    await loginAdmin(page)
    /*
     * مدّةٌ طويلة عمدًا: بثلاث ثوانٍ يتقدّم العارض وحده بين تأكيدٍ وآخر،
     * فيُقاس تقدّمٌ تلقائيّ مكان تقدّمٍ بالضغط. وهو ما وقع أوّل مرّة.
     */
    await makeStory(page, { title: 'الأولى', alt: 'المحتوى الأوّل', sortOrder: 0, durationSeconds: 15 })
    await makeStory(page, { title: 'الثانية', alt: 'المحتوى الثاني', sortOrder: 1, durationSeconds: 15 })

    await page.setViewportSize(MOBILE)
    await page.goto('/')

    const rail = page.getByRole('region', { name: 'جديد المنصّة' })
    await rail.getByRole('button').filter({ hasText: 'الأولى' }).click()

    const viewer = page.getByRole('dialog')
    await expect(viewer).toBeVisible()
    await expect(viewer).toHaveAttribute('aria-label', 'الأولى')

    await viewer.getByRole('button', { name: 'التالي' }).click()
    await expect(viewer).toHaveAttribute('aria-label', 'الثانية')

    await viewer.getByRole('button', { name: 'السابق' }).click()
    await expect(viewer).toHaveAttribute('aria-label', 'الأولى')

    await viewer.getByRole('button', { name: 'إغلاق' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('والصورة تتقدّم بنفسها بعد مدّتها', async ({ page }) => {
    await loginAdmin(page)
    await makeStory(page, { title: 'قصيرة', sortOrder: 0, durationSeconds: 3 })
    await makeStory(page, { title: 'بعدها', sortOrder: 1 })

    await page.setViewportSize(MOBILE)
    await page.goto('/')
    await page
      .getByRole('region', { name: 'جديد المنصّة' })
      .getByRole('button')
      .filter({ hasText: 'قصيرة' })
      .click()

    const viewer = page.getByRole('dialog')
    await expect(viewer).toHaveAttribute('aria-label', 'قصيرة')
    await expect(viewer).toHaveAttribute('aria-label', 'بعدها', { timeout: 10_000 })
  })
})

test.describe('حدُّ ملفّات المستخدمين', () => {
  /**
   * **البادئة الخاصّة لا تُقدَّم لغير صاحبها.**
   *
   * `users-files/<id>/` موضعُ إثبات نقل الملكيّة وما يشبهه — وثيقةٌ تخصّ
   * صاحبها لا بنرٌ يُراد له أن يُرى.
   *
   * ويُقاس **الطرفان**: أنّ الغريب يُردّ، **وأنّ الصاحب يُقبل**. وبلا الثاني
   * يمرّ الفحص ولو كان المسار مكسورًا كلَّه فيردّ الجميعَ بـ404.
   *
   * ولا يُحتاج إلى معرفة أيّ معرّفٍ لأيّ مستخدم: يُرفع ملفٌّ لكلّ مستخدم، ثمّ
   * يُقاس أنّ مستخدمًا بعينه يفتح **واحدًا فقط** من الجميع.
   */
  test('كلٌّ يفتح ملفَّه وحده، والإدارة تفتحها كلَّها، والغريب لا شيء', async ({
    page,
    browser,
  }) => {
    await loginAdmin(page)

    /* المعرّفات من صفحة الإدارة — لا مسارَ عامًّا يكشفها */
    await page.goto('/admin/users')
    const ids = [...new Set((await page.content()).match(/usr_[a-z0-9]{20}/g) ?? [])]
    expect(ids.length).toBeGreaterThanOrEqual(3)

    const keys: string[] = []
    for (const id of ids) {
      const uploaded = await upload(page, {
        name: 'proof.pdf',
        mime: 'application/pdf',
        base64: Buffer.from('%PDF-1.4 إثبات نقل ملكيّة').toString('base64'),
        purpose: 'user-file',
        ownerId: id,
      })
      expect(uploaded.status, id).toBe(200)
      expect(uploaded.body.key, id).toMatch(new RegExp(`^users-files/${id}/`))
      keys.push(uploaded.body.key)
    }

    /* الإدارة تفتحها كلَّها */
    for (const key of keys) {
      expect((await head(page, `/api/media/${key}`)).status, key).toBe(200)
    }

    /* والغريب بلا جلسة لا يفتح شيئًا — و**404 لا 403**: 403 تُثبت الوجود */
    const stranger = await browser.newContext()
    const strangerPage = await stranger.newPage()
    await strangerPage.goto('/')
    for (const key of keys) {
      expect((await head(strangerPage, `/api/media/${key}`)).status, key).toBe(404)
    }
    await stranger.close()

    /* ووليد يفتح واحدًا فقط — هو ملفُّه */
    const owner = await browser.newContext()
    const ownerPage = await owner.newPage()
    await loginUser(ownerPage, USERS.waleed)

    const statuses = await Promise.all(
      keys.map(async (key) => (await head(ownerPage, `/api/media/${key}`)).status),
    )
    expect(statuses.filter((status) => status === 200)).toHaveLength(1)
    expect(statuses.filter((status) => status === 404)).toHaveLength(keys.length - 1)
    await owner.close()
  })

  test('والخاصُّ لا يُخزَّن في وسيط، والعامُّ يُخزَّن طويلًا', async ({ page }) => {
    await loginAdmin(page)
    await page.goto('/admin/users')
    const id = ((await page.content()).match(/usr_[a-z0-9]{20}/) ?? [])[0]!

    const secret = await upload(page, {
      name: 'p.pdf',
      mime: 'application/pdf',
      base64: Buffer.from('%PDF-1.4 x').toString('base64'),
      purpose: 'user-file',
      ownerId: id,
    })
    const priv = await head(page, `/api/media/${secret.body.key}`)
    expect(priv.cacheControl).toContain('no-store')
    expect(priv.nosniff).toBe('nosniff')

    const open = await uploadFixture(page, 'banner-2x1.png', 'banner')
    const pub = await head(page, `/api/media/${open.body.key}`)
    expect(pub.cacheControl).toContain('immutable')
    expect(pub.nosniff).toBe('nosniff')
  })

  test('واجتيازُ المسار يُردّ قبل أن يبلغ القرص', async ({ browser }) => {
    const context = await browser.newContext()
    for (const bad of [
      '/api/media/etc/passwd',
      '/api/media/platform/../users-files/x/a.pdf',
      '/api/media/..%2F..%2Fetc%2Fpasswd',
    ]) {
      const response = await context.request.get(bad, { maxRedirects: 0 })
      expect([404, 400], bad).toContain(response.status())
    }
    await context.close()
  })
})

test.describe('سياسة المحتوى', () => {
  test('`media-src` مذكورةٌ صراحةً — وبلاها لا يُشغَّل فدّيو الستوري', async ({ page }) => {
    const response = await page.goto('/')
    const policy =
      response?.headers()['content-security-policy'] ??
      response?.headers()['content-security-policy-report-only'] ??
      ''

    expect(policy).toContain('media-src')

    /*
     * والوسائط كلُّها من أصلنا — تُقدَّم من `/api/media/` لا من نطاقٍ آخر.
     *
     * فلا مضيفَ خارجيٌّ في السياسة، ولا `https:` مفتوحة. وهذا الفحص يحرس
     * ألّا يُفتح البابُ يومًا بإضافةٍ عابرة.
     */
    expect(policy).not.toMatch(/img-src[^;]*\shttps:(\s|;|$)/)
    expect(policy).not.toMatch(/media-src[^;]*\shttps:(\s|;|$)/)
  })
})
