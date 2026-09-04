import { fail, handleError, ok, readJson } from '@/lib/server/api'
import { adminLoginSchema } from '@/lib/domain/schemas'
import { verifyPassword } from '@/lib/server/crypto'
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
