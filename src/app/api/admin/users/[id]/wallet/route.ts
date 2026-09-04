import { walletAdjustmentSchema } from '@/lib/domain/schemas'
import { riyalsToHalalas } from '@/lib/domain/money'
import { handleError, ok, readJson } from '@/lib/server/api'
import { requireAdminId } from '@/lib/server/require-admin'
import { adjustBalance } from '@/lib/server/wallet-service'

export const dynamic = 'force-dynamic'

/** شحن أو خصم رصيد محفظة مستخدم — بأمر إداري موثّق في كشف حسابه. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const adminId = await requireAdminId()
    const { id } = await context.params
    const body = walletAdjustmentSchema.parse(await readJson(request))

    const result = await adjustBalance({
      userId: id,
      amount: riyalsToHalalas(body.amount),
      type: body.type,
      note: body.note?.trim() || null,
      adminId,
    })
    return ok({ balance: result.wallet.balance, held: result.wallet.held, entryId: result.entry.id })
  } catch (error) {
    return handleError(error)
  }
}
