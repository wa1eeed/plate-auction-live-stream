import { beforeEach, describe, expect, it } from 'vitest'
import { emptyDatabase, MemoryStore, type MemoryDatabase } from '@/lib/store/memory-store'
import { seedDatabase } from '@/lib/store/seed'
import { resetStoreForTests } from '@/lib/store'
import { canSellerRelist, isClosedListing, type Listing } from '@/lib/domain/types'
import { closeListing, relistListing } from '@/lib/server/market-service'
import { reinstateListingByAdmin, suspendListingByAdmin } from '@/lib/server/admin-service'

let db: MemoryDatabase
let store: MemoryStore

const adminId = () => db.admins[0].id
const auctionWithBids = () =>
  db.listings.find(
    (l) => l.saleType === 'auction' && l.status === 'active' && l.depositAmount > 0,
  )! as Listing

beforeEach(() => {
  db = emptyDatabase()
  seedDatabase(db)
  store = new MemoryStore(db)
  resetStoreForTests(store)
})

describe('الإغلاق يفكّ العرابين', () => {
  it('إلغاء البائع يعيد كل عربون محجوز فورًا', async () => {
    const listing = auctionWithBids()
    const held = await store.listDeposits({ listingId: listing.id, status: ['held'] })
    expect(held.length).toBeGreaterThan(0)

    await closeListing(store, listing.id, 'cancelled', 'ألغى البائع')

    // لا ضمان يبقى محجوزًا لمزاد لم يعد قائمًا
    expect(await store.listDeposits({ listingId: listing.id, status: ['held'] })).toHaveLength(0)
    for (const deposit of await store.listDeposits({ listingId: listing.id })) {
      expect(deposit.status).toBe('released')
    }
  })

  it('إيقاف الإدارة يفكّها كذلك ويُشعر البائع', async () => {
    const listing = auctionWithBids()
    await suspendListingByAdmin(listing.id, adminId(), 'صور مخالفة')

    expect((await store.getListing(listing.id))!.status).toBe('suspended')
    expect(await store.listDeposits({ listingId: listing.id, status: ['held'] })).toHaveLength(0)

    const seller = await store.listNotifications(listing.sellerId)
    expect(seller.some((n) => n.type === 'listing_suspended')).toBe(true)
  })

  it('المزايدات تبقى سجلًّا للجولة المُغلقة لا تُمحى', async () => {
    const listing = auctionWithBids()
    const before = (await store.listBids(listing.id)).filter((b) => b.status === 'accepted').length
    await closeListing(store, listing.id, 'cancelled', 'ألغى البائع')

    const after = (await store.listBids(listing.id)).filter((b) => b.status === 'accepted')
    expect(after).toHaveLength(before)
  })
})

describe('الفصل بين إلغاء البائع وإيقاف الإدارة', () => {
  it('البائع يعيد عرض ما ألغاه، ولا يعيد ما أوقفته الإدارة', () => {
    expect(canSellerRelist('cancelled')).toBe(true)
    expect(canSellerRelist('no_bids')).toBe(true)
    expect(canSellerRelist('reserve_not_met')).toBe(true)
    // قرار ضدّه لا يُنقض بيده، وصفقة تمّت لا تُعاد
    expect(canSellerRelist('suspended')).toBe(false)
    expect(canSellerRelist('sold')).toBe(false)
    // ولا يُعاد عرض ما هو معروض
    expect(canSellerRelist('active')).toBe(false)
    expect(canSellerRelist('draft')).toBe(false)
  })

  it('الموقوف حالة مغلقة فلا يظهر في السوق', () => {
    expect(isClosedListing('suspended')).toBe(true)
  })

  it('لا يُوقَف الموقوف مرّتين، ولا يُرفع الإيقاف عمّا ليس موقوفًا', async () => {
    const listing = auctionWithBids()
    await suspendListingByAdmin(listing.id, adminId(), 'مخالفة')
    await expect(
      suspendListingByAdmin(listing.id, adminId(), 'مرّة أخرى'),
    ).rejects.toMatchObject({ code: 'ALREADY_SUSPENDED' })

    const other = db.listings.find((l) => l.status === 'active' && l.id !== listing.id)!
    await expect(
      reinstateListingByAdmin(other.id, adminId(), 'بلا سبب'),
    ).rejects.toMatchObject({ code: 'NOT_SUSPENDED' })
  })
})

