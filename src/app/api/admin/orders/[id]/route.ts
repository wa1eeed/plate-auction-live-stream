import { adminOrderStatusSchema } from '@/lib/domain/schemas'
import { handleError, ok, readJson } from '@/lib/server/api'
import { requireAdminId } from '@/lib/server/require-admin'
import { setOrderStatusByAdmin } from '@/lib/server/admin-service'

export const dynamic = 'force-dynamic'

/** تحديث حالة صفقة إداريًا — الإتمام يخصم العربون المحجوز من قيمتها. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const adminId = await requireAdminId()
    const { id } = await context.params
    const { status } = adminOrderStatusSchema.parse(await readJson(request))
    return ok({ order: await setOrderStatusByAdmin({ orderId: id, status, adminId }) })
  } catch (error) {
    return handleError(error)
  }
}
