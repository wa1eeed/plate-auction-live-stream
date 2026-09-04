import { loginSchema } from '@/lib/domain/schemas'
import { fail, handleError, ok, readJson } from '@/lib/server/api'
import { verifyPassword } from '@/lib/server/crypto'
import { rateLimit } from '@/lib/server/rate-limit'
import { setUserSession } from '@/lib/server/session'
import { getStore } from '@/lib/store'

export async function POST(request: Request) {
  try {
    const body = loginSchema.parse(await readJson(request))
    if (!rateLimit(`login:${body.email}`, 8, 60_000).allowed) {
      return fail('محاولات كثيرة، حاول بعد دقيقة', 429, 'RATE_LIMITED')
    }

    const account = await getStore().findUserByEmail(body.email)
    if (!account || !verifyPassword(body.password, account.passwordHash)) {
      return fail('البريد الإلكتروني أو كلمة المرور غير صحيحة', 401, 'INVALID_CREDENTIALS')
    }
    await setUserSession({ userId: account.id, email: account.email })
    return ok({ user: { id: account.id, displayName: account.displayName } })
  } catch (error) {
    return handleError(error)
  }
}
