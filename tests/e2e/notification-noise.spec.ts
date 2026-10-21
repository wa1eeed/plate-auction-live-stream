import { expect, test } from './support/hydrated'
import { type Page } from '@playwright/test'

/**
 * **إشعارٌ واحد: نبرةٌ واحدة، ولا إنعاشَ لكلّ صفحةٍ تُفتح.**
 *
 * وجرسُ الإشعارات كان يحمل عدّادين في الذاكرة — `previousUnread` للنبرة
 * و`refreshedAt` للإنعاش — وكلاهما `useRef(0)` يبدأ صفرًا **مع كلّ تركيب**.
 * فأوّلُ مزامنةٍ بعد أيّ تحميلٍ ترى العددَ أكبرَ من صفر، فتُنبّه وتُنعش.
 *
 * وثمنُه ما شكاه صاحبُ المنصّة: نبرةٌ تتكرّر في كلّ صفحةٍ يدخلها وكلّ مرّةٍ
 * يُحدّث فيها، وصفحةٌ تُعاد من الخادم في كلّ تنقّلٍ وكلّ تبديلِ تاب — وهو
 * في التطبيق أظهر، فالملاحةُ فيه أكثر.
 *
 * **والمقيسُ طلبُ الخادم لا الصوت.** فالنبرةُ لا تُلتقط في متصفّحٍ بلا
 * تفاعل، والإنعاشُ أثرُه طلبُ `_rsc` للمسار نفسِه — يُعدّ عدًّا. وهما من
 * سببٍ واحد، فسقوطُ أحدهما يُسقط الآخر.
 */
const USERS = {
  waleed: { email: 'waleed@demo.sa', password: 'demo1234', name: 'وليد العتيبي' },
  sara: { email: 'sara@demo.sa', password: 'demo1234', name: 'سارة القحطاني' },
  majed: { email: 'majed@demo.sa', password: 'demo1234', name: 'ماجد الشهري' },
}

async function login(page: Page, user: { email: string; password: string }) {
  await page.goto('/login')
  await page.getByLabel('البريد الإلكتروني').fill(user.email)
  await page.getByLabel('كلمة المرور').fill(user.password)
  await page.getByRole('button', { name: 'دخول', exact: true }).click()
  await page.waitForURL('**/account')
}

/** يُنشئ إشعارًا حقيقيًّا للبائع: عرضٌ وارد. ويُعيد حسابَ من وصله. */
async function makeUnread(buyer: Page) {
  const { listings } = (await (await buyer.request.get('/api/listings')).json()) as {
    listings: { id: string; saleType: string; status: string; sellerName: string }[]
  }
  const listing = listings.find(
    (l) => l.saleType === 'offers' && l.status === 'active' && l.sellerName !== USERS.majed.name,
  )
  expect(listing, 'لا إعلانَ عروضٍ متاح').toBeTruthy()

  const detail = await (await buyer.request.get(`/api/listings/${listing!.id}`)).json()
  await buyer.goto(`/market/${listing!.id}`)

  /* عرضٌ قائمٌ من تشغيلٍ سابق يحجب الحقل — يُسحب أوّلًا */
  const withdraw = buyer.getByRole('button', { name: 'اسحب العرض' })
  if ((await withdraw.count()) > 0) {
    await withdraw.first().click()
    await expect(buyer.getByLabel('مبلغ العرض')).toBeVisible({ timeout: 15_000 })
  }

  await buyer.getByLabel('مبلغ العرض').fill(String(Math.round(detail.minimumOffer / 100) + 1_500))
  await buyer.getByRole('button', { name: 'أرسل العرض' }).click()
  await expect(buyer.getByText('عرضك الحالي')).toBeVisible({ timeout: 15_000 })

  return Object.values(USERS).find((u) => u.name === detail.seller.displayName)!
}

test.describe('ضجيجُ الإشعارات', () => {
  test('إشعارٌ غيرُ مقروءٍ لا يُنعش كلَّ صفحةٍ تُفتح', async ({ browser }) => {
    const buyerContext = await browser.newContext()
    const buyer = await buyerContext.newPage()
    await login(buyer, USERS.majed)
    const sellerUser = await makeUnread(buyer)

    const sellerContext = await browser.newContext()
    const seller = await sellerContext.newPage()
    await login(seller, sellerUser)

    /* يُثبَت أنّ عنده غيرَ مقروء — وإلّا فالفحصُ أجوف */
    const unread = await seller.evaluate(async () => {
      const r = await fetch('/api/notifications', { cache: 'no-store' })
      return ((await r.json()) as { unread: number }).unread
    })
    expect(unread, 'لا إشعارَ غيرَ مقروءٍ يُقاس عليه').toBeGreaterThan(0)

    /*
     * **ويُعدّ الإنعاشُ وحده، لا كلُّ طلبِ `_rsc`.**
     *
     * فـNext يجلب حمولةَ كلّ رابطٍ يدخل الشاشة استباقًا — عشرةُ طلباتٍ في
     * ثلاث ثوانٍ على صفحةٍ فيها روابط، وكلُّها `_rsc`. وتُميَّز بترويسة
     * `Next-Router-Prefetch`، والإنعاشُ لا يحملها. فبها يُفرَز.
     *
     * **والمراقبةُ تبدأ قبل الفتح لا بعده.** فالإنعاشُ يقع في أعقاب أوّلِ
     * مزامنة — أي في اللحظة نفسِها التي تظهر فيها الصفحة. وأُرصد بعدها
     * مرّةً فمرّ العطبُ المُعاد ولم يُمسك: كان قد وقع قبل أن يبدأ العدّ.
     */
    const watchDuring = async (page: Page, act: () => Promise<void>, settleMs = 3_000) => {
      const hits: string[] = []
      const onRequest = (request: import('@playwright/test').Request) => {
        const url = new URL(request.url())
        if (!url.searchParams.has('_rsc')) return
        if (request.headers()['next-router-prefetch'] === '1') return
        hits.push(url.pathname)
      }
      page.on('request', onRequest)
      await act()
      await page.waitForTimeout(settleMs)
      page.off('request', onRequest)
      return hits
    }

    const onOpen = await watchDuring(seller, async () => {
      await seller.goto('/account/offers')
      await expect(seller.getByRole('heading', { name: /العروض/ }).first()).toBeVisible({
        timeout: 15_000,
      })
    })
    expect(onOpen, 'الصفحةُ تُنعَش من الخادم لمجرّد أنّها فُتحت').toEqual([])

    /* وتنقّلٌ إلى صفحةٍ أخرى: لا إنعاشَ يلحق الملاحة */
    const onNav = await watchDuring(seller, async () => {
      await seller.goto('/account/wallet')
      await expect(seller.getByRole('heading', { name: /المحفظة|محفظتي/ }).first()).toBeVisible({
        timeout: 15_000,
      })
    })
    expect(onNav, 'الصفحةُ تُنعَش بعد كلّ تنقّل').toEqual([])

    await buyerContext.close()
    await sellerContext.close()
  })
})
