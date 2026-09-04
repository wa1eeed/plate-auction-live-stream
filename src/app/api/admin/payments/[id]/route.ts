import { paymentDecisionSchema } from '@/lib/domain/schemas'
import { handleError, ok, readJson } from '@/lib/server/api'
import { requireAdminId } from '@/lib/server/require-admin'
import { markPaymentFailed, markPaymentPaid } from '@/lib/server/payment-service'

export const dynamic = 'force-dynamic'

/**
 * تأكيد الحوالة البنكية أو رفضها.
 * التأكيد يضيف الرصيد فورًا، وينعكس على حالة العملية عند المستخدم.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const adminId = await requireAdminId()
    const { id } = await context.params
    const body = paymentDecisionSchema.parse(await readJson(request))

    const payment =
      body.decision === 'confirm'
        ? await markPaymentPaid({ paymentId: id, adminId, note: body.reason?.trim() || null })
        : await markPaymentFailed({
            paymentId: id,
            adminId,
            reason: body.reason?.trim() || 'لم يُعثر على الحوالة',
          })
    return ok({ payment })
  } catch (error) {
    return handleError(error)
  }
}
