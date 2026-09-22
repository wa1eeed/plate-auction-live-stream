import { expect, test } from '@playwright/test'
import { stableCount } from '../support/ui'
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
    /*
     * **عددٌ مستقرّ لا أوّلُ عدد.**
     *
     * شبكة السوق تُصيَّر على الخادم ثمّ تنمو بعد الترطيب بدفعةٍ ثانية بلا
     * طلب. فقياسٌ يقع في تلك الفجوة يقرأ عددًا لا يبقى، ويُقارَن بعده بعددٍ
     * آخر فيُخفق الفحص بلا عطبٍ في المنصّة — وقد وقع ذلك تحت حمل المجموعة.
     */
    const before = await stableCount(page.locator('a[href^="/market/"]'))
    expect(before).toBeGreaterThan(0)

    await context.setOffline(true)
    await expect(page.locator('[role="status"]').first()).toBeVisible({ timeout: 8_000 })

    /* البطاقات باقية — الانقطاع يُعلَن ولا يُبدّل ما يُقرأ */
    expect(await page.locator('a[href^="/market/"]').count()).toBeGreaterThanOrEqual(before)
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
    await expect(page.getByRole('navigation', { name: 'التنقّل', exact: true })).toHaveCount(0)
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
  test('الإعدادات بلغت صفحة الإعدادات', async ({ page }) => {
    await loginUser(page, USERS.waleed)
    await page.goto('/account/settings')

    /* داخل `#main` — فشريط الأقسام يحمل رابطًا بالاسم نفسه */
    const main = page.locator('#main')
    await expect(main.getByText('الإعدادات', { exact: true }).first()).toBeVisible()
    await expect(main.getByText('أصوات المنصّة').first()).toBeVisible()
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

test.describe('التمرير في حاوية لا في المستند', () => {
  /*
   * أصلُ ثلاثة أعطابٍ ظهرت على الجهاز: الهيدر يتزحزح، والملاحة ترتفع فيظهر
   * فراغٌ تحتها. وسببُها أنّ WKWebView يرتدّ عند طرفَي المستند، **وفي أثناء
   * الارتداد تتحرّك العناصر الثابتة معه**. فإن لم يُمرَّر المستند لم يكن ثمّ
   * ارتدادٌ يتبعه شيء.
   */
  test('حاوية التمرير معلَّمة في كلّ صفحة', async ({ page }) => {
    for (const path of ['/', '/market', '/faq']) {
      await page.goto(path)
      await expect(page.locator('[data-app-scroll]').first()).toBeAttached()
    }
  })

  test('والمستند يبقى ممرَّرًا في الويب — لا يُحبس', async ({ page }) => {
    await page.goto('/market')
    const overflow = await page.evaluate(() => getComputedStyle(document.body).overflow)
    expect(overflow, 'حُبس تمرير المستند في المتصفّح').not.toBe('hidden')
  })
})

test.describe('صفحة اللوحة بلا ملاحةٍ سفلية', () => {
  test('ورابط الرجوع القديم للويب وحده', async ({ page }) => {
    await page.goto('/market')
    const href = await page.locator('a[href^="/market/"]').first().getAttribute('href')
    await page.goto(href!)
    await expect(page.locator('#main').first()).toBeVisible()

    /*
     * الرابط يُرسم في الويب — و`[data-web-only]` تُخفيه في الغلاف بـCSS.
     * فحضورُ السمة هو ما يُقاس: الإخفاء نفسه لا يقع إلّا مع `data-native`.
     */
    const back = page.locator('a[data-web-only][href="/market"]').first()
    await expect(back).toBeVisible()
  })
})

test.describe('التذييل وقائمة العضوية للويب', () => {
  test('التذييل معلَّمٌ للويب — ويُخفى في الغلاف', async ({ page }) => {
    await page.goto('/market')
    /* يُرسم هنا، و`[data-web-only]` تُخفيه مع `data-native` */
    await expect(page.locator('footer[data-web-only]')).toHaveCount(1)
  })

  test('ولا زرّ إعداداتٍ في المتصفّح — القائمة على حالها', async ({ page }) => {
    await loginUser(page, USERS.waleed)
    await page.goto('/market')
    await expect(page.getByRole('link', { name: 'الإعدادات' })).toHaveCount(0)
  })

  test('وروابط التذييل كلُّها محفوظةٌ في صفحة الإعدادات', async ({ page }) => {
    await loginUser(page, USERS.waleed)
    await page.goto('/account/settings')
    const main = page.locator('#main')
    for (const label of ['كيف يعمل السوق', 'الأسئلة الشائعة', 'محفظتي']) {
      await expect(main.getByRole('link', { name: label }).first()).toBeVisible()
    }
  })
})

test.describe('صفحة الإعدادات', () => {
  test('بيانات الحساب خلف سطرٍ — لا حقولٌ في الصفحة', async ({ page }) => {
    await loginUser(page, USERS.waleed)
    await page.goto('/account/settings')

    /* لا حقولَ مملوءة تدعو إلى تعديلٍ من لا يريده */
    await expect(page.locator('#main input')).toHaveCount(0)

    const row = page.getByRole('link', { name: /بيانات حسابي/ })
    await expect(row).toBeVisible()
    await row.click()
    await expect(page.getByRole('heading', { name: 'بيانات حسابي' })).toBeVisible()
    /* والحقول هناك */
    await expect(page.locator('#main input').first()).toBeVisible()
  })

  test('وشريط الأقسام معلَّمٌ للإخفاء فيها', async ({ page }) => {
    await loginUser(page, USERS.waleed)
    await page.goto('/account/settings')
    /* العلامتان موجودتان، والإخفاء يقع بـ`:has` في CSS */
    await expect(page.locator('[data-settings-page]')).toHaveCount(1)
    await expect(page.locator('[data-section-rail]')).toHaveCount(1)
  })

  test('ومفتاحا الصوت والإشعارات صفّان يُضغطان كاملين', async ({ page }) => {
    await loginUser(page, USERS.waleed)
    await page.goto('/account/settings')

    /* داخل `#main` — والهيدر يحمل أيقونة صوتٍ باسمٍ مشابه */
    const sound = page.locator('#main').getByRole('button', { name: /أصوات المنصّة/ })
    await expect(sound).toBeVisible()
    /*
     * الصفُّ كلُّه هدف — لا مفتاحٌ بعرض نصف إبهام وحوله فراغٌ لا يستجيب.
     * فيُقاس عرضُه: أقلُّ من نصف الشاشة يعني أنّه عاد أيقونةً في طرف.
     */
    const box = await sound.boundingBox()
    expect(box!.width, 'صفُّ الصوت ضيّق — عاد أيقونةً لا صفًّا').toBeGreaterThan(200)
    expect(box!.height, 'صفٌّ قصير يصعب لمسه').toBeGreaterThanOrEqual(44)
  })
})

/**
 * السحب للتحديث يبقى بعد التنقّل.
 *
 * وكان يموت بعده: المستمعات تُركَّب على `[data-app-scroll]` المُلتقَط مرّةً
 * عند التركيب، وموجِّه Next يستبدل شجرة الصفحة عند كلّ تنقّل — فتبقى
 * المستمعات على عقدةٍ مفصولةٍ لا يصلها لمس. فيعمل السحب مرّةً أو مرّتين ثمّ
 * لا يعمل، وهو ما شُكي منه.
 *
 * والغلاف يُصطنع هنا: `Capacitor` لا وجود له في متصفّحٍ عاديّ، وما يُقاس هو
 * الربطُ لا الجسر.
 */
test.describe('السحب للتحديث', () => {
  /** يسحب أربعين بكسلًا من أعلى الشاشة ويُرجع إزاحةَ المؤشّر بعدها. */
  const DRAG = `(async () => {
    const at = (y) => {
      const t = new Touch({ identifier: 1, target: document.body, clientX: 40, clientY: y })
      return { touches: [t], targetTouches: [t], changedTouches: [t], bubbles: true, cancelable: true }
    }
    document.dispatchEvent(new TouchEvent('touchstart', at(10)))
    for (const y of [40, 90, 140, 190]) {
      document.dispatchEvent(new TouchEvent('touchmove', at(y)))
      await new Promise((r) => requestAnimationFrame(r))
    }
    const dot = document.querySelector('[role="status"] span')
    const shift = dot ? new DOMMatrix(getComputedStyle(dot).transform).m42 : -1
    document.dispatchEvent(new TouchEvent('touchend', at(190)))
    return shift
  })()`

  test('يعمل في الرئيسية، ويبقى عاملًا في السوق بعد التنقّل', async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as unknown as { Capacitor: unknown }).Capacitor = {
        isNativePlatform: () => true,
        getPlatform: () => 'ios',
      }
    })
    await page.goto('/')
    /* الملاحة السفلية دليلُ أنّ الغلاف صُدِّق فعلًا */
    await expect(page.getByRole('navigation', { name: 'التنقّل', exact: true })).toBeVisible()

    const first = await page.evaluate(DRAG)
    expect(first, 'المؤشّر لم ينزل مع الإصبع في الرئيسية').toBeGreaterThan(10)

    /* تنقّلٌ من جهة العميل — وهو ما كان يقطع الربط */
    await page.getByRole('navigation', { name: 'التنقّل', exact: true }).getByRole('link', { name: 'السوق' }).click()
    await page.waitForURL('**/market')
    await expect(page.locator('a[href^="/market/"]').first()).toBeVisible()

    const second = await page.evaluate(DRAG)
    expect(second, 'مات السحب بعد التنقّل — المستمع على عقدةٍ مفصولة').toBeGreaterThan(10)
  })
})

