import { beforeEach, describe, expect, it } from 'vitest'
import { emptyDatabase, MemoryStore, type MemoryDatabase } from '@/lib/store/memory-store'
import { seedDatabase } from '@/lib/store/seed'
import { resetStoreForTests } from '@/lib/store'
import { resetRateLimits } from '@/lib/server/rate-limit'
import { getNotifications, markRead, notify } from '@/lib/server/notification-service'
import { finalizeDueAuctions, placeBid, placeOffer, respondToOffer } from '@/lib/server/market-service'
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
  it('تُنبّه البائع بعرض جديد والمشتري بقراره', async () => {
    const listing = listingBy((l) => l.saleType === 'offers' && l.status === 'active')
    const buyer = db.users.find((u) => u.id !== listing.sellerId)!.id

    const offer = await placeOffer({
      listingId: listing.id,
      buyerId: buyer,
      amountRiyals: halalasToRiyals(listing.minimumOffer) + 1_000,
    })
    expect(
      (await getNotifications(listing.sellerId)).items.some((n) => n.type === 'offer_received'),
    ).toBe(true)

    await respondToOffer({ offerId: offer.id, sellerId: listing.sellerId, decision: 'accept' })
    const buyerNotifications = await getNotifications(buyer)
    expect(buyerNotifications.items.some((n) => n.type === 'offer_accepted')).toBe(true)
    expect(buyerNotifications.items[0].href).toBe('/account/purchases')
  })
})
