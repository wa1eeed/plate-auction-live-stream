import { handleError, ok } from '@/lib/server/api'
import { requireAdminId } from '@/lib/server/require-admin'
import { settlePlatformEntry } from '@/lib/server/commission-service'

export const dynamic = 'force-dynamic'

/** تحصيل عمولة مستحقّة بعد أن صار في المحفظة ما يكفيها. */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const adminId = await requireAdminId()
    const { id } = await context.params
    await settlePlatformEntry({ entryId: id, adminId })
    return ok({ settled: true })
  } catch (error) {
    return handleError(error)
  }
}
