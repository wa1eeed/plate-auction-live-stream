import { z } from 'zod'
import { handleError, ok, readJson } from '@/lib/server/api'
import { requireAdminId } from '@/lib/server/require-admin'
import { getReawardContext, reawardOrder } from '@/lib/server/admin-service'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** خيارات إعادة الإرساء: المزايدون الذين يلون الفائز المتخلّف. */
export async function GET(_request: Request, context: Ctx) {
  try {
    await requireAdminId()
    const { id } = await context.params
    return ok(await getReawardContext(id))
  } catch (error) {
    return handleError(error)
  }
}

const reawardSchema = z.object({
  nextBidderId: z.string().min(1, 'اختر المزايد التالي'),
  forfeitCurrentDeposit: z.boolean().default(true),
  reason: z.string().trim().min(3, 'اذكر سببًا موجزًا').max(200, 'السبب طويل جدًا'),
})

/** إعادة الإرساء ومصادرة عربون المتخلّف في إجراء واحد. */
export async function POST(request: Request, context: Ctx) {
  try {
    const adminId = await requireAdminId()
    const { id } = await context.params
    const body = reawardSchema.parse(await readJson(request))
    return ok(await reawardOrder({ orderId: id, ...body, adminId }))
  } catch (error) {
    return handleError(error)
  }
}
