import { handleError, ok } from '@/lib/server/api'
import { requireUserId } from '@/lib/server/require-user'
import { getWalletView } from '@/lib/server/wallet-service'

export const dynamic = 'force-dynamic'

/** محفظة المستخدم الحالي مع كشف حسابه وعرابينه. */
export async function GET() {
  try {
    const userId = await requireUserId()
    return ok(await getWalletView(userId), { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    return handleError(error)
  }
}
