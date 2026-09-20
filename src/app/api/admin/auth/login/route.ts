import { fail, handleError, ok, readJson } from '@/lib/server/api'
import { adminLoginSchema } from '@/lib/domain/schemas'
import { hashPassword, verifyPassword } from '@/lib/server/crypto'
import { DEMO_ADMIN } from '@/lib/config'
import { rateLimit } from '@/lib/server/rate-limit'
import { setAdminSession } from '@/lib/server/admin-session'
import { getStore } from '@/lib/store'

export const dynamic = 'force-dynamic'

/**
 * دخول الإدارة — كوكي مستقلّ لا يمسّ جلسة المستخدم العادي.
 * حدّ المعدل أضيق من دخول المستخدم لأن الحساب الإداري هدف أثمن.
 */
export async function POST(request: Request) {
  try {
    const body = adminLoginSchema.parse(await readJson(request))
    if (!rateLimit(`admin-login:${body.email}`, 5, 60_000).allowed) {
      return fail('محاولات كثيرة، حاول بعد دقيقة', 429, 'RATE_LIMITED')
    }

    const store = getStore()

    /*
     * حساب الإدارة من البيئة — يُضمَن هنا لا في بذرةٍ لا تجري على قاعدة.
     *
     * مخزن الذاكرة يبذره عند الإقلاع؛ وقاعدةُ بياناتٍ تبدأ فارغة، فلولا هذا
     * لأقلعت المنصّة بلا أدمن ولا بابَ لإنشائه. وهو `upsert` على البريد: من
     * بدّل كلمته في متغيّرات النشر بدّلها هنا، ولا يبقى حسابٌ بكلمةٍ قديمة.
     *
     * ويقع قبل البحث لا بعده، فلا تُرفض أوّل محاولةٍ ثمّ تنجح الثانية.
     */
    if (store.kind === 'postgres' && 'ensureAdmin' in store) {
      await (store as { ensureAdmin: (input: {
        email: string
        passwordHash: string
        displayName: string
      }) => Promise<void> }).ensureAdmin({
        email: DEMO_ADMIN.email,
        passwordHash: hashPassword(DEMO_ADMIN.password),
        displayName: DEMO_ADMIN.displayName,
      })
    }

    const account = await store.findAdminByEmail(body.email)
    // رسالة واحدة للبريد الخاطئ ولكلمة المرور الخاطئة: لا نكشف وجود الحساب
    if (!account || !verifyPassword(body.password, account.passwordHash)) {
      return fail('بيانات الدخول غير صحيحة', 401, 'INVALID_CREDENTIALS')
    }

    await setAdminSession({ adminId: account.id, email: account.email })
    await store.touchAdminLogin(account.id, new Date().toISOString())
    return ok({ admin: { id: account.id, displayName: account.displayName } })
  } catch (error) {
    return handleError(error)
  }
}
