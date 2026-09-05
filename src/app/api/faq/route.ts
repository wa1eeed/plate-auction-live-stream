import { handleError, ok } from '@/lib/server/api'
import { listPublicFaq } from '@/lib/server/admin-service'
import { SALE_TYPES } from '@/lib/domain/types'

export const dynamic = 'force-dynamic'

/** الأسئلة المنشورة — عامة بلا مصادقة. */
export async function GET(request: Request) {
  try {
    /*
     * `sale` يحصر الأسئلة بطريقة بيعٍ بعينها.
     *
     * وبلا معاملٍ تُرجع كلّ المنشور — وهي صفحة الأسئلة. وما لا يُعرف من قيم
     * يُهمل ولا يُردّ خطأً: معاملٌ عامّ في رابطٍ عامّ لا يُسقط الصفحة.
     */
    const sale = new URL(request.url).searchParams.get('sale')
    const saleType = SALE_TYPES.find((type) => type === sale)
    return ok({ items: await listPublicFaq(saleType) }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    return handleError(error)
  }
}
