import { beforeEach, describe, expect, it } from 'vitest'
import { emptyDatabase, MemoryStore, type MemoryDatabase } from '@/lib/store/memory-store'
import { seedDatabase } from '@/lib/store/seed'
import { resetStoreForTests } from '@/lib/store'
import { resetRateLimits } from '@/lib/server/rate-limit'
import { getNotifications, markRead, notify } from '@/lib/server/notification-service'
import { finalizeDueAuctions, placeBid, placeOffer, respondToOffer } from '@/lib/server/market-service'
import { captureOrderEscrow } from '@/lib/server/escrow-service'
import { getRealtimeRegistry, userTopic, type RealtimeSocket } from '@/lib/server/realtime'
import { halalasToRiyals } from '@/lib/domain/money'
import type { Listing } from '@/lib/domain/types'

let db: MemoryDatabase
let store: MemoryStore

const listingBy = (predicate: (l: Listing) => boolean) => db.listings.find(predicate)!

function pickBidder(listing: Listing): string {
  const highest = db.bids
    .filter((b) => b.listingId === listing.id && b.status === 'accepted')
    .sort((a, b) => b.serverSequence - a.serverSequence)[0]
  return db.users.find((u) => u.id !== listing.sellerId && u.id !== highest?.bidderId)!.id
}

const highestOf = (listing: Listing) =>
  db.bids
    .filter((b) => b.listingId === listing.id && b.status === 'accepted')
    .sort((a, b) => b.amount - a.amount)[0]

beforeEach(() => {
  db = emptyDatabase()
  seedDatabase(db)
  store = new MemoryStore(db)
  resetStoreForTests(store)
  resetRateLimits()
  const registry = getRealtimeRegistry()
  registry.sockets.clear()
  registry.seq.clear()
})

describe('إنشاء الإشعارات', () => {
  it('ينشئ إشعارًا غير مقروء ويدفعه على موضوع صاحبه', async () => {
    const userId = db.users[0].id
    const received: string[] = []
    const socket: RealtimeSocket = {
      topics: new Set([userTopic(userId)]),
      send: (data) => received.push(data),
    }
    getRealtimeRegistry().sockets.add(socket)

    await notify(store, {
      userId,
      type: 'outbid',
      title: 'تجاوزك مزايد آخر',
      body: 'اختبار',
      href: '/market/x',
    })

    const summary = await getNotifications(userId)
    expect(summary.unread).toBe(1)
    expect(summary.items[0]).toMatchObject({ type: 'outbid', readAt: null, href: '/market/x' })

    const pushed = received.map((raw) => JSON.parse(raw))
    expect(pushed.some((m) => m.kind === 'notification')).toBe(true)
  })

  it('لا يصل الإشعار إلى موضوع مستخدم آخر', async () => {
    const [a, b] = db.users
    const received: string[] = []
    getRealtimeRegistry().sockets.add({
      topics: new Set([userTopic(b.id)]),
      send: (data) => received.push(data),
    })

    await notify(store, { userId: a.id, type: 'outbid', title: 'ت', body: 'ب' })
    expect(received).toHaveLength(0)
    expect((await getNotifications(b.id)).unread).toBe(0)
  })

  it('فشل الدفع اللحظي لا يمنع حفظ الإشعار', async () => {
    const userId = db.users[0].id
    getRealtimeRegistry().sockets.add({
      topics: new Set([userTopic(userId)]),
      send: () => {
        throw new Error('socket closed')
      },
    })

    await expect(
      notify(store, { userId, type: 'payment_confirmed', title: 'ت', body: 'ب' }),
    ).resolves.toBeUndefined()
    expect((await getNotifications(userId)).unread).toBe(1)
  })

  it('تعليم الكلّ مقروءًا يصفّر العدّاد', async () => {
    const userId = db.users[0].id
    for (const i of [1, 2, 3]) {
      await notify(store, { userId, type: 'outbid', title: `ت${i}`, body: 'ب' })
    }
    expect(await markRead(userId)).toBe(3)
    expect((await getNotifications(userId)).unread).toBe(0)
  })

  it('تعليم إشعار بعينه لا يمسّ البقية', async () => {
    const userId = db.users[0].id
    await notify(store, { userId, type: 'outbid', title: 'أ', body: 'ب' })
    await notify(store, { userId, type: 'auction_won', title: 'ب', body: 'ب' })

    const before = await getNotifications(userId)
    expect(await markRead(userId, [before.items[0].id])).toBe(1)
    expect((await getNotifications(userId)).unread).toBe(1)
  })
})

