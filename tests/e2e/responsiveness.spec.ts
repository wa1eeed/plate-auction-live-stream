import { expect, test, type Page } from '@playwright/test'
import { loginUser } from './support/session'

/*
 * **سلاسة التصفّح — أن تُجيب الضغطةُ فورًا.**
 *
 * كلُّ صفحةٍ في المنصّة `force-dynamic`: لا شيء يُخدَم من ذاكرة العميل، فكلُّ
 * ضغطةٍ رحلةٌ كاملة إلى الخادم. وهي خمسون ملّي على اتّصالٍ جيّد فلا تُرى،
 * وثوانٍ على جوّالٍ نام راديوه — وبلا إشارةٍ تُقرأ الضغطةُ سقوطًا: «الزرّ
 * لا يعمل». وهو ما بُلِّغ عنه فعلًا.
 *
 * فيُقاس هنا **بخادمٍ أُبطئ عمدًا**: بلا إبطاء يمرّ الفحص ولو لم يكن ثمّة
 * إشارةٌ إطلاقًا — لأنّ الصفحة تصل قبل أن يظهر شيء.
 */

/** يؤخّر ردود الخادم فتُرى فترةُ الانتظار كما يراها من شبكتُه بطيئة. */
async function slowNetwork(page: Page, ms: number) {
  await page.route('**/*', async (route) => {
    const url = route.request().url()
    /* الملفّات الساكنة تبقى سريعة: المقصود ردُّ الخادم لا التحميل */
    if (url.includes('/_next/static/')) return route.continue()
    await new Promise((resolve) => setTimeout(resolve, ms))
    return route.continue()
  })
}

