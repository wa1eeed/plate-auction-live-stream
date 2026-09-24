import { z } from 'zod'
import { handleError, ok, readJson } from '@/lib/server/api'
import { counterOffer, respondToCounter } from '@/lib/server/market-service'
import { requireUserId } from '@/lib/server/require-user'
import { riyalsToHalalas } from '@/lib/domain/money'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** المبلغ بالريال كما يكتبه صاحبه — والتحويل إلى الهللة هنا لا في الواجهة. */
const counterSchema = z.object({
  amount: z.number().positive('اكتب مبلغًا صحيحًا'),
  message: z.string().trim().max(300).nullable().default(null),
})

const decisionSchema = z.object({ decision: z.enum(['accept', 'decline']) })

/** البائع يسوم بمبلغٍ بدل أن يقبل أو يرفض. */
export async function POST(request: Request, context: Ctx) {
  try {
    const { id } = await context.params
    const sellerId = await requireUserId()
    const { amount, message } = counterSchema.parse(await readJson(request))
    return ok({
      offer: await counterOffer({
        offerId: id,
        sellerId,
        amount: riyalsToHalalas(amount),
        message,
      }),
    })
  } catch (error) {
    return handleError(error)
  }
}

/**
 * المشتري يردّ على سوم البائع.
 *
 * ومسارٌ مستقلٌّ عن `POST /api/offers/[id]`: ذاك للبائع على العرض، وهذا
 * للمشتري على السوم. وجمعُهما في واحدٍ يعني حارسَ صلاحيةٍ يتفرّع بالنيّة —
 * ومن أخطأ فرعَه فتح البابَ للطرف الآخر.
 */
export async function PATCH(request: Request, context: Ctx) {
  try {
    const { id } = await context.params
    const buyerId = await requireUserId()
    const { decision } = decisionSchema.parse(await readJson(request))
    const result = await respondToCounter({ offerId: id, buyerId, decision })
    return ok({ offer: result.offer, orderId: result.order?.id ?? null })
  } catch (error) {
    return handleError(error)
  }
}
