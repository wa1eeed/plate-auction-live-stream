import { z } from 'zod'
import { handleError, ok, readJson } from '@/lib/server/api'
import { requireUserId } from '@/lib/server/require-user'
import { startOrderPayment } from '@/lib/server/checkout-service'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  method: z.enum(['wallet', 'tap', 'bank_transfer']),
})

/** يبدأ سداد صفقة بالوسيلة المختارة. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId()
    const { id } = await context.params
    const { method } = bodySchema.parse(await readJson(request))
    return ok(await startOrderPayment({ orderId: id, userId, method }))
  } catch (error) {
    return handleError(error)
  }
}
