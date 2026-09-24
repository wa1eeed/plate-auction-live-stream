import { handleError, ok } from '@/lib/server/api'
import { requireAdminId } from '@/lib/server/require-admin'
import { reactivateUser } from '@/lib/server/account-service'

export const dynamic = 'force-dynamic'

/**
 * إعادةُ تفعيل حسابٍ معطَّل — **والإدارةُ وحدها تفعلها**.
 *
 * ومن عطّل حسابه بطلبه قد يعود فيطلب، ومن عُطّل لمخالفةٍ لا يُعاد إلّا
 * بقرار. فالمسارُ واحد والقرارُ للإدارة في الحالين، ويُقيَّد في سجلّ التدقيق.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const adminId = await requireAdminId()
    const { id } = await context.params
    return ok({ user: await reactivateUser(id, adminId) })
  } catch (error) {
    return handleError(error)
  }
}
