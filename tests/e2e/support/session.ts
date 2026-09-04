import type { Cookie, Page } from '@playwright/test'

export const ADMIN = { email: 'admin@demo.sa', password: 'admin1234' }
export const USERS = {
  waleed: { email: 'waleed@demo.sa', password: 'demo1234', name: 'وليد العتيبي' },
  sara: { email: 'sara@demo.sa', password: 'demo1234', name: 'سارة القحطاني' },
  majed: { email: 'majed@demo.sa', password: 'demo1234', name: 'ماجد الشهري' },
} as const

/**
 * جلسات مشتركة على مستوى **التشغيل كلّه** لا على مستوى الملف.
 *
 * حدّ معدّل الدخول (الإدارة 5 محاولات/دقيقة) يعمل بحقّ. وكل ملفّ اختبار يخزّن
 * كوكيه وحده يعني دخولًا حقيقيًا لكل ملفّ — وخمسة ملفّات تستنفد الحدّ فتفشل
 * المتأخّرة بـ429، والعيب في الاختبار لا في الحدّ. المخزَن هنا وحدة واحدة
 * يتشاركها الجميع (`workers: 1`)، فيقع دخول واحد للتشغيل كلّه.
 */
const cache = new Map<string, Cookie[]>()

async function reuse(page: Page, key: string, probe: string, loginPath: string, cookie: string) {
  const saved = cache.get(key)
  if (saved) {
    await page.context().addCookies(saved)
    await page.goto(probe)
    if (!page.url().includes(loginPath)) return true
    cache.delete(key)
  }
  /*
   * تنظيف الكوكي قبل دخول حقيقي.
   *
   * التبديل بين مستخدمين في السياق نفسه يترك كوكي السابق، فتُعيد صفحة الدخول
   * توجيهنا إلى الحساب ولا يظهر حقل البريد أبدًا — فيعلق الاختبار حتى المهلة.
   * والتنظيف بالاسم لا بالكامل: جلسة الإدارة وجلسة المستخدم تتعايشان عمدًا.
   */
  await page.context().clearCookies({ name: cookie })
  return false
}

export async function loginAdmin(page: Page): Promise<void> {
  if (await reuse(page, 'admin', '/admin', '/admin/login', 'pa_admin')) return

  await page.goto('/admin/login')
  await page.getByLabel('البريد الإلكتروني').fill(ADMIN.email)
  await page.getByLabel('كلمة المرور').fill(ADMIN.password)
  await page.getByRole('button', { name: 'دخول الإدارة' }).click()
  await page.waitForURL('**/admin')
  cache.set(
    'admin',
    (await page.context().cookies()).filter((c) => c.name === 'pa_admin'),
  )
}

export async function loginUser(
  page: Page,
  who: { email: string; password: string } = USERS.waleed,
): Promise<void> {
  if (await reuse(page, who.email, '/account', '/login', 'pa_session')) return

  await page.goto('/login')
  await page.getByLabel('البريد الإلكتروني').fill(who.email)
  await page.getByLabel('كلمة المرور').fill(who.password)
  await page.getByRole('button', { name: 'دخول', exact: true }).click()
  await page.waitForURL('**/account')
  cache.set(
    who.email,
    (await page.context().cookies()).filter((c) => c.name === 'pa_session'),
  )
}

/** يُبطل الجلسة المحفوظة بعد خروج متعمّد داخل اختبار. */
export function forgetAdminSession(): void {
  cache.delete('admin')
}
