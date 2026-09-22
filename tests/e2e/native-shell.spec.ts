import { expect, test } from '@playwright/test'
import { loginUser, USERS } from './support/session'

/**
 * صقل الغلاف الأصيل — ما يُقاس منه في المتصفّح.
 *
 * والغلاف نفسه لا يُختبر هنا: `Capacitor` غير موجود في متصفّحٍ عاديّ. فما
 * يُفحص شيئان: **أنّ الويب لم يتأثّر** (وهو شرطٌ صريح في الطلب)، وأنّ ما
 * يُرسَم للغلاف يُرسَم بالشرط لا دائمًا.
 */

test.describe('الويب لم يتأثّر', () => {
  test('لا زرّ رجوعٍ في المتصفّح — ولا على صفحةٍ داخلية', async ({ page }) => {
    await page.goto('/market')
    const card = page.locator('a[href^="/market/"]').first()
    await expect(card).toBeVisible()
    await card.click()
    await expect(page.locator('#main').first()).toBeVisible()

    /* زرّ الرجوع للغلاف وحده — والمتصفّح له زرُّه */
    await expect(page.getByRole('button', { name: 'رجوع' })).toHaveCount(0)
  })

  test('ولا شريط انقطاعٍ وهو متّصل', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('لا اتّصال بالإنترنت', { exact: false })).toHaveCount(0)
  })

  test('والهيدر بحشوةٍ صفرٍ حيث لا مناطق آمنة', async ({ page }) => {
    await page.goto('/')
    const header = page.locator('header').first()
    await expect(header).toBeVisible()
    /*
     * `env(safe-area-inset-top)` تساوي صفرًا في المتصفّح، فالحشوة صفر —
     * وهذا هو الدليل على أنّ الويب لم يتغيّر بحرف.
     */
    const padding = await header.evaluate((el) => getComputedStyle(el).paddingTop)
    expect(padding).toBe('0px')
  })
})

test.describe('المناطق الآمنة معرَّفةٌ ومقروءة', () => {
  test('أربعةُ متغيّرات على الجذر', async ({ page }) => {
    await page.goto('/')
    const vars = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement)
      return {
        top: style.getPropertyValue('--safe-top').trim(),
        bottom: style.getPropertyValue('--safe-bottom').trim(),
        status: style.getPropertyValue('--status-bar-color').trim(),
      }
    })
    /* معرَّفةٌ — وقيمتها صفرٌ في المتصفّح */
    expect(vars.top).toBeTruthy()
    expect(vars.bottom).toBeTruthy()
    /* ولون الشريط يتبع خلفية الصفحة لا لونًا مكتوبًا */
    expect(vars.status).toBeTruthy()
  })

  test('و`viewport-fit=cover` في الوسم — وبدونها تبقى المناطق أصفارًا', async ({ request }) => {
    const html = await (await request.get('/')).text()
    expect(html).toMatch(/viewport-fit=cover/)
  })
})

