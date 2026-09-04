import { startTopUpSchema } from '@/lib/domain/schemas'
import { riyalsToHalalas } from '@/lib/domain/money'
import { handleError, ok, readJson } from '@/lib/server/api'
import { requireUserId } from '@/lib/server/require-user'
import { getPublicPaymentOptions, getUserPayments, startTopUp } from '@/lib/server/payment-service'

export const dynamic = 'force-dynamic'

/** خيارات الدفع المفعّلة وعمليات المستخدم السابقة. */
export async function GET() {
  try {
    const userId = await requireUserId()
    return ok(
      { options: await getPublicPaymentOptions(), payments: await getUserPayments(userId) },
      { headers: { 'cache-control': 'no-store' } },
    )
  } catch (error) {
    return handleError(error)
  }
}

/** يبدأ شحن رصيد: يعيد رابط بوابة Tap، أو بيانات الحوالة البنكية. */
export async function POST(request: Request) {
  try {
    const userId = await requireUserId()
    const body = startTopUpSchema.parse(await readJson(request))
    const result = await startTopUp({
      userId,
      amount: riyalsToHalalas(body.amount),
      method: body.method,
    })
    return ok({ payment: result.payment, redirectUrl: result.redirectUrl })
  } catch (error) {
    return handleError(error)
  }
}
