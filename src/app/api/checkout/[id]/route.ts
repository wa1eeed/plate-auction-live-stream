import { z } from 'zod'
import { handleError, ok, readJson } from '@/lib/server/api'
import { requireUserId } from '@/lib/server/require-user'
import { getCheckoutView, startOrderPayment } from '@/lib/server/checkout-service'

export const dynamic = 'force-dynamic'

/**
 * صفحةُ السداد: المطلوبُ والرصيدُ والوسائلُ المتاحة.
 *
 * **ولا يُسأل العميلُ أن يحسب المطلوب.** فالصافي (`settlement.net`) يُبنى
 * في الخادم من الثمن والعربون والعمولة وضريبتها، وأيُّ حسابٍ يُعاد في
 * الواجهة يفترق عنه سطرًا من القواعد ثمّ يُرفض الدفعُ بعد الضغط.
 *
 * و`getCheckoutView` تقصره على مشتري الصفقة — فلا تُقرأ مبالغُ غيره.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId()
    const { id } = await context.params
    return ok(await getCheckoutView(id, userId), {
      headers: { 'cache-control': 'no-store' },
    })
  } catch (error) {
    return handleError(error)
  }
}

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
