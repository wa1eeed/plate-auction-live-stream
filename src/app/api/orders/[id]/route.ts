import { orderStatusSchema } from '@/lib/domain/schemas'
import { fail, handleError, ok, readJson } from '@/lib/server/api'
import { getAccountOrder } from '@/lib/server/market-service'
import { updateOrderStatus } from '@/lib/server/order-service'
import { requireUserId } from '@/lib/server/require-user'

export const dynamic = 'force-dynamic'

/**
 * صفقةٌ واحدةٌ لصاحبها.
 *
 * **والويبُ يقرؤها في الخادم** قبل أن يُصيَّر مسارُها، فلم يكن للقراءة
 * مسار — والتطبيقُ بعد كلّ خطوةٍ تُغيّر المرحلة (سدادٌ أو تأكيدُ بيانات)
 * يحتاج نسختَها الجديدة، وكان يُعيد جلبَ القائمة كلِّها ليأخذ منها واحدة.
 *
 * **ومن ليس طرفًا لا يجد صفحةً** — `getAccountOrder` تردّ `null` له كما
 * تردّها لمعرّفٍ لا وجود له، فلا يُستدلّ بوجود الصفحة على وجود الصفقة.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId()
    const { id } = await context.params
    const found = await getAccountOrder(id, userId)
    if (!found) return fail('الصفقة غير موجودة', 404, 'ORDER_NOT_FOUND')
    return ok(
      { order: found.order, side: found.side },
      { headers: { 'cache-control': 'no-store' } },
    )
  } catch (error) {
    return handleError(error)
  }
}

/** البائع يلغي صفقته — أمّا الإتمام فيقع بتحويل المبلغ بعد نقل الملكية وتحقّق الإدارة. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const userId = await requireUserId()
    const { status } = orderStatusSchema.parse(await readJson(request))
    return ok({ order: await updateOrderStatus({ orderId: id, userId, status }) })
  } catch (error) {
    return handleError(error)
  }
}
