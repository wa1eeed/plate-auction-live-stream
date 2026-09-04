import { z } from 'zod'
import { handleError, ok, readJson } from '@/lib/server/api'
import { requireUserId } from '@/lib/server/require-user'
import { submitTransferProof } from '@/lib/server/escrow-service'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  note: z.string().trim().min(5, 'اذكر ما يُثبت نقل الملكية').max(500, 'النصّ طويل جدًا'),
})

/** البائع يرفع إثبات نقل الملكية، فتراجعه الإدارة قبل تحويل المبلغ له. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const sellerId = await requireUserId()
    const { id } = await context.params
    const { note } = bodySchema.parse(await readJson(request))
    return ok({ order: await submitTransferProof({ orderId: id, sellerId, note }) })
  } catch (error) {
    return handleError(error)
  }
}
