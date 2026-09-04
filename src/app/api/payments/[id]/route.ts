import { transferProofSchema } from '@/lib/domain/schemas'
import { handleError, ok, readJson } from '@/lib/server/api'
import { requireUserId } from '@/lib/server/require-user'
import { cancelPayment, submitTransferProof, syncTapPayment } from '@/lib/server/payment-service'
import { getStore } from '@/lib/store'
import { ServiceError } from '@/lib/server/market-service'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** يزامن حالة العملية مع البوابة — يُستدعى عند عودة المستخدم من صفحة الدفع. */
export async function GET(_request: Request, context: Ctx) {
  try {
    const userId = await requireUserId()
    const { id } = await context.params
    const payment = await getStore().getPayment(id)
    if (!payment) throw new ServiceError('عملية الدفع غير موجودة', 404, 'PAYMENT_NOT_FOUND')
    if (payment.userId !== userId) throw new ServiceError('لا تملك هذه العملية', 403, 'FORBIDDEN')
    return ok({ payment: await syncTapPayment(id) })
  } catch (error) {
    return handleError(error)
  }
}

/** المستخدم يُرفق رقم حوالته البنكية. */
export async function POST(request: Request, context: Ctx) {
  try {
    const userId = await requireUserId()
    const { id } = await context.params
    const { note } = transferProofSchema.parse(await readJson(request))
    return ok({ payment: await submitTransferProof({ paymentId: id, userId, note }) })
  } catch (error) {
    return handleError(error)
  }
}

/** المستخدم يلغي عملية لم تُدفع بعد. */
export async function DELETE(_request: Request, context: Ctx) {
  try {
    const userId = await requireUserId()
    const { id } = await context.params
    return ok({ payment: await cancelPayment(id, userId) })
  } catch (error) {
    return handleError(error)
  }
}
