import { z } from 'zod'
import { handleError, ok, readJson } from '@/lib/server/api'
import { requireUserId } from '@/lib/server/require-user'
import { getNotifications, markRead } from '@/lib/server/notification-service'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const userId = await requireUserId()
    return ok(await getNotifications(userId), { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    return handleError(error)
  }
}

const markSchema = z.object({
  /** بلا معرّفات = تعليم الكل مقروءًا */
  ids: z.array(z.string()).max(200).optional(),
})

export async function PATCH(request: Request) {
  try {
    const userId = await requireUserId()
    const { ids } = markSchema.parse(await readJson(request))
    return ok({ marked: await markRead(userId, ids) })
  } catch (error) {
    return handleError(error)
  }
}
