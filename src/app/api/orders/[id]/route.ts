import { orderStatusSchema } from '@/lib/domain/schemas'
import { handleError, ok, readJson } from '@/lib/server/api'
import { updateOrderStatus } from '@/lib/server/order-service'
import { requireUserId } from '@/lib/server/require-user'

export const dynamic = 'force-dynamic'

/** البائع يلغي صفقته — أمّا الإتمام فيقع بتحويل المبلغ بعد نقل الملكية وتحقّق الإدارة. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const userId = await requireUserId()
    const { status } = orderStatusSchema.parse(await readJson(request))
    return ok({ order: await updateOrderStatus({ orderId: id, userId, status }) })
  } catch (error) {
    return handleError(error)
  }
}
