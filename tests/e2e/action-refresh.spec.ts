import { expect, test } from './support/hydrated'
import { type Page } from '@playwright/test'
import { loginUser, USERS } from './support/session'

/**
 * **الأمرُ يبقى مشغولًا حتى يصل الجديد — فلا تتبدّل الصفحةُ وحدها.**
 *
 * و`router.refresh()` لا يُنتظر: يُنادى فيعود فورًا والجلبُ يمضي في الخلف.
 * فكان التسلسل:
 *
 *   ضغطة ← دوّارة ← ردُّ الخادم ← إنعاش ← **تتوقّف الدوّارة** ← …لحظة… ←
 *   تتبدّل الصفحةُ وحدها
 *
 * فيُقرأ التبدّلُ تحديثًا تلقائيًّا لا أثرًا لضغطةٍ وقعت. وهو ما شكاه صاحبُ
 * المنصّة في «إدارة لوحاتي» وغيرها.
 *
 * **والمقيسُ الترتيب**: أن يبقى الزرُّ معطَّلًا إلى أن يصل المحتوى الجديد.
 * فإن عاد صالحًا للضغط والصفحةُ على قديمها، فثمّ تبدّلٌ قادمٌ بلا سببٍ ظاهر.
 */
/*
 * **وتُؤخذ آخرُ لوحةٍ وتُعاد إلى حالها في النهاية.**
 *
 * فهذا الفحصُ يُلغي عرضًا ثمّ يُعيده — وإعادةُ العرض تُرجع اللوحة **مسودّة**
 * فتخرج من السوق. والبذرةُ مشتركةٌ بين الملفّات، والخادمُ يُعاد استعمالُه
 * (`reuseExistingServer`) — فلوحةٌ تُسحب هنا تُفقدها فحوصُ السوق بعدها.
 * جُرّب فسقطت أربعةُ فحوصٍ في ملفّين.
 *
 * فالأخيرةُ تُؤخذ (كما يفعل `findListing` في `marketplace.spec`)، وتُنشر
 * ثانيةً قبل الخروج.
 */
async function lastCancellable(page: Page) {
  await page.goto('/account/listings')
  const cancel = page.getByRole('button', { name: 'إلغاء العرض' }).last()
  await expect(cancel).toBeVisible({ timeout: 15_000 })
  return cancel
}

test.describe('الأمرُ لا يتبعه تحديثٌ تلقائيّ', () => {
  test('زرُّ إعادة العرض يبقى معطَّلًا حتى تتبدّل البطاقة', async ({ page }) => {
    await loginUser(page, USERS.waleed)

    /* يُلغى عرضٌ أوّلًا ليوجد ما يُعاد عرضُه */
    await (await lastCancellable(page)).click()
    const confirmCancel = page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'إلغاء العرض' })
    await expect(confirmCancel).toBeVisible({ timeout: 15_000 })
    await confirmCancel.click()

    const relist = page.getByRole('button', { name: 'إعادة عرض' }).first()
    await expect(relist).toBeVisible({ timeout: 20_000 })

    /*
     * **ويُبطَّأ ردُّ الإنعاش عمدًا.**
     *
     * فعلى الحلقة المحلّية يصل في أجزاءٍ من الثانية، فلا تُرى الفجوةُ بين
     * «عاد الزرُّ صالحًا» و«تبدّلت الصفحة» — ويمرّ الفحصُ وإن عادت. والإبطاءُ
     * يجعل ما يراه صاحبُ جهازٍ على شبكةٍ بطيئة مقيسًا.
     */
    await page.route('**/account/listings?_rsc=*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2_000))
      await route.continue()
    })

    await relist.click()
    const confirmRelist = page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'إعادة العرض' })
    await expect(confirmRelist).toBeVisible({ timeout: 15_000 })
    await confirmRelist.click()

    /*
     * ويُلتقط الحالُ بعد أن يردّ الخادمُ على الأمر وقبل أن يصل الإنعاش:
     * ثانيةٌ تقع في منتصف الثانيتين المُبطَّأتين.
     */
    await page.waitForTimeout(1_000)
    const stillBusy = await page
      .getByRole('button', { name: 'إعادة عرض' })
      .first()
      .isDisabled()
      .catch(() => true)
    expect(stillBusy, 'عاد الزرُّ صالحًا والصفحةُ على قديمها — فتتبدّل وحدها بعد لحظة').toBe(true)

    /* ثمّ تصل البطاقةُ الجديدة: لم تعد اللوحةُ مُغلقةً فلا زرَّ إعادةِ عرض */
    await expect(page.getByRole('button', { name: 'إعادة عرض' })).toHaveCount(0, {
      timeout: 20_000,
    })

    /* وتُعاد اللوحةُ إلى السوق — فلا يجدها من بعدنا مسودّةً مسحوبة */
    await page.unroute('**/account/listings?_rsc=*')
    const publish = page.getByRole('button', { name: 'انشر في السوق' }).last()
    await expect(publish).toBeVisible({ timeout: 20_000 })
    await publish.click()
    await expect(page.getByRole('button', { name: 'انشر في السوق' })).toHaveCount(0, {
      timeout: 20_000,
    })
  })
})
