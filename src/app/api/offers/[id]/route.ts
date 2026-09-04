import { offerDecisionSchema } from '@/lib/domain/schemas'
import { handleError, ok, readJson } from '@/lib/server/api'
import { respondToOffer, withdrawOffer } from '@/lib/server/market-service'
import { requireUserId } from '@/lib/server/require-user'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** البائع يقبل العرض أو يرفضه. */
export async function POST(request: Request, context: Ctx) {
  try {
    const { id } = await context.params
    const userId = await requireUserId()
    const { decision } = offerDecisionSchema.parse(await readJson(request))
    const result = await respondToOffer({ offerId: id, sellerId: userId, decision })
    return ok({ offer: result.offer, orderId: result.order?.id ?? null })
  } catch (error) {
    return handleError(error)
  }
}

/** المشتري يسحب عرضه. */
export async function DELETE(_request: Request, context: Ctx) {
  try {
    const { id } = await context.params
    const userId = await requireUserId()
    return ok({ offer: await withdrawOffer(id, userId) })
  } catch (error) {
    return handleError(error)
  }
}
