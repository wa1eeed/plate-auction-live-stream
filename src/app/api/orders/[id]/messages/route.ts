import { z } from 'zod'
import { handleError, ok, readJson } from '@/lib/server/api'
import { MAX_MESSAGE_LENGTH, listChat, sendChatMessage } from '@/lib/server/order-chat-service'
import { requireUserId } from '@/lib/server/require-user'

export const dynamic = 'force-dynamic'

const messageSchema = z.object({
  kind: z.enum(['text', 'image', 'pdf', 'voice']),
  body: z.string().max(MAX_MESSAGE_LENGTH, 'الرسالة طويلة جدًا').nullish(),
  mediaKey: z.string().max(300).nullish(),
  fileName: z.string().max(200).nullish(),
  fileSize: z.number().int().min(0).nullish(),
  durationSeconds: z.number().int().min(0).max(600).nullish(),
})

/**
 * محادثةُ الصفقة — لطرفَيها وحدهما.
 *
 * ويعود `me` معها: الواجهةُ ترسم رسائلَها يمينًا ورسائلَ الطرف الآخر يسارًا،
 * فتحتاج أن تعرف أيُّها لها. ومعرّفُ الجلسة عند الخادم لا عند العميل.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const userId = await requireUserId()

    return ok(
      { messages: await listChat(id, userId), me: userId },
      { headers: { 'cache-control': 'no-store' } },
    )
  } catch (error) {
    return handleError(error)
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const userId = await requireUserId()
    const input = messageSchema.parse(await readJson(request))

    return ok({ message: await sendChatMessage(id, userId, input) })
  } catch (error) {
    return handleError(error)
  }
}
