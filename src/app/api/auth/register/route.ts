import { registerSchema } from '@/lib/domain/schemas'
import { fail, handleError, ok, readJson } from '@/lib/server/api'
import { hashPassword } from '@/lib/server/crypto'
import { clientIp } from '@/lib/server/client-ip'
import { rateLimit } from '@/lib/server/rate-limit'
import { setUserSession } from '@/lib/server/session'
import { getStore } from '@/lib/store'

export async function POST(request: Request) {
  try {
    const body = registerSchema.parse(await readJson(request))
    /* عشرة حساباتٍ في الساعة من عنوانٍ واحد — والتسجيل فعلٌ نادر */
    if (!rateLimit(`register-ip:${clientIp(request.headers)}`, 10, 3_600_000).allowed) {
      return fail('محاولات كثيرة، حاول بعد قليل', 429, 'RATE_LIMITED')
    }
    if (!rateLimit(`register:${body.email}`, 5, 60_000).allowed) {
      return fail('محاولات كثيرة، حاول بعد دقيقة', 429, 'RATE_LIMITED')
    }

    const store = getStore()
    if (await store.findUserByEmail(body.email)) {
      return fail('البريد الإلكتروني مستخدم مسبقًا', 409, 'EMAIL_TAKEN')
    }

    const user = await store.createUser({
      email: body.email,
      passwordHash: hashPassword(body.password),
      displayName: body.displayName,
      handle: body.handle,
      phone: body.phone ? body.phone : null,
      social: {
        tiktok: body.social?.tiktok ?? null,
        snapchat: body.social?.snapchat ?? null,
        instagram: body.social?.instagram ?? null,
      },
    })
    await setUserSession({ userId: user.id, email: user.email })
    return ok({ user: { id: user.id, displayName: user.displayName } })
  } catch (error) {
    return handleError(error)
  }
}
