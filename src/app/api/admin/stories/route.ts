import { storyInputSchema } from '@/lib/domain/schemas'
import { handleError, ok, readJson } from '@/lib/server/api'
import { requireAdminId } from '@/lib/server/require-admin'
import { createStory, listStoriesForAdmin } from '@/lib/server/home-media-service'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await requireAdminId()
    return ok({ items: await listStoriesForAdmin() })
  } catch (error) {
    return handleError(error)
  }
}

export async function POST(request: Request) {
  try {
    const adminId = await requireAdminId()
    const input = storyInputSchema.parse(await readJson(request))
    return ok({ item: await createStory({ ...input, adminId }) })
  } catch (error) {
    return handleError(error)
  }
}
