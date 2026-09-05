import { beforeEach, describe, expect, it } from 'vitest'
import { emptyDatabase, MemoryStore, type MemoryDatabase } from '@/lib/store/memory-store'
import { seedDatabase } from '@/lib/store/seed'
import { resetStoreForTests } from '@/lib/store'
import { resetRateLimits } from '@/lib/server/rate-limit'
import {
  buyNow,
  closeListing,
  expireUnpaidOfferOrders,
  finalizeDueAuctions,
  getAccountBids,
  getAccountListings,
  getListingDetail,
  getMarketListings,
  getOffersReceivedByUser,
  placeBid,
  placeOffer,
  respondToOffer,
} from '@/lib/server/market-service'
import { getPurchases, getSales, updateOrderStatus } from '@/lib/server/order-service'
import { getNotifications } from '@/lib/server/notification-service'
import { halalasToRiyals, riyalsToHalalas } from '@/lib/domain/money'
import type { Listing } from '@/lib/domain/types'

let db: MemoryDatabase
let store: MemoryStore

const findBy = (predicate: (listing: Listing) => boolean) => db.listings.find(predicate)!

/** مستخدم ليس البائع ولا صاحب أعلى مزايدة حالية — حتى لا تصطدم الاختبارات ببيانات البذور. */
function pickBidder(listing: Listing): string {
  const highest = db.bids
    .filter((bid) => bid.listingId === listing.id && bid.status === 'accepted')
    .sort((a, b) => b.amount - a.amount)[0]
  const user = db.users.find(
    (candidate) => candidate.id !== listing.sellerId && candidate.id !== highest?.bidderId,
  )
  if (!user) throw new Error('لا يوجد مزايد مناسب في بيانات البذور')
  return user.id
}

beforeEach(() => {
  db = emptyDatabase()
  seedDatabase(db)
  store = new MemoryStore(db)
  resetStoreForTests(store)
  resetRateLimits()
})

describe('السوق العام', () => {
  it('يعرض الإعلانات المنشورة فقط ويخفي المسودّات', async () => {
    const cards = await getMarketListings()
    const drafts = db.listings.filter((l) => l.status === 'draft')
    expect(drafts.length).toBeGreaterThan(0)
    expect(cards).toHaveLength(db.listings.length - drafts.length)
    for (const draft of drafts) expect(cards.some((c) => c.id === draft.id)).toBe(false)
  })

  it('لا يسرّب السعر الاحتياطي ولا بيانات التواصل', async () => {
    const cards = await getMarketListings()
    const serialized = JSON.stringify(cards)
    expect(serialized).not.toContain('reservePrice')
    expect(serialized).not.toContain('phone')

    const auction = findBy((l) => l.saleType === 'auction' && l.reservePrice > 0)
    const detail = await getListingDetail(auction.id)
    const detailJson = JSON.stringify(detail)
    expect(detailJson).not.toContain('reservePrice')
    expect(detailJson).not.toContain(String(auction.reservePrice))
    expect(detail.reserveState).toBeDefined()
  })

  it('كل إعلان وحدة مستقلة يُوصَل إليها بمعرّفها', async () => {
    for (const card of await getMarketListings()) {
      const detail = await getListingDetail(card.id)
      expect(detail.id).toBe(card.id)
    }
  })

  it('يخفي المسودّة عن غير صاحبها ويظهرها له', async () => {
    const draft = findBy((l) => l.status === 'draft')
    await expect(getListingDetail(draft.id)).rejects.toThrow()
    const detail = await getListingDetail(draft.id, draft.sellerId)
    expect(detail.isMine).toBe(true)
  })
})

