import { handleError, ok } from '@/lib/server/api'
import { getPurchases, getSales } from '@/lib/server/order-service'
import { requireUserId } from '@/lib/server/require-user'

export const dynamic = 'force-dynamic'

/**
 * صفقاتُ المستخدم — مشترياتُه ومبيعاتُه في ردٍّ واحد.
 *
 * **ولم يكن لها مسار** لأنّ الويب يُصيّر صفحتَيهما على الخادم ويقرأ الخدمةَ
 * مباشرةً. والتطبيقُ الأصيل يرسم في الجهاز ويطلب بيانات، فيلزمه ما لم
 * يلزمها — وهذه أوّلُ فجوةٍ كشفها.
 *
 * **والدوران في ردٍّ واحد لا ردّين**: «نشاطي» يجمع ما ينتظرك من الجهتين،
 * فطلبان متتابعان يُبطئانه بمجموعهما ليُعرض جدولٌ واحد.
 */
export async function GET() {
  try {
    const userId = await requireUserId()
    const [purchases, sales] = await Promise.all([
      getPurchases(userId),
      getSales(userId),
    ])
    return ok({ purchases, sales }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    return handleError(error)
  }
}
