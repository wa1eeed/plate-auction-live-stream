import { createHash, createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 20)}`
}

export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString('base64url')
}

function secret(): string {
  const value = process.env.SESSION_SECRET
  if (!value || value.length < 16) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET غير مضبوط — أضفه في متغيرات البيئة قبل التشغيل في الإنتاج.')
    }
    return 'development-only-insecure-secret'
  }
  return value
}

/** تجزئة رقم الجوال — لا يُخزَّن الرقم صريحًا في أي مكان. */
export function hashPhone(phone: string): string {
  return createHmac('sha256', secret()).update(`phone:${phone}`).digest('hex')
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const derived = scryptSync(password, salt, 64).toString('hex')
  return `scrypt:${salt}:${derived}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, digest] = stored.split(':')
  if (scheme !== 'scrypt' || !salt || !digest) return false
  const derived = scryptSync(password, salt, 64)
  const expected = Buffer.from(digest, 'hex')
  if (expected.length !== derived.length) return false
  return timingSafeEqual(derived, expected)
}

export type SignedPayload = Record<string, string | number | boolean>

/** توقيع حمولة جلسة بصيغة `base64url(payload).hmac`. */
export function signSession(payload: SignedPayload, ttlSeconds: number): string {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds }
  const encoded = Buffer.from(JSON.stringify(body), 'utf8').toString('base64url')
  const signature = createHmac('sha256', secret()).update(encoded).digest('base64url')
  return `${encoded}.${signature}`
}

export function verifySession<T extends SignedPayload>(token: string | undefined): (T & { exp: number }) | null {
  if (!token) return null
  const [encoded, signature] = token.split('.')
  if (!encoded || !signature) return null
  const expected = createHmac('sha256', secret()).update(encoded).digest('base64url')
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as T & { exp: number }
    if (typeof parsed.exp !== 'number' || parsed.exp * 1000 < Date.now()) return null
    return parsed
  } catch {
    return null
  }
}

/** بصمة قصيرة تُستخدم لمنع تكرار نفس طلب المزايدة. */
export function fingerprint(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 32)
}