describe('المزايدة', () => {
  it('تُسجَّل وتحدّث أعلى مزايدة وتظهر في كشف المزايدات', async () => {
    const auction = findBy((l) => l.saleType === 'auction' && l.status === 'active')
    const buyerId = pickBidder(auction)
    const before = await getListingDetail(auction.id)

    await placeBid({
      listingId: auction.id,
      bidderId: buyerId,
      amountRiyals: halalasToRiyals(before.nextBidAmount),
      isCustomAmount: false,
      clientRequestId: 'bid-flow-1',
    })

    const after = await getListingDetail(auction.id, buyerId)
    expect(after.highestAmount).toBe(before.nextBidAmount)
    expect(after.iAmHighest).toBe(true)
    expect(after.bidCount).toBe(before.bidCount + 1)
    expect(after.ledger[0].isMine).toBe(true)
  })

  it('ترفض مزايدة البائع على إعلانه', async () => {
    const auction = findBy((l) => l.saleType === 'auction' && l.status === 'active')
    const detail = await getListingDetail(auction.id)
    await expect(
      placeBid({
        listingId: auction.id,
        bidderId: auction.sellerId,
        amountRiyals: halalasToRiyals(detail.nextBidAmount),
        isCustomAmount: false,
        clientRequestId: 'bid-own-1',
      }),
    ).rejects.toThrow()
  })

  it('تُسلسل مزايدتين متزامنتين فلا ينشأ ترتيب خاطئ', async () => {
    const auction = findBy((l) => l.saleType === 'auction' && l.status === 'active')
    const highest = db.bids
      .filter((bid) => bid.listingId === auction.id && bid.status === 'accepted')
      .sort((a, b) => b.amount - a.amount)[0]
    const others = db.users.filter(
      (u) => u.id !== auction.sellerId && u.id !== highest?.bidderId,
    )
    const detail = await getListingDetail(auction.id)
    const amount = halalasToRiyals(detail.nextBidAmount)

    const results = await Promise.allSettled([
      placeBid({ listingId: auction.id, bidderId: others[0].id, amountRiyals: amount, isCustomAmount: false, clientRequestId: 'c1' }),
      placeBid({ listingId: auction.id, bidderId: others[1] ? others[1].id : auction.sellerId, amountRiyals: amount, isCustomAmount: false, clientRequestId: 'c2' }),
    ])

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1)
  })

  it('لا تنفّذ نفس الطلب مرتين', async () => {
    const auction = findBy((l) => l.saleType === 'auction' && l.status === 'active')
    const buyerId = pickBidder(auction)
    const detail = await getListingDetail(auction.id)
    const command = {
      listingId: auction.id,
      bidderId: buyerId,
      amountRiyals: halalasToRiyals(detail.nextBidAmount),
      isCustomAmount: false,
      clientRequestId: 'same-request',
    }
    const first = await placeBid(command)
    const second = await placeBid(command)
    expect(second.bid.id).toBe(first.bid.id)
  })

  it('تُنهي المزاد تلقائيًا وتنشئ طلب شراء عند بلوغ الاحتياطي', async () => {
    const auction = findBy((l) => l.saleType === 'auction' && l.status === 'active')
    const buyerId = pickBidder(auction)
    await store.updateListing(auction.id, { reservePrice: riyalsToHalalas(1) })

    const detail = await getListingDetail(auction.id)
    await placeBid({
      listingId: auction.id,
      bidderId: buyerId,
      amountRiyals: halalasToRiyals(detail.nextBidAmount),
      isCustomAmount: false,
      clientRequestId: 'win-1',
    })
    await store.updateListing(auction.id, { endsAt: new Date(Date.now() - 1000).toISOString() })
    await finalizeDueAuctions(store)

    const closed = await store.getListing(auction.id)
    expect(closed?.status).toBe('sold')
    expect(closed?.soldToUserId).toBe(buyerId)

    const purchases = await getPurchases(buyerId)
    expect(purchases.some((order) => order.listingId === auction.id)).toBe(true)
  })

  it('تُنهي المزاد بـ reserve_not_met دون بلوغ الاحتياطي', async () => {
    const auction = findBy((l) => l.saleType === 'auction' && l.status === 'active')
    await store.updateListing(auction.id, {
      reservePrice: riyalsToHalalas(9_000_000),
      endsAt: new Date(Date.now() - 1000).toISOString(),
    })
    await finalizeDueAuctions(store)
    const closed = await store.getListing(auction.id)
    expect(['reserve_not_met', 'no_bids']).toContain(closed?.status)
    expect(closed?.soldToUserId).toBeNull()
  })
})