describe('إشعارات المزايدة', () => {
  it('تُنبّه من تجاوزه المزايد الجديد ولا تُنبّه المزايد نفسه', async () => {
    const listing = listingBy((l) => l.saleType === 'auction' && l.status === 'active')
    const first = pickBidder(listing)
    await placeBid({
      listingId: listing.id,
      bidderId: first,
      amountRiyals: halalasToRiyals(highestOf(listing).amount + listing.minimumIncrement),
      isCustomAmount: false,
      clientRequestId: 'a',
    })
    await markRead(first)

    const second = db.users.find((u) => u.id !== first && u.id !== listing.sellerId)!.id
    // نصفّر إشعاراته أولًا: قد تكون له مزايدة مبذورة فنُبّه من مزايدة الأول،
    // وهو سلوك صحيح لكنه يخلط على ما نقيسه هنا
    await markRead(second)
    const secondBefore = (await getNotifications(second)).items.length

    await placeBid({
      listingId: listing.id,
      bidderId: second,
      amountRiyals: halalasToRiyals(highestOf(listing).amount + listing.minimumIncrement),
      isCustomAmount: false,
      clientRequestId: 'b',
    })

    const outbid = await getNotifications(first)
    expect(outbid.items.some((n) => n.type === 'outbid')).toBe(true)
    expect(outbid.items[0].href).toBe(`/market/${listing.id}`)

    // المزايد الجديد لا يُنبَّه بتجاوز نفسه: لا إشعار جديد بعد مزايدته
    expect((await getNotifications(second)).items).toHaveLength(secondBefore)
  })

  it('البائع لا يُنبَّه بتجاوز في مزاده', async () => {
    const listing = listingBy((l) => l.saleType === 'auction' && l.status === 'active')
    await placeBid({
      listingId: listing.id,
      bidderId: pickBidder(listing),
      amountRiyals: halalasToRiyals(highestOf(listing).amount + listing.minimumIncrement),
      isCustomAmount: false,
      clientRequestId: 'c',
    })
    const seller = await getNotifications(listing.sellerId)
    expect(seller.items.some((n) => n.type === 'outbid')).toBe(false)
  })
})

describe('إشعارات نتيجة المزاد', () => {
  it('تُنبّه الفائز والخاسر والبائع كلًّا برسالته', async () => {
    const listing = listingBy((l) => l.saleType === 'auction' && l.status === 'active')
    await store.updateListing(listing.id, {
      reservePrice: 0,
      endsAt: new Date(Date.now() - 1000).toISOString(),
    })
    const bidders = [
      ...new Set(
        db.bids.filter((b) => b.listingId === listing.id && b.status === 'accepted').map((b) => b.bidderId),
      ),
    ]
    expect(bidders.length).toBeGreaterThan(1)

    await finalizeDueAuctions(store)
    const winner = (await store.getListing(listing.id))!.soldToUserId!

    expect((await getNotifications(winner)).items.some((n) => n.type === 'auction_won')).toBe(true)
    for (const loser of bidders.filter((id) => id !== winner)) {
      expect((await getNotifications(loser)).items.some((n) => n.type === 'auction_lost')).toBe(true)
    }
    expect(
      (await getNotifications(listing.sellerId)).items.some((n) => n.type === 'listing_sold'),
    ).toBe(true)
  })

  it('تُنبّه البائع عند عدم بلوغ السعر الاحتياطي', async () => {
    const listing = listingBy((l) => l.saleType === 'auction' && l.status === 'active')
    await store.updateListing(listing.id, {
      reservePrice: highestOf(listing).amount * 10,
      endsAt: new Date(Date.now() - 1000).toISOString(),
    })
    await finalizeDueAuctions(store)

    const seller = await getNotifications(listing.sellerId)
    expect(seller.items.some((n) => n.type === 'reserve_not_met')).toBe(true)
  })
})

