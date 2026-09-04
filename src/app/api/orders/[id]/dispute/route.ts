import { z } from 'zod'
import { handleError, ok, readJson } from '@/lib/server/api'
import { requireUserId } from '@/lib/server/require-user'
import { openDispute } from '@/lib/server/escrow-service'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  reason: z.string().trim().min(5, 'اذكر سبب اعتراضك').max(500, 'النصّ طويل جدًا'),
})

/** اعتراض من أحد الطرفين — يوقف مؤقّت الإفراج ويُحيل إلى الإدارة. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId()
    const { id } = await context.params
    const { reason } = bodySchema.parse(await readJson(request))
    return ok({ order: await openDispute({ orderId: id, userId, reason }) })
  } catch (error) {
    return handleError(error)
  }
}
