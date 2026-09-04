import { faqInputSchema } from '@/lib/domain/schemas'
import { handleError, ok, readJson } from '@/lib/server/api'
import { requireAdminId } from '@/lib/server/require-admin'
import { createFaq, listFaqForAdmin } from '@/lib/server/admin-service'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await requireAdminId()
    return ok({ items: await listFaqForAdmin() })
  } catch (error) {
    return handleError(error)
  }
}

export async function POST(request: Request) {
  try {
    const adminId = await requireAdminId()
    const input = faqInputSchema.parse(await readJson(request))
    return ok({ item: await createFaq(input, adminId) })
  } catch (error) {
    return handleError(error)
  }
}
