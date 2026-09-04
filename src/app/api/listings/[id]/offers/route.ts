import { placeOfferSchema } from '@/lib/domain/schemas'
import { handleError, ok, readJson } from '@/lib/server/api'
import { placeOffer } from '@/lib/server/market-service'
import { requireUserId } from '@/lib/server/require-user'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const userId = await requireUserId()
    const body = placeOfferSchema.parse(await readJson(request))
    const offer = await placeOffer({
      listingId: id,
      buyerId: userId,
      amountRiyals: body.amount,
      message: body.message,
    })
    return ok({ offer })
  } catch (error) {
    return handleError(error)
  }
}