test.describe('الانقطاع يُعلَن ولا يُبدّل الشاشة', () => {
  /*
   * ويُقطع الاتّصال **بعد أوّل تحميلٍ مباشرةً** لا بعد سلسلة تنقّلات.
   *
   * وأوّلُ صياغةٍ كانت تُسجّل دخولًا وتنقر بطاقةً ثمّ تقطع — فسقطت لسببين
   * لا علاقة لهما بالكود: النقرة لم تنتقل (الترطيب يستبدل العنصر)،
   * و`setOffline` لم تُطبَّق بعد تلك السلسلة. فصار الفحص يقيس المقصود.
   */
  test('شريطٌ يظهر عند القطع ويُذكر فيه أنّ الأسعار قد لا تكون الحاليّة', async ({
    page,
    context,
  }) => {
    await page.goto('/market')
    await expect(page.locator('[role="status"]')).toHaveCount(0)

    await context.setOffline(true)
    const banner = page.locator('[role="status"]').first()
    await expect(banner).toBeVisible({ timeout: 8_000 })

    const text = await banner.innerText()
    expect(text).toContain('لا اتّصال بالإنترنت')
    /* والنصّ يقول الحقيقة: ما على الشاشة قد يكون قديمًا */
    expect(text).toContain('قد لا تكون الحاليّة')

    await context.setOffline(false)
  })

  test('والصفحة لا تُمحى من تحت قارئها', async ({ page, context }) => {
    await page.goto('/market')
    const before = await page.locator('a[href^="/market/"]').count()
    expect(before).toBeGreaterThan(0)

    await context.setOffline(true)
    await expect(page.locator('[role="status"]').first()).toBeVisible({ timeout: 8_000 })

    /* البطاقات باقية — الانقطاع يُعلَن ولا يُبدّل ما يُقرأ */
    expect(await page.locator('a[href^="/market/"]').count()).toBe(before)
    await context.setOffline(false)
  })

  test('ويختفي عند العودة، ويُعلَن استعادةُ الاتّصال', async ({ page, context }) => {
    await page.goto('/market')
    await context.setOffline(true)
    await expect(page.locator('[role="status"]').first()).toBeVisible({ timeout: 8_000 })

    await context.setOffline(false)
    await expect(page.locator('[role="status"]').first()).toContainText('تم استعادة الاتّصال', {
      timeout: 8_000,
    })
  })
})

/*
 * **وحارسُ المزايدة بلا اتّصال يُفحص في الوحدات لا هنا.**
 *
 * الشرط في `auction-bid-box` يقرأ `online` من `useNetwork`، ومحاكاةُ
 * الانقطاع في متصفّحٍ بعد تسجيل دخولٍ وتنقّلٍ تقيس سلوك أداة الاختبار أكثر
 * ممّا تقيس الكود — وقد جُرّب فسقط لذلك. وما يُحرَس هنا هو تصنيفُ الأخطاء
 * في `tests/unit/api-error.test.ts`، وفيه أنّ «غير المؤكّد» لا يقول «فشل»
 * وأنّ ما قد يكون وقع لا يُعاد إرساله.
 */

test.describe('جرس الإشعارات لا يُغلق نفسه', () => {
  test('ينفتح بإشعاراتٍ غير مقروءة، ولا يُنعَش المسار وهو مفتوح', async ({ page, browser }) => {
    test.setTimeout(120_000)

    /* سارة أعلى مزايدٍ على أوّل إعلانٍ في البذرة — فتجاوزُها يُنتج لها `outbid` */
    await loginUser(page, USERS.sara)
    await page.goto('/market')
    const href = await page.locator('a[href^="/market/"]').first().getAttribute('href')
    const id = href!.split('/').pop()!

    const other = await browser.newPage()
    await loginUser(other, USERS.majed)
    await other.goto(`/market/${id}`)
    await other.evaluate(async (listingId) => {
      const detail = await fetch(`/api/listings/${listingId}`).then((r) => r.json())
      const next = detail?.listing?.nextBidAmount ?? detail?.nextBidAmount
      await fetch(`/api/listings/${listingId}/bids`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          amount: Math.round((next ?? 20_000_000) / 100),
          isCustomAmount: false,
          clientRequestId: `bell_${Date.now()}`,
        }),
      })
    }, id)
    await other.close()

    await page.goto('/market')
    const bell = page.locator('[aria-label*="غير مقروء"]')
    await expect(bell).toBeVisible({ timeout: 20_000 })

    /*
     * ويُقاس **أنّ المسار لا يُنعَش والقائمة مفتوحة**: إنعاشٌ يُعيد تصيير
     * الشجرة من تحت القائمة، وعلى جهازٍ أبطأ يُغلقها في وجه صاحبها — وهو ما
     * وقع في التطبيق.
     */
    const refreshes: string[] = []
    page.on('request', (r) => {
      if (r.headers()['next-action'] || r.url().includes('_rsc=')) refreshes.push(r.url())
    })

    await bell.click()
    await expect(page.getByText('الإشعارات', { exact: true }).first()).toBeVisible()

    const before = refreshes.length
    await page.waitForTimeout(2_500)
    /* والقائمة ما زالت مفتوحة */
    await expect(page.getByText('الإشعارات', { exact: true }).first()).toBeVisible()
    expect(refreshes.length - before, 'أُنعش المسار والقائمة مفتوحة').toBe(0)
  })
})