describe('البيع المباشر', () => {
  it('ينشئ طلبًا ويغلق الإعلان', async () => {
    const fixed = findBy((l) => l.saleType === 'fixed' && l.status === 'active')
    const buyer = db.users.find((u) => u.id !== fixed.sellerId)!

    const result = await buyNow({ listingId: fixed.id, buyerId: buyer.id, clientRequestId: 'buy-1' })
    expect(result.order.amount).toBe(fixed.price)

    const closed = await store.getListing(fixed.id)
    expect(closed?.status).toBe('sold')
    expect(closed?.soldToUserId).toBe(buyer.id)

    const purchases = await getPurchases(buyer.id)
    expect(purchases[0].listingId).toBe(fixed.id)
    const sales = await getSales(fixed.sellerId)
    expect(sales.some((order) => order.listingId === fixed.id)).toBe(true)
  })

  it('يمنع بيع اللوحة نفسها لمشتريين متزامنين', async () => {
    const fixed = findBy((l) => l.saleType === 'fixed' && l.status === 'active')
    const others = db.users.filter((u) => u.id !== fixed.sellerId)

    const results = await Promise.allSettled([
      buyNow({ listingId: fixed.id, buyerId: others[0].id, clientRequestId: 'b1' }),
      buyNow({ listingId: fixed.id, buyerId: others[1].id, clientRequestId: 'b2' }),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(db.orders.filter((o) => o.listingId === fixed.id)).toHaveLength(1)
  })
})

describe('العروض', () => {
  /*
   * القبول وعدٌ، والسداد بيع.
   *
   * السوم بلا عربون، فلا شيء يضمن قبولَه. وكانت اللوحة تُرفع من السوق لحظة
   * القبول وتسقط بقيّةُ السوم معها، فإن لم يسدّد صاحبُ الوعد بقيت محجوبةً
   * حتى تنقضي مهلته — يخسر البائع أيّامًا ومشترين كانوا قائمين.
   */
  it('القبول لا يُغلق الإعلان ولا يُسقط بقيّة السوم', async () => {
    const listing = findBy((l) => l.saleType === 'offers' && l.status === 'active')
    const buyers = db.users.filter((u) => u.id !== listing.sellerId)

    const first = await placeOffer({
      listingId: listing.id,
      buyerId: buyers[0].id,
      amountRiyals: halalasToRiyals(listing.minimumOffer) + 1_000,
    })
    await placeOffer({
      listingId: listing.id,
      buyerId: buyers[1].id,
      amountRiyals: halalasToRiyals(listing.minimumOffer) + 500,
    })

    const result = await respondToOffer({
      offerId: first.id,
      sellerId: listing.sellerId,
      decision: 'accept',
    })
    expect(result.order).not.toBeNull()

    const still = await store.getListing(listing.id)
    expect(still?.status, 'رُفعت اللوحة من السوق بوعدٍ لا يضمنه مال').toBe('active')
    expect(still?.soldToUserId).toBeNull()

    const remaining = await store.listOffers({ listingId: listing.id })
    expect(remaining.filter((o) => o.status === 'pending')).toHaveLength(1)
  })

  it('ولا يُقبل عرضٌ ثانٍ ما دام الأوّل ينتظر سداده', async () => {
    const listing = findBy((l) => l.saleType === 'offers' && l.status === 'active')
    const buyers = db.users.filter((u) => u.id !== listing.sellerId)
    const first = await placeOffer({
      listingId: listing.id,
      buyerId: buyers[0].id,
      amountRiyals: halalasToRiyals(listing.minimumOffer) + 1_000,
    })
    const second = await placeOffer({
      listingId: listing.id,
      buyerId: buyers[1].id,
      amountRiyals: halalasToRiyals(listing.minimumOffer) + 500,
    })

    await respondToOffer({ offerId: first.id, sellerId: listing.sellerId, decision: 'accept' })

    // وإلّا سدّد اثنان ثمنَ لوحةٍ يملكها أحدهما
    await expect(
      respondToOffer({ offerId: second.id, sellerId: listing.sellerId, decision: 'accept' }),
    ).rejects.toThrow(/ينتظر سداده/)
  })

  it('يرفض عرضًا دون أن يُغلق الإعلان', async () => {
    const listing = findBy((l) => l.saleType === 'offers' && l.status === 'active')
    const buyer = db.users.find((u) => u.id !== listing.sellerId)!
    const offer = await placeOffer({
      listingId: listing.id,
      buyerId: buyer.id,
      amountRiyals: halalasToRiyals(listing.minimumOffer) + 100,
    })

    await respondToOffer({ offerId: offer.id, sellerId: listing.sellerId, decision: 'decline' })
    expect((await store.getListing(listing.id))?.status).toBe('active')
  })

  it('يمنع مستخدمًا آخر من الرد على العروض', async () => {
    const listing = findBy((l) => l.saleType === 'offers' && l.status === 'active')
    const buyer = db.users.find((u) => u.id !== listing.sellerId)!
    const offer = await placeOffer({
      listingId: listing.id,
      buyerId: buyer.id,
      amountRiyals: halalasToRiyals(listing.minimumOffer) + 100,
    })
    await expect(
      respondToOffer({ offerId: offer.id, sellerId: buyer.id, decision: 'accept' }),
    ).rejects.toThrow()
  })

  it('عرض جديد يسحب عرض المشتري السابق', async () => {
    const listing = findBy((l) => l.saleType === 'offers' && l.status === 'active')
    const buyer = db.users.find((u) => u.id !== listing.sellerId)!
    const min = halalasToRiyals(listing.minimumOffer)

    await placeOffer({ listingId: listing.id, buyerId: buyer.id, amountRiyals: min + 100 })
    await placeOffer({ listingId: listing.id, buyerId: buyer.id, amountRiyals: min + 900 })

    const mine = await store.listOffers({ listingId: listing.id, buyerId: buyer.id })
    const pending = mine.filter((o) => o.status === 'pending')
    expect(pending).toHaveLength(1)
    // العرض المتبقّي هو الأحدث، وكل ما قبله مسحوب
    expect(pending[0].amount).toBe(riyalsToHalalas(min + 900))
    expect(mine.filter((o) => o.status === 'withdrawn').length).toBeGreaterThanOrEqual(1)
  })
})

describe('صفحات الحساب', () => {
  it('تعرض لوحات البائع مع السعر الاحتياطي والفارق', async () => {
    const seller = db.users[0]
    const listings = await getAccountListings(seller.id)
    expect(listings.length).toBeGreaterThan(0)
    expect(listings.every((l) => l.sellerId === seller.id)).toBe(true)
    expect(listings.some((l) => l.reservePrice > 0)).toBe(true)
    expect(typeof listings[0].reserveGap).toBe('number')
  })

  it('تعرض مزايدات المستخدم وحالته فيها', async () => {
    const auction = findBy((l) => l.saleType === 'auction' && l.status === 'active')
    const buyerId = pickBidder(auction)
    const detail = await getListingDetail(auction.id)
    await placeBid({
      listingId: auction.id,
      bidderId: buyerId,
      amountRiyals: halalasToRiyals(detail.nextBidAmount),
      isCustomAmount: false,
      clientRequestId: 'acct-1',
    })

    const bids = await getAccountBids(buyerId)
    const entry = bids.find((b) => b.listingId === auction.id)
    expect(entry?.isHighest).toBe(true)
  })

  it('تعرض العروض الواردة للبائع', async () => {
    const listing = findBy((l) => l.saleType === 'offers' && l.status === 'active')
    const received = await getOffersReceivedByUser(listing.sellerId)
    expect(received.every((offer) => offer.counterpartName.length > 0)).toBe(true)
  })

  it('البائع وحده يحدّث حالة الطلب — والإتمام صار إفراجًا لا زرًّا', async () => {
    const fixed = findBy((l) => l.saleType === 'fixed' && l.status === 'active')
    const buyer = db.users.find((u) => u.id !== fixed.sellerId)!
    const { order } = await buyNow({ listingId: fixed.id, buyerId: buyer.id, clientRequestId: 'ord-1' })

    // المشتري لا يملك تحديث الحالة أصلًا
    await expect(
      updateOrderStatus({ orderId: order.id, userId: buyer.id, status: 'completed' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })

    /*
     * والبائع لا يُتمّها إطلاقًا: الإتمام صار **إفراجًا** بعد نقل الملكية
     * وتأكيد المشتري. كان يُغلقها بضغطة فيقبض عربون المشتري بلا ثمن.
     */
    await expect(
      updateOrderStatus({ orderId: order.id, userId: fixed.sellerId, status: 'completed' }),
    ).rejects.toMatchObject({ code: 'USE_TRANSFER_FLOW' })
    expect((await store.getOrder(order.id))!.status).toBe('awaiting_settlement')

    // والإلغاء يبقى بيده
    const cancelled = await updateOrderStatus({
      orderId: order.id,
      userId: fixed.sellerId,
      status: 'cancelled',
    })
    expect(cancelled.status).toBe('cancelled')
  })
})

/*
 * ما يقع بالسوم حين يُغلق إعلانه.
 *
 * العرابين تُفكّ عند الإغلاق منذ البداية، وبقي السوم وحده معلّقًا على إعلانٍ
 * ميت — «قيد الانتظار» بلا إشعار، وزرُّ سحبه يعمل كأنّ شيئًا ينتظره.
 */
describe('إغلاق الإعلان والسوم القائم عليه', () => {
  it('سحبُ البائع إعلانَه يُغلق السوم ويُشعر أصحابه', async () => {
    const listing = findBy((l) => l.saleType === 'offers' && l.status === 'active')
    const buyers = db.users.filter((u) => u.id !== listing.sellerId)
    for (const buyer of buyers.slice(0, 2)) {
      await placeOffer({
        listingId: listing.id,
        buyerId: buyer.id,
        amountRiyals: halalasToRiyals(listing.minimumOffer) + 500,
      })
    }
    expect(
      (await store.listOffers({ listingId: listing.id })).filter((o) => o.status === 'pending'),
    ).toHaveLength(2)

    await closeListing(store, listing.id, 'cancelled', 'سحب البائع إعلانه')

    const after = await store.listOffers({ listingId: listing.id })
    expect(after.filter((o) => o.status === 'pending'), 'سومٌ معلّق على إعلانٍ ميت').toHaveLength(0)

    for (const buyer of buyers.slice(0, 2)) {
      const { items } = await getNotifications(buyer.id)
      expect(
        items.some((n) => n.type === 'offer_declined'),
        `لم يُخبَر ${buyer.displayName} بإغلاق عرضه`,
      ).toBe(true)
    }
  })
})

/*
 * السوم لا يحبس بائعه.
 *
 * لا عربون فيه ينتظر قرار أدمن، وحارسُ «قبولٌ واحدٌ قائم» يمنع قبول غيره ما
 * دامت الصفقة «بانتظار السداد». ولا شيء في المنصّة كان يجعل صفقةً متأخّرة
 * متخلّفةً تلقائيًا — فمشترٍ قبِل ثمّ اختفى يوقف اللوحة إلى الأبد.
 */
describe('انقضاء مهلة السداد في السوم', () => {
  const offersListing = () =>
    findBy((l) => l.saleType === 'offers' && l.status === 'active')

  it('تنقضي المهلة فتُغلق الصفقة ويعود البائع يقبل غيره', async () => {
    const listing = offersListing()
    const buyers = db.users.filter((u) => u.id !== listing.sellerId)
    const first = await placeOffer({
      listingId: listing.id,
      buyerId: buyers[0].id,
      amountRiyals: halalasToRiyals(listing.minimumOffer) + 1_000,
    })
    const second = await placeOffer({
      listingId: listing.id,
      buyerId: buyers[1].id,
      amountRiyals: halalasToRiyals(listing.minimumOffer) + 500,
    })
    const { order } = await respondToOffer({
      offerId: first.id,
      sellerId: listing.sellerId,
      decision: 'accept',
    })

    // ما دامت في مهلتها لا تنقضي، ويبقى الحارس قائمًا
    expect(await expireUnpaidOfferOrders(store)).toBe(0)
    await expect(
      respondToOffer({ offerId: second.id, sellerId: listing.sellerId, decision: 'accept' }),
    ).rejects.toThrow(/ينتظر سداده/)

    // تُدفع المهلة إلى الماضي كما يفعل الزمن
    const row = db.orders.find((o) => o.id === order!.id)!
    row.paymentDueAt = new Date(Date.now() - 60_000).toISOString()

    expect(await expireUnpaidOfferOrders(store)).toBe(1)
    expect((await store.getOrder(order!.id))?.status).toBe('defaulted')

    // واللوحة لم تُغلق، والسوم الثاني قائم، فيقبله البائع بلا تدخّل إدارة
    expect((await store.getListing(listing.id))?.status).toBe('active')
    const retry = await respondToOffer({
      offerId: second.id,
      sellerId: listing.sellerId,
      decision: 'accept',
    })
    expect(retry.order).not.toBeNull()
  })

  it('ولا تمسّ صفقات المزاد — عربونها ينتظر قرارًا لا مرور وقت', async () => {
    const auctionOrder = db.orders.find((o) => o.source === 'auction')
    if (!auctionOrder) return
    auctionOrder.status = 'awaiting_settlement'
    auctionOrder.paymentDueAt = new Date(Date.now() - 60_000).toISOString()

    await expireUnpaidOfferOrders(store)
    expect((await store.getOrder(auctionOrder.id))?.status).toBe('awaiting_settlement')
  })
})
