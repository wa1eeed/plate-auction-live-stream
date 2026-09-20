import type { Locator } from '@playwright/test'

/**
 * عدد العناصر **بعد استقراره** لا عند أوّل ظهور.
 *
 * الصفحة تُصيَّر على الخادم ثمّ تُرطَّب، والشبكة تتبدّل بين الحالين: الخادم
 * يكتب ما عنده، ويتولّى العميل بعد ترطيبه فيقصّها إلى دفعةٍ أولى. فقياسٌ يقع
 * في تلك الفجوة يقرأ عددًا لا يبقى — ويُقارَن بعد ذلك بعددٍ آخر فيُخفق الفحص
 * بلا عطبٍ في المنصّة.
 *
 * و`waitFor()` على أوّل عنصر لا يكفي: أوّل عنصرٍ يظهر في تصيير الخادم، وما
 * يليه هو الذي يتبدّل.
 *
 * ولذلك يُنتظر **ثباتُ العدد** لا حدثٌ بعينه: لا يُصدِّر React علامةً عامّة
 * تقول «رُطِّبت هذه الشجرة»، وثباتُ ما يُقاس هو الشرط المقصود أصلًا.
 */
export async function stableCount(locator: Locator, settleMs = 250): Promise<number> {
  const page = locator.page()
  let previous = -1

  // سقفٌ يمنع الدوران إلى ما لا نهاية — ومهلة الفحص نفسها تحرس ما بعده
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const current = await locator.count()
    if (current > 0 && current === previous) return current
    previous = current
    await page.waitForTimeout(settleMs)
  }
  return previous
}

/**
 * ينقر زرًّا قد يُستبدَل في أثناء الترطيب.
 *
 * الزرّ يُكتب في تصيير الخادم، فيراه Playwright ظاهرًا مستقرًّا وينقره — وقد
 * استبدله React في تلك اللحظة، فيُفصَل العنصر من الشجرة والنقرة في الطريق.
 * والانتظارُ حتى يستقرّ ما حوله يجعل النقرة تقع على الزرّ الحيّ.
 */
export async function clickWhenHydrated(button: Locator, near: Locator): Promise<void> {
  await stableCount(near)
  await button.click()
}
