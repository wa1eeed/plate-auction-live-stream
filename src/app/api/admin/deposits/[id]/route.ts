import { depositDecisionSchema } from '@/lib/domain/schemas'
import { handleError, ok, readJson } from '@/lib/server/api'
import { requireAdminId } from '@/lib/server/require-admin'
import { forfeitDeposit, refundDeposit, undoForfeit } from '@/lib/server/wallet-service'

export const dynamic = 'force-dynamic'

/**
 * قرار على عربون: مصادرة أو ردّ أو تراجع عن مصادرة.
 * المصادرة تُعلّم الصفقة المرتبطة «متخلّفة عن السداد» في الوقت نفسه، ولا
 * تجوز قبل انقضاء مهلة السداد — الخادم يحرس ذلك لا الواجهة.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const adminId = await requireAdminId()
    const { id } = await context.params
    const body = depositDecisionSchema.parse(await readJson(request))

    const decide = {
      forfeit: forfeitDeposit,
      refund: refundDeposit,
      undo_forfeit: undoForfeit,
    }[body.decision]

    return ok({ deposit: await decide({ depositId: id, adminId, reason: body.reason }) })
  } catch (error) {
    return handleError(error)
  }
}
