import { buyNowSchema } from '@/lib/domain/schemas'
import { handleError, ok, readJson } from '@/lib/server/api'
import { buyNow } from '@/lib/server/market-service'
import { requireUserId } from '@/lib/server/require-user'

export const dynamic = 'force-dynamic'

/** شراء مباشر — ذرّي فلا تُباع اللوحة لمشتريين متزامنين. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const userId = await requireUserId()
    const body = buyNowSchema.parse(await readJson(request))
    const result = await buyNow({ listingId: id, buyerId: userId, clientRequestId: body.clientRequestId })
    return ok({ orderId: result.order.id, amount: result.order.amount })
  } catch (error) {
    return handleError(error)
  }
}
