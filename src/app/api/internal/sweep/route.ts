import { fail, handleError, ok } from '@/lib/server/api'
import { expireUnpaidOfferOrders, finalizeDueAuctions } from '@/lib/server/market-service'
import { getStore } from '@/lib/store'
import { LOCKS, withAdvisoryLock } from '@/lib/store/pg/client'

export const dynamic = 'force-dynamic'

const SECRET = process.env.SESSION_SECRET ?? 'development-only-insecure-secret'

/**
 * مسح داخلي يستدعيه الخادم المخصّص كل بضع ثوانٍ لإنهاء المزادات المستحقة.
 * بهذا ينتهي المزاد في وقته حتى لو لم يفتح أحد أي صفحة، ولا يعود الإنهاء
 * معتمدًا على وصول زائر.
 */
export async function POST(request: Request) {
  try {
    if (request.headers.get('x-internal-sweep') !== SECRET) {
      return fail('غير مصرّح', 403, 'FORBIDDEN')
    }
    const store = getStore()
    /*
     * ومعها صفقات السوم التي انقضت مهلتها.
     *
     * لا عربون فيها ينتظر قرار أدمن، وحارسُ «قبولٌ واحدٌ قائم» يحبس البائع ما
     * دامت الصفقة «بانتظار السداد» — فمشترٍ قبِل ثمّ اختفى يوقف اللوحة إلى
     * الأبد لولا هذا. والمسح يمرّ كل بضع ثوانٍ فلا يحتاج جدولًا ثانيًا.
     */
    /*
     * **ماسحٌ واحد لا أكثر — بقفلٍ في القاعدة.**
     *
     * `finalizeDueAuctions` تقرأ ثمّ تكتب، وحارسُها `existing.length === 0`
     * فحصٌ ثمّ فعل. فنسختان من التطبيق تمرّان به معًا — وكلُّ نسخةٍ تمسح كلّ
     * خمس ثوانٍ — فتُنشئان **صفقتين لمزادٍ واحد**. ولا تمسكها فرادةُ
     * `orders`: هي على (المشتري، مفتاح الطلب)، والمسح لا يمرّر مفتاحًا،
     * و`NULL` لا يتكرّر عند بوستجرس.
     *
     * وما كان يحمينا **عُرفٌ في التوثيق** — «نسخة واحدة ولا تزدها» — لا
     * حارسٌ في الكود. ويكفي أن تُضبط نسختان في لوحة النشر، أو تُنشر المنصّة
     * على خدمةٍ تزيد النسخ من تلقاء نفسها، ليقع ذلك بلا رسالة خطأ واحدة.
     *
     * و`null` تعني أنّ غيرَه في القفل — فلا خطأ ولا إعادة: الدورة التالية
     * بعد خمس ثوانٍ.
     */
    const swept = await withAdvisoryLock(LOCKS.sweep, async () => ({
      finalized: await finalizeDueAuctions(store),
      expired: await expireUnpaidOfferOrders(store),
    }))

    if (!swept) return ok({ finalized: 0, expired: 0, skipped: true })
    return ok(swept)
  } catch (error) {
    return handleError(error)
  }
}