describe('إشعارات العروض', () => {
  it('تُنبّه البائع بعرض جديد، وتُنبّه صاحبه بأنّه أُرسل', async () => {
    const listing = listingBy((l) => l.saleType === 'offers' && l.status === 'active')
    const buyer = db.users.find((u) => u.id !== listing.sellerId)!.id

    await placeOffer({
      listingId: listing.id,
      buyerId: buyer,
      amountRiyals: halalasToRiyals(listing.minimumOffer) + 1_000,
    })

    expect(
      (await getNotifications(listing.sellerId)).items.some((n) => n.type === 'offer_received'),
    ).toBe(true)

    /*
     * والمرسِل يُشعَر بما أرسل.
     *
     * إشعارٌ بفعلِ صاحبه يبدو زائدًا حتى يُنتظر الردّ: العرض يُرسل ثمّ يُغلق
     * اللسان، ولا يبقى منه أثرٌ إلّا في صفحةٍ يُبحث عنها.
     */
    const sent = (await getNotifications(buyer)).items.find((n) => n.type === 'offer_sent')
    expect(sent, 'لا إشعار لمن أرسل عرضه').toBeTruthy()
    expect(sent!.href).toBe('/account/offers')
  })

  it('قبولُ عرضٍ يُشعر صاحبه، ويُشعر من سقط عرضه بسببه', async () => {
    const listing = listingBy((l) => l.saleType === 'offers' && l.status === 'active')
    const [winner, loser] = db.users.filter((u) => u.id !== listing.sellerId).map((u) => u.id)
    const floor = halalasToRiyals(listing.minimumOffer)

    await placeOffer({ listingId: listing.id, buyerId: loser, amountRiyals: floor + 500 })
    const offer = await placeOffer({
      listingId: listing.id,
      buyerId: winner,
      amountRiyals: floor + 1_000,
    })

    const accept = await respondToOffer({
      offerId: offer.id,
      sellerId: listing.sellerId,
      decision: 'accept',
    })

    const accepted = (await getNotifications(winner)).items.find((n) => n.type === 'offer_accepted')
    expect(accepted, 'لا إشعار لمن قُبل عرضه').toBeTruthy()
    expect(accepted!.href).toBe('/account/purchases')

    /*
     * ومن سقط عرضه يُشعَر — عند السداد لا عند القبول.
     *
     * القبول وعدٌ لا يضمنه مال (السوم بلا عربون)، فتبقى اللوحة معروضة ويبقى
     * سومُ غيره قائمًا حتى يصل المال. فإذا وصل أُغلقت وسقط الباقي، ويُقال
     * لأصحابه — وكان يسقط في صمت.
     */
    expect(
      (await getNotifications(loser)).items.some((n) => n.type === 'offer_declined'),
      'أُسقط عرضه قبل أن يصل مالُ أحد',
    ).toBe(false)

    expect(
      (await store.getListing(offer.listingId))?.status,
      'أُغلقت اللوحة بوعدٍ لا بمال',
    ).toBe('active')

    // يصل المال فتُغلق اللوحة ويسقط الباقي بإشعاره
    await captureOrderEscrow(store, accept.order!, null)

    const declined = (await getNotifications(loser)).items.find((n) => n.type === 'offer_declined')
    expect(declined, 'سقط عرضه في صمت').toBeTruthy()
    expect((await store.getListing(offer.listingId))?.status).toBe('sold')
  })
})
