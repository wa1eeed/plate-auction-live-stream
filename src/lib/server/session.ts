import { cookies } from 'next/headers'
import { signSession, verifySession } from './crypto'

const SESSION_COOKIE = 'pa_session'
const SESSION_TTL = 60 * 60 * 24 * 14

export type UserSession = { userId: string; email: string }

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
}

export async function setUserSession(session: UserSession): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE, signSession({ ...session }, SESSION_TTL), {
    ...cookieOptions,
    maxAge: SESSION_TTL,
  })
}

export async function clearUserSession(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

export async function readUserSession(): Promise<UserSession | null> {
  const store = await cookies()
  const parsed = verifySession<{ userId: string; email: string }>(store.get(SESSION_COOKIE)?.value)
  if (!parsed) return null
  return { userId: parsed.userId, email: parsed.email }
}
