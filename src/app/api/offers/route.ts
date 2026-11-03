import { handleError, ok } from '@/lib/server/api'
import { maskName } from '@/lib/domain/auction'
import { requireUserId } from '@/lib/server/require-user'
import { getStore } from '@/lib/store'
import { toPlate } from '@/lib/domain/types'

export const dynamic = 'force-dynamic'

/**
 * **السومُ الذي وصل على لوحاتي** — بائعًا.
 *
 * **ولم يكن له مسارٌ قطّ**: الويبُ يقرأ السومَ في صفحةِ خادمٍ تُصيَّر قبل
 * أن تُرسَل، فلم يحتج مسارًا. والتطبيقُ يرسم في الجهاز — فتابُ «بانتظارك»
 * فيه أربعةُ أنواعٍ في التصميم (§5.6) وثلاثةٌ تعمل، والرابعُ — سومٌ وصلك
 * — لا قائمةَ تُعرض منها. وزرّا «اقبل» و«ارفض» مرسومان بلا ما يُعرضان له.
 *
 * **والمعلَّقُ وحده يُرجَع**: ما قُبل صار صفقةً تُقرأ في `api/orders`، وما
 * رُفض أو سُحب لا ينتظر ردًّا — و«بانتظارك» قائمةُ ما عليك لا سجلٌّ.
 *
 * **واسمُ السائم يُقنَّع** كما في كشف المزايدات: «خالد ع*****». فالبائعُ
 * يقرّر على المبلغ لا على الاسم، ولا يُكشف اسمُ إنسانٍ كاملًا قبل أن تقع
 * صفقةٌ تقتضي التواصل.
 */
export async function GET() {
  try {
    const sellerId = await requireUserId()
    const store = getStore()

    const offers = (await store.listOffers({ sellerId })).filter(
      (offer) => offer.status === 'pending',
    )

    /* واللوحةُ تُقرأ مرّةً لكلّ إعلانٍ لا مرّةً لكلّ سوم */
    const listings = new Map(
      await Promise.all(
        [...new Set(offers.map((offer) => offer.listingId))].map(
          async (id) => [id, await store.getListing(id)] as const,
        ),
      ),
    )

    const rows = []
    for (const offer of offers) {
      const listing = listings.get(offer.listingId)
      /* وسومٌ على إعلانٍ حُذف يُسقَط — لا يُرسَل بلوحةٍ فارغة */
      if (!listing) continue
      const buyer = await store.findUser(offer.buyerId)

      rows.push({
        id: offer.id,
        listingId: listing.id,
        reference: listing.reference,
        plate: toPlate(listing),
        amount: offer.amount,
        message: offer.message,
        buyerName: maskName(buyer?.displayName ?? 'مستخدم'),
        createdAt: offer.createdAt,
      })
    }

    return ok({ offers: rows }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    return handleError(error)
  }
}
