import { expect, test } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { loginUser, USERS } from './support/session'

/**
 * لقطاتُ المتجرين — **من التطبيق الحقيقيّ** لا رسومًا تُصمَّم.
 *
 *   STORE_SHOTS=1 pnpm exec playwright test store-screenshots
 *
 * ولا تعمل في المجموعة المعتادة: هي تُخرج ملفّاتٍ ولا تحرس شيئًا، وإخفاقُها
 * لا يعني عطبًا في المنصّة. فتُشغَّل بقرارٍ حين يُحضَّر إصدار.
 *
 * ولماذا من التطبيق؟ لأنّ أبل تردّ لقطةً لا تمثّل ما يراه المستخدم، ولأنّ
 * لقطةً مرسومةً تتخلّف عن الواجهة بعد أوّل تغيير — ولا ينتبه أحد.
 */

const ENABLED = process.env.STORE_SHOTS === '1'
const OUT = 'store-assets/screenshots'

/**
 * مقاسان يكفيان المتجرين.
 *
 * أبل تشترط لقطات 6.7 بوصة (1290×2796)، وتشتقّ ما دونها منها. وPlay يقبل
 * أيّ نسبةٍ طولية، و1080×1920 أشيعُ ما تُعرض به.
 *
 * والعرض يُضبط بوحدات CSS ويُضرب في كثافة الجهاز — فتخرج الصورة بمقاسها
 * الفعليّ. وضبطُ 1290 مباشرةً يُخرج صفحةً بعرض حاسوبٍ مصغَّرة، لا صفحة جوّال.
 */
const DEVICES = [
  { name: 'ios-6.7', width: 430, height: 932, scale: 3 },
  { name: 'android', width: 360, height: 640, scale: 3 },
] as const

/** الشاشات التي تحكي القصّة — بالترتيب الذي تُعرض به. */
const SHOTS = [
  { slug: '1-market', path: '/market', auth: false, wait: 'a[href^="/market/"]' },
  { slug: '3-wallet', path: '/account/wallet', auth: true, wait: '#main' },
  { slug: '4-bids', path: '/account/bids', auth: true, wait: '#main' },
  { slug: '5-how', path: '/how-it-works', auth: false, wait: '#main' },
] as const

test.describe('لقطات المتجرين', () => {
  test.skip(!ENABLED, 'تُشغَّل بـSTORE_SHOTS=1 حين يُحضَّر إصدار')

  for (const device of DEVICES) {
    test(`${device.name}`, async ({ browser }) => {
      test.setTimeout(180_000)
      mkdirSync(`${OUT}/${device.name}`, { recursive: true })

      const context = await browser.newContext({
        viewport: { width: device.width, height: device.height },
        deviceScaleFactor: device.scale,
        locale: 'ar-SA',
        isMobile: true,
        hasTouch: true,
      })
      const page = await context.newPage()
      /*
       * مزايدٌ لا بائع.
       *
       * حساب البائع يُظهر «هذا إعلانك» و«إدارة لوحاتي» في صفحة المزاد —
       * وهي شاشةُ إدارةٍ لا شاشةُ مزايدة. والمزايد يرى نموذج المزايدة
       * والعربون، وهو ما جاء الناظر ليراه.
       */
      await loginUser(page, USERS.majed)

      for (const shot of SHOTS) {
        await page.goto(shot.path)
        await expect(page.locator(shot.wait).first()).toBeVisible()
        /* الحركات تُطفأ: لقطةٌ تلتقط منتصف انتقالٍ تُظهر عنصرًا نصفَ شفّاف */
        await page.emulateMedia({ reducedMotion: 'reduce' })
        await page.waitForTimeout(600)
        await page.screenshot({ path: `${OUT}/${device.name}/${shot.slug}.png` })
      }

      /* صفحة مزادٍ حيّ — تُختار من السوق لا تُخمَّن بمعرّف */
      await page.goto('/market')
      const first = page.locator('a[href^="/market/"]').first()
      await expect(first).toBeVisible()
      await first.click()
      await expect(page.locator('#main').first()).toBeVisible()
      await page.waitForTimeout(800)
      await page.screenshot({ path: `${OUT}/${device.name}/2-listing.png` })

      await context.close()
    })
  }
})
