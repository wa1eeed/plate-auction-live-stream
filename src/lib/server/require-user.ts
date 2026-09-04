import { ServiceError } from './market-service'
import { readUserSession } from './session'
import { getStore } from '@/lib/store'
import type { User } from '@/lib/domain/types'

/**
 * يعيد معرّف المستخدم الحالي أو يرمي 401.
 *
 * يتحقّق من وجود الحساب لا من صحّة توقيع الجلسة وحدها: الكوكي يبقى صالح
 * التوقيع بعد حذف الحساب، فيمرّ الطلب بمعرّف لا يقابله مستخدم وتفشل العملية
 * لاحقًا برسالة مربكة بدل «سجّل الدخول».
 */
export async function requireUserId(): Promise<string> {
  const session = await readUserSession()
  if (!session) throw new ServiceError('يجب تسجيل الدخول أولًا', 401, 'NOT_AUTHENTICATED')

  const user = await getStore().findUser(session.userId)
  if (!user) throw new ServiceError('انتهت الجلسة، سجّل الدخول من جديد', 401, 'NOT_AUTHENTICATED')
  return user.id
}

/** يعيد المستخدم الحالي أو `null` — للصفحات العامة. */
export async function getCurrentUser(): Promise<User | null> {
  const session = await readUserSession()
  if (!session) return null
  return getStore().findUser(session.userId)
}
