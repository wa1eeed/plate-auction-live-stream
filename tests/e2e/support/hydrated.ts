import { test as base, expect } from '@playwright/test'

/**
 * **يُنتظر الحقنُ قبل أيّ تفاعل — وإلّا قِيست صفحةٌ لم تحيَ بعد.**
 *
 * الصفحاتُ كلُّها `force-dynamic`، وخادمٌ واحدٌ يخدم مئتي سياقٍ بالتتابع.
 * فيصل الترميزُ مرسومًا ويتأخّر حقنُ React بقدر حِمل الخادم — وPlaywright
 * يرى عنصرًا ظاهرًا فيضغطه، فتضيع الضغطةُ في الفراغ، أو يقرأ عقدةً يستبدلها
 * الحقنُ بعد لحظة فيعود `getComputedStyle` بنصٍّ فارغ.
 *
 * وهذا بعينه ما كان يُسقط سقطةً أو سقطتين **تتبدّلان** في كلّ تشغيلةٍ من
 * البوّابة بينما تمرّ المجموعةُ محلّيًّا مطّردة — والآليّة مقيسةٌ موثّقةٌ في
 * `TASKS.md §١٠`، وهذا علاجُها المرشَّح فيها.
 *
 * والعلامةُ جاهزة: `route-progress.tsx` يضع
 * `document.documentElement.dataset.routeProgress = 'ready'` في `useEffect`،
 * أي **بعد** الحقن. فيُنتظر هنا في موضعٍ واحد يغطّي الملفّات كلَّها.
 *
 * ولا يُفشل الانتظارُ اختبارًا: صفحاتٌ لا تحمل الغلاف (خطأٌ خام، أو ملفٌّ
 * يُنزَّل) لا علامةَ فيها — فيمضي بعد مهلته، ويبقى الاختبارُ هو الحكم.
 */
async function settle(page: import('@playwright/test').Page) {
  await page
    .waitForFunction(() => document.documentElement.dataset.routeProgress === 'ready', null, {
      timeout: 15_000,
    })
    .catch(() => {})
}

export const test = base.extend({
  page: async ({ page }, use) => {
    const goto = page.goto.bind(page)
    page.goto = async (url, options) => {
      const response = await goto(url, options)
      await settle(page)
      return response
    }

    const reload = page.reload.bind(page)
    page.reload = async (options) => {
      const response = await reload(options)
      await settle(page)
      return response
    }

    await use(page)
  },
})

export { expect }
