import { placeBidSchema } from '@/lib/domain/schemas'
import { handleError, ok, readJson } from '@/lib/server/api'
import { placeBid } from '@/lib/server/market-service'
import { requireUserId } from '@/lib/server/require-user'

export const dynamic = 'force-dynamic'

/**
 * تسجيل مزايدة. كل التحقق على الخادم: حالة الإعلان، الوقت، ملكية البائع،
 * المبلغ المطلوب، ومنع التزامن — ولا يُوثق بأي قيمة قادمة من العميل.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const userId = await requireUserId()
    const body = placeBidSchema.parse(await readJson(request))

    const outcome = await placeBid({
      listingId: id,
      bidderId: userId,
      amountRiyals: body.amount,
      isCustomAmount: body.isCustomAmount,
      clientRequestId: body.clientRequestId,
    })

    return ok({
      bidId: outcome.bid.id,
      amount: outcome.bid.amount,
      endsAt: outcome.listing.endsAt,
      extended: outcome.extended,
      addedSeconds: outcome.addedSeconds,
    })
  } catch (error) {
    return handleError(error)
  }
}
