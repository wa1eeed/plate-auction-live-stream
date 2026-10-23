import { z } from 'zod'
import { handleError, ok, readJson } from '@/lib/server/api'
import { requireUserId } from '@/lib/server/require-user'
import { confirmTransferIdentity } from '@/lib/server/escrow-service'

export const dynamic = 'force-dynamic'

/*
 * والتحقّقُ هنا شكليٌّ يردّ ما ليس نصًّا، والقاعدةُ نفسُها في نطاق المجال
 * (`validateTransferIdentity`) — فهي التي تحرس، وتُستعمل في الواجهة أيضًا
 * فلا يفترق ما يقبله الخادم عمّا تَعِد به الشاشة.
 */
const bodySchema = z.object({
  nationalId: z.string().trim().max(20),
  birthDate: z.string().trim().max(10),
  birthCalendar: z.enum(['hijri', 'gregorian']),
})

/** المشتري يؤكّد بياناته التي يحتاجها البائع لنقل اللوحة في أبشر. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const buyerId = await requireUserId()
    const { id } = await context.params
    const body = bodySchema.parse(await readJson(request))
    return ok({ order: await confirmTransferIdentity({ orderId: id, buyerId, ...body }) })
  } catch (error) {
    return handleError(error)
  }
}
