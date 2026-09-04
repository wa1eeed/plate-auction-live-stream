import { ServiceError } from './market-service'
import { readAdminSession } from './admin-session'
import { getStore } from '@/lib/store'
import type { AdminAccount } from '@/lib/domain/types'

/** يعيد معرّف الأدمن الحالي أو يرمي 401. */
export async function requireAdminId(): Promise<string> {
  const session = await readAdminSession()
  if (!session) throw new ServiceError('يجب تسجيل دخول الإدارة', 401, 'NOT_AUTHENTICATED')

  // الجلسة موقّعة، لكن الحساب قد يكون حُذف بعد إصدارها
  const admin = await getStore().findAdmin(session.adminId)
  if (!admin) throw new ServiceError('حساب الإدارة غير موجود', 403, 'FORBIDDEN')
  return admin.id
}

/** يعيد الأدمن الحالي أو `null` — لصفحات تقرّر التوجيه بنفسها. */
export async function getCurrentAdmin(): Promise<AdminAccount | null> {
  const session = await readAdminSession()
  if (!session) return null
  return getStore().findAdmin(session.adminId)
}