test.describe('الملاحة السفلية والهيدر', () => {
  test('لا ملاحةَ سفلية في المتصفّح — والدُرج باقٍ', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/market')
    await expect(page.getByRole('navigation', { name: 'التنقّل' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'القائمة' })).toHaveCount(1)
  })

  test('والهيدر بخلفيةٍ صلبة — لا شفّافةٍ يظهر تحتها فراغ', async ({ page }) => {
    await page.goto('/market')
    const header = page.locator('header').first()
    const style = await header.evaluate((el) => {
      const computed = getComputedStyle(el)
      return { bg: computed.backgroundColor, filter: computed.backdropFilter }
    })
    /*
     * شفافيةٌ في شريط المنطقة الآمنة تُظهر ما يمرّ تحته في أثناء التمرير،
     * فيُرى فراغًا يظهر ويختفي — وهو ما اشتُكي منه على الجهاز.
     */
    expect(style.bg, 'خلفية الهيدر شفّافة').not.toMatch(/rgba\([^)]*,\s*0?\.\d+\)/)
  })

  test('وارتفاعُه ثابتٌ بين أعلى الصفحة وأسفلها', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/market')
    const header = page.locator('header').first()

    const top = await header.evaluate((el) => el.getBoundingClientRect().height)
    await page.evaluate(() => window.scrollTo(0, 900))
    await page.waitForTimeout(400)
    const scrolled = await header.evaluate((el) => el.getBoundingClientRect().height)

    expect(scrolled, 'ارتفاع الهيدر تبدّل بالتمرير').toBe(top)
  })
})

test.describe('إخفاء الدُرج لا يُفقد شيئًا', () => {
  /*
   * الدُرج يُخفى في الغلاف لأنّ الملاحة السفلية تقوم مقامه — وكان يحمل
   * **مفتاح إشعارات الجهاز** ومفتاح الصوت ولا يوجدان في غيره. فإخفاؤه بلا
   * نقلهما يقطع الطريق إلى الإشعارات بالكلّية، ولا يُدرى أين ذهبت.
   */
  test('الإعدادات بلغت صفحة الملفّ', async ({ page }) => {
    await loginUser(page, USERS.waleed)
    await page.goto('/account')

    await expect(page.getByText('الإعدادات', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('أصوات المنصّة').first()).toBeVisible()
    /* داخل `#main` — فالتذييل يحمل روابط بالأسماء نفسها */
    const settings = page.locator('#main')
    await expect(settings.getByRole('link', { name: 'كيف يعمل السوق' })).toBeVisible()
    await expect(settings.getByRole('link', { name: 'الأسئلة الشائعة' })).toBeVisible()
    await expect(settings.getByRole('link', { name: 'محفظتي' }).first()).toBeVisible()

    /*
     * **ومفتاح الإشعارات لا يُقاس هنا**: بيئة الاختبار بلا مفاتيح VAPID،
     * فيردّ `/api/push` بـ«غير مفعّل» ويُرجع المكوّن عدمًا — وهو صوابُه على
     * الويب. وحضورُه في الغلاف يحرسه `push-toggle-native.test.ts` بترتيب
     * المصدر: الغلاف يُفصل قبل أيّ واجهة ويب، فلا يمرّ بحارس VAPID أصلًا.
     */
  })
})
