import { faqInputSchema } from '@/lib/domain/schemas'
import { handleError, ok, readJson } from '@/lib/server/api'
import { requireAdminId } from '@/lib/server/require-admin'
import { deleteFaq, updateFaq } from '@/lib/server/admin-service'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, context: Ctx) {
  try {
    const adminId = await requireAdminId()
    const { id } = await context.params
    const input = faqInputSchema.partial().parse(await readJson(request))
    return ok({ item: await updateFaq(id, input, adminId) })
  } catch (error) {
    return handleError(error)
  }
}

export async function DELETE(_request: Request, context: Ctx) {
  try {
    const adminId = await requireAdminId()
    const { id } = await context.params
    await deleteFaq(id, adminId)
    return ok({ success: true })
  } catch (error) {
    return handleError(error)
  }
}
