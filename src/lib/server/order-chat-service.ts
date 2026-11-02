/**
 * محادثةُ الصفقة — بين بائعٍ ومشترٍ، في المنصّة لا خارجها.
 *
 * وكانت الواجهةُ ترسم المحادثةَ ببياناتٍ ساكنةٍ لأنّ الويبَ ما احتاجها:
 * الطرفانِ يخرجان إلى واتساب فيتّفقان هناك. وما خرج من المنصّة لا يُرى حين
 * يُتنازع: يقول هذا «وعدني» وينفي ذاك، ولا سجلَّ يُحكَم به.
 *
 * والمنطقُ هنا لا في المسار: المسارُ يقرأ الجلسةَ من الكوكي فلا يُقاس إلّا
 * بمتصفّحٍ كامل، والخدمةُ تأخذ المستخدمَ مُمرَّرًا فتُقاس بفحصٍ واحد.
 */
import type { Order, OrderMessage, OrderMessageKind } from '@/lib/domain/types'
import { getStore } from '@/lib/store'
import { ServiceError } from './market-service'

/** أقصى ما تحمله رسالةٌ نصّيّة — حدٌّ يمنع إغراقَ الجدول بلا خنقِ كلام. */
export const MAX_MESSAGE_LENGTH = 2000

/**
 * يتحقّق أنّ الطالبَ أحدُ طرفَي الصفقة — ثمّ يعيدها.
 *
 * **والتحقّقُ قبل كلّ قراءةٍ وكتابة**: محادثةٌ تُفتح برقم صفقةٍ وحده تكشف
 * ما اتّفق عليه رجلان لمن يُخمّن الأرقام.
 */
export async function requireOrderParty(orderId: string, userId: string): Promise<Order> {
  const order = await getStore().getOrder(orderId)
  if (!order) throw new ServiceError('لا توجد صفقة بهذا الرقم', 404, 'ORDER_NOT_FOUND')
  if (order.buyerId !== userId && order.sellerId !== userId) {
    throw new ServiceError('هذه الصفقة ليست لك', 403, 'NOT_YOUR_ORDER')
  }
  return order
}

/** رسائلُ الصفقة مرتّبةً — لطرفَيها وحدهما. */
export async function listChat(
  orderId: string,
  userId: string,
): Promise<OrderMessage[]> {
  await requireOrderParty(orderId, userId)
  return getStore().listOrderMessages(orderId)
}

export type NewMessage = {
  kind: OrderMessageKind
  body?: string | null
  mediaKey?: string | null
  fileName?: string | null
  fileSize?: number | null
  durationSeconds?: number | null
}

/**
 * إرسالُ رسالة.
 *
 * **ولا تُرسَل في صفقةٍ أُغلقت**: المحادثةُ أداةُ إتمامٍ لا بابُ مراسلةٍ
 * دائم — ومن أراد مخاطبةَ الطرف الآخر بعد انتهائها فالإدارةُ بينهما. وبقاءُ
 * الباب مفتوحًا بعد الإغلاق يجعل السجلَّ يطول بما لا علاقة له بالصفقة.
 */
export async function sendChatMessage(
  orderId: string,
  userId: string,
  input: NewMessage,
): Promise<OrderMessage> {
  const order = await requireOrderParty(orderId, userId)

  if (order.status === 'cancelled' || order.status === 'defaulted') {
    throw new ServiceError('أُغلقت هذه الصفقة — لا مراسلة فيها', 409, 'ORDER_CLOSED')
  }

  const body = input.body?.trim() ?? null
  if (input.kind === 'text' && !body) {
    throw new ServiceError('اكتب رسالةً أولًا', 400, 'EMPTY_MESSAGE')
  }
  if (body && body.length > MAX_MESSAGE_LENGTH) {
    throw new ServiceError('الرسالة طويلة جدًا', 400, 'MESSAGE_TOO_LONG')
  }
  /* وما ليس نصًّا لا بدّ له من مفتاحِ وسيطٍ — وإلّا فرسالةٌ فارغةٌ بنوعٍ كاذب */
  if (input.kind !== 'text' && !input.mediaKey?.trim()) {
    throw new ServiceError('لم يُرفع المرفق', 400, 'MISSING_MEDIA')
  }

  return getStore().addOrderMessage({
    orderId,
    senderId: userId,
    kind: input.kind,
    body,
    mediaKey: input.mediaKey?.trim() ?? null,
    fileName: input.fileName?.trim() ?? null,
    fileSize: input.fileSize ?? null,
    durationSeconds: input.durationSeconds ?? null,
  })
}
