import { z } from 'zod'
import { handleError, ok, readJson } from '@/lib/server/api'
import { requireAdminId } from '@/lib/server/require-admin'
import { reinstateListingByAdmin, suspendListingByAdmin } from '@/lib/server/admin-service'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

const decisionSchema = z.object({
  action: z.enum(['suspend', 'reinstate']),
  reason: z.string().trim().min(3, 'اذكر سببًا موجزًا').max(200, 'السبب طويل جدًا'),
})

/**
 * إيقاف إعلان مخالف أو رفع الإيقاف عنه.
 *
 * لا حذف: الإيقاف يُبقي الأثر للتدقيق. والسبب إلزامي في الحالتين — القرار
 * يظهر للبائع في إشعاره ويُقيَّد في سجلّ التدقيق باسم من نفّذه.
 */
export async function POST(request: Request, context: Ctx) {
  try {
    const adminId = await requireAdminId()
    const { id } = await context.params
    const { action, reason } = decisionSchema.parse(await readJson(request))

    const listing =
      action === 'suspend'
        ? await suspendListingByAdmin(id, adminId, reason)
        : await reinstateListingByAdmin(id, adminId, reason)
    return ok({ listing })
  } catch (error) {
    return handleError(error)
  }
}
