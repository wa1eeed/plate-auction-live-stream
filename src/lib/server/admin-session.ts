import { cookies } from 'next/headers'
import { signSession, verifySession } from './crypto'

/**
 * جلسة الإدارة بكوكي مستقلّ تمامًا عن كوكي المستخدم.
 *
 * هذا هو بيت القصيد: `pa_admin` و`pa_session` كوكيان منفصلان، فيمكن أن تكون
 * مسجّلًا في لوحة الإدارة وفي حساب مستخدم عادي في المتصفّح نفسه في آنٍ واحد،
 * وتتنقّل بينهما أثناء التجربة بلا خروج من أحدهما.
 *
 * ومدّتها أقصر من جلسة المستخدم (8 ساعات مقابل 14 يومًا) لأن صلاحياتها أوسع.
 */
const ADMIN_COOKIE = 'pa_admin'
const ADMIN_TTL = 60 * 60 * 8

export type AdminSession = { adminId: string; email: string }

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  // محصور بمسار الإدارة وواجهتها البرمجية فلا يُرسل مع تصفّح السوق العادي
  path: '/',
}

export async function setAdminSession(session: AdminSession): Promise<void> {
  const store = await cookies()
  store.set(ADMIN_COOKIE, signSession({ ...session }, ADMIN_TTL), {
    ...cookieOptions,
    maxAge: ADMIN_TTL,
  })
}

export async function clearAdminSession(): Promise<void> {
  const store = await cookies()
  store.delete(ADMIN_COOKIE)
}

export async function readAdminSession(): Promise<AdminSession | null> {
  const store = await cookies()
  const parsed = verifySession<{ adminId: string; email: string }>(store.get(ADMIN_COOKIE)?.value)
  if (!parsed) return null
  return { adminId: parsed.adminId, email: parsed.email }
}
