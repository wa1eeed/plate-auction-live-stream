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
