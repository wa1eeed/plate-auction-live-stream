import { expect, type Locator } from '@playwright/test'

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
 * ينقر زرًّا قد يُستبدَل في أثناء الترطيب — **ويُعيد حتى يقع أثرُه**.
 *
 * الزرّ يُكتب في تصيير الخادم، فيراه Playwright ظاهرًا مستقرًّا وينقره — وقد
 * استبدله React في تلك اللحظة، فيُفصَل العنصر من الشجرة والنقرة في الطريق.
 *
 * وانتظارُ استقرار ما حوله لا يكفي: الفصل يقع **بعد** الاستقرار بلحظة، وهي
 * تتّسع على لينكس تحت حمل المجموعة. فالحارس الوحيد الصادق أن يُقاس **الأثر**
 * لا النقرة: يُعاد النقر حتى يتحقّق ما يُنتظر منه، أو تنقضي المهلة فيُخفق.
 *
 * ونقرةٌ زائدة لا تضرّ هنا: الشرط يُفحص قبل كلّ محاولة، فما إن يتحقّق يتوقّف.
 */
export async function clickUntil(
  button: Locator,
  done: () => Promise<boolean>,
  timeout = 30_000,
): Promise<void> {
  await expect
    .poll(
      async () => {
        if (await done()) return true
        await button.click({ timeout: 5_000 }).catch(() => undefined)
        return done()
      },
      { timeout, message: 'لم يقع أثر النقرة قبل انقضاء المهلة' },
    )
    .toBe(true)
}
