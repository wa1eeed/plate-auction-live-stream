import { ServiceError } from './market-service'
import { DISABLED_ACCOUNT_MESSAGE } from './account-service'
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
  /*
   * **الحسابُ المعطَّل يسقط بجلسته القائمة** — لا عند الدخول وحده.
   *
   * فمن عطّل حسابه وكوكيُّه في يده يبقى داخلًا إلى أن ينتهي أجلُه — فيزايد
   * ويشتري ويبيع وهو «قيد الحذف». والفحصُ هنا يقطع ذلك في أوّل طلب.
   */
  if (user.disabledAt) throw new ServiceError(DISABLED_ACCOUNT_MESSAGE, 403, 'ACCOUNT_DISABLED')
  return user.id
}

/**
 * يعيد المستخدم الحالي أو `null` — للصفحات العامة.
 *
 * والمعطَّل يُقرأ `null`: الصفحاتُ العامّة تبني عليه واجهةَ «مسجَّل الدخول»،
 * فلو عاد لظهرت له قوائمُ حسابٍ لا يستطيع فتح شيءٍ منها.
 */
export async function getCurrentUser(): Promise<User | null> {
  const session = await readUserSession()
  if (!session) return null
  const user = await getStore().findUser(session.userId)
  return user?.disabledAt ? null : user
}