/** يضغط رابطًا ويقيس متى ظهرت **أيّ** إشارةِ انتظار. */
async function firstSignal(page: Page, href: string) {
  return page.evaluate(async (target) => {
    const link = [...document.querySelectorAll('a')].find(
      (a) => a.getAttribute('href') === target,
    )
    if (!link) return { found: false, ms: null as number | null, kind: null as string | null }

    const start = performance.now()
    link.click()

    for (let i = 0; i < 200; i += 1) {
      const bar = document.querySelector('.route-progress-bar')
      const skeleton = document.querySelector('.skeleton')
      if (bar || skeleton) {
        return {
          found: true,
          ms: Math.round(performance.now() - start),
          kind: skeleton ? 'skeleton' : 'bar',
        }
      }
      if (window.location.pathname === target) break
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
    return { found: false, ms: null, kind: null }
  }, href)
}

test.describe('الضغطة تُجيب فورًا', () => {
  test('كلُّ انتقالٍ من الحساب يُظهر إشارةَ انتظارٍ في أقلّ من نصف ثانية', async ({ page }) => {
    await loginUser(page)
    await page.goto('/account')
    /*
     * يُنتظر الترطيب قبل الإبطاء.
     *
     * فالمستمع يُركَّب في أثرٍ بعد التركيب، وضغطةٌ تسبقه لا يُمسكها شيء.
     * وهي حالةٌ حقيقية لكنّها ليست المقصودة: صفحةٌ وصلت لتوّها انتظرها
     * صاحبُها أصلًا، والشكوى فيما يقع **بعد طول بقاء** حيث الترطيب تمّ.
     */
    await expect(page.locator('html[data-route-progress="ready"]')).toBeAttached()
    await slowNetwork(page, 900)

    /*
     * والانتقال الثاني هو المقصود: حدُّ `account/loading` يُثار عند تبدّل
     * جزئه، والانتقال بين ابنين لا يُبدّله — فكان يمرّ **بلا هيكلٍ واحد**.
     */
    for (const href of ['/account/settings', '/account/wallet', '/account/listings']) {
      const signal = await firstSignal(page, href)
      expect(signal.found, `لا إشارة انتظار عند ${href}`).toBe(true)
      expect(signal.ms, `الإشارة تأخّرت عند ${href} (${signal.kind})`).toBeLessThan(500)
      await page.waitForURL(`**${href}`)
    }
  })
})

test.describe('العدّاد لا يستنزف الخيط', () => {
  /**
   * **نبضةٌ في الثانية لا عشرٌ.**
   *
   * كان `setInterval(tick, 100)` لكلّ بطاقة: اثنتا عشرة بطاقةً في السوق
   * تعني مئةً وعشرين إعادةَ تصييرٍ في الثانية، تجري ما دامت الصفحة مفتوحة
   * — والمعروض ثوانٍ لا أعشارها.
   *
   * ويُقاس بعدد مرّات تبدّل النصّ لا بقراءة الكود: عشرُ ثوانٍ تعطي نحو عشر
   * تبدّلاتٍ للبطاقة الواحدة، وبالنبض القديم كانت مئة.
   */
  test('ينبض مرّةً في الثانية لا عشرًا', async ({ page }) => {
    /*
     * **يُقاس النبضُ نفسه لا أثرُه في الصفحة.**
     *
     * وأوّلُ صياغةٍ عدّت طفرات النصّ في `article` — فمرّت على النسخة القديمة
     * حين جُرّبت: React لا يكتب في DOM ما لم يتبدّل النصّ، والنصّ ثوانٍ
     * فيتبدّل مرّةً في الثانية مهما بلغ معدّل إعادة التصيير. فكان الفحص
     * يقيس ما لا علاقة له بما أُصلح.
     *
     * والمؤقّتات تُلفّ **قبل ترطيب التطبيق** (`addInitScript`)، فيُعدّ كلُّ
     * نداءٍ قصير المدّة — وهو ما يفعله العدّاد وحده في هذه الصفحة.
     */
    await page.addInitScript(() => {
      const w = window as unknown as { __ticks: number }
      w.__ticks = 0
      const countIfShort = <T extends (...args: never[]) => number>(original: T) =>
        function (this: unknown, handler: TimerHandler, timeout?: number, ...rest: never[]) {
          const wrapped =
            typeof handler === 'function' && (timeout ?? 0) <= 1100
              ? function (this: unknown, ...args: unknown[]) {
                  w.__ticks += 1
                  return (handler as (...a: unknown[]) => unknown).apply(this, args)
                }
              : handler
          return (original as unknown as (...a: unknown[]) => number).call(
            this,
            wrapped,
            timeout,
            ...rest,
          )
        }
      window.setTimeout = countIfShort(window.setTimeout) as typeof window.setTimeout
      window.setInterval = countIfShort(window.setInterval) as typeof window.setInterval
    })

    await page.goto('/market')
    await expect(page.locator('article').first()).toBeVisible()

    const cards = await page.locator('article').count()
    expect(cards).toBeGreaterThan(3)

    const ticks = await page.evaluate(async () => {
      const w = window as unknown as { __ticks: number }
      w.__ticks = 0
      await new Promise((resolve) => setTimeout(resolve, 6000))
      return w.__ticks
    })

    /*
     * ستُّ ثوانٍ × عددُ البطاقات ≈ الحدّ الأعلى للنبض بواحدةٍ في الثانية،
     * ويُترك هامشٌ للمؤقّتات الأخرى. والنبضُ القديم كان **عشرة أضعافه**.
     */
    const perSecondPerCard = ticks / 6 / cards
    expect(perSecondPerCard, `النبض ${perSecondPerCard.toFixed(1)} في الثانية لكلّ بطاقة`)
      .toBeLessThan(3)
  })

  test('ولا ينبض وهي مخفيّة — فلا يُستنزف شيءٌ في الخلفية', async ({ page }) => {
    /*
     * يُقاس **النبض** لا طفرات الصفحة.
     *
     * وأوّلُ صياغةٍ راقبت `document.body` كلَّه، فمرّت وحدها وسقطت في
     * المجموعة الكاملة: في الصفحة أشياءُ أخرى تتبدّل — بثٌّ لحظيّ يصل،
     * وقوائمُ تُحدَّث — فكان الفحص يحاسب العدّادَ على غيره.
     */
    await page.addInitScript(() => {
      const w = window as unknown as { __ticks: number }
      w.__ticks = 0
      const countIfShort = (original: typeof window.setTimeout) =>
        function (this: unknown, handler: TimerHandler, timeout?: number, ...rest: never[]) {
          const wrapped =
            typeof handler === 'function' && (timeout ?? 0) <= 1100
              ? function (this: unknown, ...args: unknown[]) {
                  w.__ticks += 1
                  return (handler as (...a: unknown[]) => unknown).apply(this, args)
                }
              : handler
          return (original as unknown as (...a: unknown[]) => number).call(
            this,
            wrapped,
            timeout,
            ...rest,
          )
        }
      window.setTimeout = countIfShort(window.setTimeout) as typeof window.setTimeout
      window.setInterval = countIfShort(
        window.setInterval as unknown as typeof window.setTimeout,
      ) as unknown as typeof window.setInterval
    })

    await page.goto('/market')
    await expect(page.locator('article').first()).toBeVisible()
    const cards = await page.locator('article').count()

    const ticks = await page.evaluate(async () => {
      const w = window as unknown as { __ticks: number }
      /* نُخفي الصفحة كما يفعل النظام حين يُصغَّر التطبيق */
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
      await new Promise((resolve) => setTimeout(resolve, 200))

      w.__ticks = 0
      await new Promise((resolve) => setTimeout(resolve, 3000))
      const counted = w.__ticks

      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
      return counted
    })

    /*
     * ثلاثُ ثوانٍ × عددُ البطاقات هو ما كان ينبض بالنبض المُصلَح وهي ظاهرة،
     * والمطلوب أن يسكت كلُّه وهي مخفيّة. ويُترك هامشٌ لمؤقّتاتٍ أخرى قصيرة
     * لا علاقة لها بالعدّاد.
     */
    expect(ticks, `نبض ${ticks} مرّةً وهي مخفيّة (${cards} بطاقة)`).toBeLessThan(cards)
  })
})

/**
 * **الزرُّ الذي «لا يعمل» — وهو يعمل وينتظر ردًّا لن يأتي.**
 *
 * كلُّ صفحةٍ `force-dynamic`، فضغطةُ الرابط جلبٌ من الخادم. وإن عَلِق ذلك
 * الجلب — على وصلةٍ بقيت في جدول المتصفّح وقد ماتت في الشبكة، وهو ما يقع بعد
 * أن يُعلَّق الغلافُ ساعةً ثمّ يُعاد إليه — **لا يقع شيء ولا يُقال شيء**.
 * فيُقرأ جمودًا، وقد قيل ذلك فعلًا عن هذه المنصّة.
 */
test.describe('التنقّل العالق يُنقَذ', () => {
  test('جلبٌ لا يعود يُقطع بتحميلٍ كامل — لا يُترك الزرّ صامتًا', async ({ page }) => {
    /*
     * ⚠ الاعتراضُ **قبل** فتح الصفحة — وقد جُرّب بعدها فسقط الفحص.
     *
     * Next يجلب الروابط الظاهرة مسبقًا عند التحميل. فاعتراضٌ يُركَّب بعده
     * يجد الحمولةَ مخزونةً، فتمضي الضغطةُ من الذاكرة بلا طلبٍ يُعلَّق —
     * ويمرّ الفحص على انتقالٍ ناجح لا على إنقاذٍ وقع. وقد قِيس ذلك بطفرةٍ
     * عطّلت الحارس فمرّ الفحص كما هو.
     *
     * وتُعلَّق طلباتُ التنقّل وحدها (`_rsc`): تعليقُ كلّ شيء يمنع التحميلَ
     * الكامل الذي نقيسه أصلًا.
     */
    await page.route(/_rsc=/, () => {
      /* لا استجابة ولا إجهاض — تُترك معلّقة كما تُترك وصلةٌ ميتة */
    })

    await page.goto('/market')
    await page.waitForSelector('html[data-route-progress="ready"]')

    const destination = await page.evaluate(() => {
      const link = [...document.querySelectorAll('a[href^="/"]')].find(
        (a) => new URL((a as HTMLAnchorElement).href).pathname !== location.pathname,
      ) as HTMLAnchorElement
      link.click()
      return new URL(link.href).pathname
    })

    /*
     * والحارسُ يعمل بعد ثمانٍ، فيُنتظر ما يسعها ويسع تحميلًا كاملًا بعدها.
     * ولولاه لبقي المسار على حاله إلى أن تنقضي مهلةُ الفحص.
     */
    await page.waitForURL(`**${destination}`, { timeout: 25_000 })
    expect(new URL(page.url()).pathname).toBe(destination)
  })
})