describe('إعادة العرض جولة جديدة لا استئناف', () => {
  it('تُلغي مزايدات الجولة السابقة وتُبقيها في الكشف موسومة', async () => {
    const listing = auctionWithBids()
    const standing = (await store.listBids(listing.id)).filter((b) => b.status === 'accepted')
    expect(standing.length).toBeGreaterThan(0)

    await closeListing(store, listing.id, 'cancelled', 'ألغى البائع')
    await relistListing(store, (await store.getListing(listing.id))!)

    const bids = await store.listBids(listing.id)
    // لا تُحذف: عددها كما هو، وكلّها ملغاة بسبب مذكور
    expect(bids).toHaveLength(standing.length)
    for (const bid of bids) {
      expect(bid.status).toBe('cancelled')
      expect(bid.cancellationReason).toMatch(/جولة جديدة/)
    }
  })

  it('تُصفّر مؤشّرات الجولة فيعود السعر إلى الافتتاحي', async () => {
    const listing = auctionWithBids()
    await closeListing(store, listing.id, 'cancelled', 'ألغى البائع')
    const { listing: relisted } = await relistListing(store, (await store.getListing(listing.id))!)

    expect(relisted.status).toBe('draft')
    expect(relisted.highestBidId).toBeNull()
    expect(relisted.soldToUserId).toBeNull()
    expect(relisted.soldAmount).toBe(0)
    expect(relisted.endsAt).toBeNull()
    expect(relisted.endedAt).toBeNull()
  })

  it('تدعو مزايدي الجولة السابقة مرّة لكل مزايد لا لكل مزايدة', async () => {
    const listing = auctionWithBids()
    const bidders = new Set(
      (await store.listBids(listing.id))
        .filter((b) => b.status === 'accepted')
        .map((b) => b.bidderId),
    )

    await closeListing(store, listing.id, 'cancelled', 'ألغى البائع')
    const { invited } = await relistListing(store, (await store.getListing(listing.id))!)
    expect(invited).toBe(bidders.size)

    for (const userId of bidders) {
      const items = await store.listNotifications(userId)
      const invites = items.filter((n) => n.type === 'listing_relisted')
      expect(invites).toHaveLength(1)
      // دعوة لا إلزام: تحمل رابط اللوحة ليعود من شاء
      expect(invites[0].href).toBe(`/market/${listing.id}`)
    }
  })

  it('رفع الإيقاف يعيدها مسودّة ويُشعر البائع', async () => {
    const listing = auctionWithBids()
    await suspendListingByAdmin(listing.id, adminId(), 'مخالفة')
    const reinstated = await reinstateListingByAdmin(listing.id, adminId(), 'صُحّحت')

    // مسودّة لا معروضة: الإدارة ترفع المنع ولا تنشر نيابة عن البائع
    expect(reinstated.status).toBe('draft')
    const items = await store.listNotifications(listing.sellerId)
    expect(items.some((n) => n.type === 'listing_reinstated')).toBe(true)
  })

  it('كل إيقاف ورفع يُقيَّد في سجلّ التدقيق', async () => {
    const listing = auctionWithBids()
    await suspendListingByAdmin(listing.id, adminId(), 'مخالفة')
    await reinstateListingByAdmin(listing.id, adminId(), 'صُحّحت')

    const actions = (await store.listAudits(50))
      .filter((a) => a.entityId === listing.id)
      .map((a) => a.action)
    expect(actions).toContain('listing.suspend')
    expect(actions).toContain('listing.reinstate')
  })
})