/**
 * مفتاح الإعدادات **داخل صفّه**.
 *
 * وكان خارجه: الصفُّ `button` والمفتاح `SwitchPrimitives.Root` وهو `button`
 * آخر — وزرٌّ لا يَسَع زرًّا. فيُغلق المحلّلُ الصفَّ عند أوّل `<button>` داخله
 * ويرفع المفتاح إلى ما بعده: يسقط سطرًا وحده تحت النصّ، وهو `pointer-events-none`
 * فلا يستجيب للمس. فيُرى مفتاحًا مكسورًا لا يُضغط — وقد رُئي.
 *
 * **والقياس على المرسوم لا على وجود سمة.** وأوّلُ صياغةٍ كانت تعدّ عنصرًا
 * بسمةٍ وضعناها نحن، فمرّت على النسخة المعطوبة حين جُرّبت: السمة كانت على
 * الغلاف والمرفوعُ ما بداخله. فصار القياس على شيئين لا يكذبان: **لا ضابط
 * داخل الصفّ** (`role="switch"` وهو زرٌّ في زرّ)، و**الوجه داخل صندوق صفّه**.
 */
test.describe('مفاتيح الإعدادات', () => {
  test('الوجه داخل صفّه، والصفُّ كلُّه يُبدّل الحال', async ({ page }) => {
    await loginUser(page)
    await page.goto('/account/settings')

    /*
     * مرساةُ البداية مقصودة: في الهيدر زرُّ صوتٍ اسمُه «إيقاف أصوات المنصّة»
     * يظهر على الواسع، فبلا المرساة يُصيب المحدِّدُ اثنين.
     */
    const row = page.getByRole('button', { name: /^أصوات المنصّة/ })
    await expect(row).toBeVisible()

    /*
     * لا ضابطَ داخل صفحة الإعدادات.
     *
     * صفوفُها كلُّها أزرار تحمل حالَها في `aria-pressed`، فـ`role="switch"`
     * فيها يعني زرًّا داخل زرّ — وهو ما يرفعه المحلّل.
     */
    await expect(page.locator('[data-settings-page] [role="switch"]')).toHaveCount(0)

    /* والوجه داخل صندوق صفّه — لا سطرًا وحده تحته */
    const boxes = await page.evaluate(() => {
      const button = [...document.querySelectorAll('[data-settings-page] button')].find((el) =>
        (el.getAttribute('aria-label') ?? el.textContent ?? '').trimStart().startsWith('أصوات'),
      )!
      const face = document.querySelector('[data-settings-page] [data-switch-face]')!
      const r = button.getBoundingClientRect()
      const f = face.getBoundingClientRect()
      return {
        rowTop: r.top, rowBottom: r.bottom,
        faceMidY: f.top + f.height / 2,
        faceWidth: f.width,
      }
    })
    expect(boxes.faceWidth).toBeGreaterThan(40)
    expect(boxes.faceMidY).toBeGreaterThan(boxes.rowTop)
    expect(boxes.faceMidY).toBeLessThan(boxes.rowBottom)

    /* والصفُّ كلُّه هو الهدف: ضغطةٌ على نصّه تُبدّل الحال */
    const face = row.locator('[data-switch-face]')
    const before = await face.getAttribute('data-state')
    await row.getByText('أصوات المنصّة').click()
    await expect(face).not.toHaveAttribute('data-state', before ?? '')

    /* والإبهام ينتقل فعلًا — لا يتبدّل الاسم وحده */
    const thumbStart = () =>
      face.locator('span').first().evaluate((el) => getComputedStyle(el).insetInlineStart)
    const moved = await thumbStart()
    await row.getByText('أصوات المنصّة').click()
    await expect.poll(thumbStart).not.toBe(moved)
  })
})
