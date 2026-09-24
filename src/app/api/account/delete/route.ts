import { handleError, ok } from '@/lib/server/api'
import { requireUserId } from '@/lib/server/require-user'
import { accountDeletionBlockers, requestAccountDeletion } from '@/lib/server/account-service'
import { clearUserSession } from '@/lib/server/session'

export const dynamic = 'force-dynamic'

/** ما يمنع الحذف — تقرؤه الصفحة قبل أن تعرض الزرّ. */
export async function GET() {
  try {
    return ok({ blockers: await accountDeletionBlockers(await requireUserId()) })
  } catch (error) {
    return handleError(error)
  }
}

/**
 * حذفُ الحساب بطلب صاحبه — **تعطيلٌ لا محو**.
 *
 * والجلسةُ تُمحى في الحال: لولا ذلك لبقي صاحبُها يتصفّح بحسابٍ معطَّل حتى
 * أوّل طلبٍ محروس، فيرى واجهةَ حسابٍ يُردّ عن كلّ ما فيها.
 */
export async function POST() {
  try {
    const userId = await requireUserId()
    await requestAccountDeletion(userId)
    await clearUserSession()
    return ok({ disabled: true })
  } catch (error) {
    return handleError(error)
  }
}
