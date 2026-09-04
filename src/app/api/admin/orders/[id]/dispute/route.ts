import { z } from 'zod'
import { handleError, ok, readJson } from '@/lib/server/api'
import { requireAdminId } from '@/lib/server/require-admin'
import { resolveDispute } from '@/lib/server/admin-service'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  decision: z.enum(['release', 'refund']),
  reason: z.string().trim().min(3, 'اذكر سببًا موجزًا').max(300, 'السبب طويل جدًا'),
})

/** قرار الإدارة في اعتراض: إفراج للبائع أو استرداد للمشتري. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const adminId = await requireAdminId()
    const { id } = await context.params
    const body = bodySchema.parse(await readJson(request))
    return ok({ order: await resolveDispute({ orderId: id, ...body, adminId }) })
  } catch (error) {
    return handleError(error)
  }
}
