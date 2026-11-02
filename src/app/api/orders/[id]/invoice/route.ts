import { handleError, ok } from '@/lib/server/api'
import { requireUserId } from '@/lib/server/require-user'
import { getStore } from '@/lib/store'
import { ServiceError } from '@/lib/server/market-service'

export const dynamic = 'force-dynamic'

/**
 * فاتورةُ صفقةٍ لصاحبها — `GET api/orders/{id}/invoice`.
 *
 * **ولم يكن لها مسار** لأنّ الويب يُصيّر صفحتَها على الخادم. والتطبيقُ
 * الأصيل يرسم في الجهاز ويطلب بيانات.
 *
 * **ولكلّ طرفٍ فاتورتُه**: المشتري يُفوتَر عمولتَه والبائعُ عمولتَه — وهما
 * فاتورتان مستقلّتان بسلسلتين، لا فاتورةٌ واحدةٌ تُرى من جهتين. فتُرجَع
 * فاتورةُ من يطلب وحدها.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const userId = await requireUserId()
    const store = getStore()

    const order = await store.getOrder(id)
    if (!order) throw new ServiceError('لا توجد صفقة بهذا الرقم', 404, 'ORDER_NOT_FOUND')

    /*
     * والتحقّق من الطرفَين قبل القراءة: فاتورةٌ تُقرأ برقم صفقةٍ وحده تُسرّب
     * مبالغَ صفقاتِ الناس لمن يُخمّن الأرقام.
     */
    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw new ServiceError('هذه الصفقة ليست لك', 403, 'NOT_YOUR_ORDER')
    }

    const invoices = await store.listInvoices({ orderId: id, userId })
    return ok({ invoices }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    return handleError(error)
  }
}
