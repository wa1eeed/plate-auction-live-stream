import { beforeEach, describe, expect, it } from 'vitest'
import { emptyDatabase, MemoryStore, type MemoryDatabase } from '@/lib/store/memory-store'
import { seedDatabase } from '@/lib/store/seed'
import { resetStoreForTests } from '@/lib/store'
import { getListingDetail, getMarketListings } from '@/lib/server/market-service'

/**
 * **المتابعة** — الجرسُ في صفحة اللوحة وصفوف السوق وكروت الرئيسية.
 *
 * ولم تكن في المخطَّط أصلًا: `following` صفرٌ دائمًا، وتابُ «أتابعها» فارغٌ
 * أبدًا، والجرسُ يُضغط فلا يقع شيء.
 */
describe('المتابعة', () => {
  let db: MemoryDatabase
  let store: MemoryStore

  beforeEach(() => {
    db = emptyDatabase()
    seedDatabase(db)
    store = new MemoryStore(db)
    resetStoreForTests(store)
  })

  const pick = async () => {
    const listing = (await store.listListings({ status: ['active'] }))[0]
    const viewer = db.users.find((u) => u.id !== listing.sellerId)!
    return { listing, viewer }
  }

  it('تُكتب وتُقرأ في بطاقة السوق', async () => {
    const { listing, viewer } = await pick()

    const before = await getMarketListings(undefined, viewer.id)
    expect(before.find((c) => c.id === listing.id)?.iFollow).toBe(false)

    await store.setWatch(viewer.id, listing.id, true)

    const after = await getMarketListings(undefined, viewer.id)
    expect(after.find((c) => c.id === listing.id)?.iFollow).toBe(true)
    /* ولا تُسرَّب إلى غيره */
    const other = await getMarketListings(undefined, listing.sellerId)
    expect(other.find((c) => c.id === listing.id)?.iFollow).toBe(false)
  })

  /** **والمفتاحُ مركَّبٌ** — فضغطتان متسارعتان لا تُنشئان صفّين. */
  it('المتابعةُ مرّتين صفٌّ واحد', async () => {
    const { listing, viewer } = await pick()

    await store.setWatch(viewer.id, listing.id, true)
    await store.setWatch(viewer.id, listing.id, true)

    expect(await store.countWatchers(listing.id)).toBe(1)
    expect(await store.listWatchedListingIds(viewer.id)).toEqual([listing.id])
  })

  it('وتركُ ما لم يُتابَع لا يُخطئ', async () => {
    const { listing, viewer } = await pick()
    await store.setWatch(viewer.id, listing.id, false)
    expect(await store.countWatchers(listing.id)).toBe(0)
  })

  /**
   * **وعددُ المتابعين لصاحب الإعلان وحده.**
   *
   * فعرضُه للزائر يُغري بالتسابق على ما يُظَنّ مطلوبًا، ويكشف عن سلوك
   * الآخرين ما لا شأنَ له به.
   */
  it('العددُ لصاحبه، و`null` لغيره', async () => {
    const { listing, viewer } = await pick()
    await store.setWatch(viewer.id, listing.id, true)

    const asSeller = await getListingDetail(listing.id, listing.sellerId)
    expect(asSeller?.watcherCount).toBe(1)
    expect(asSeller?.iFollow).toBe(false)

    const asViewer = await getListingDetail(listing.id, viewer.id)
    expect(asViewer?.watcherCount).toBeNull()
    expect(asViewer?.iFollow).toBe(true)

    const asGuest = await getListingDetail(listing.id, null)
    expect(asGuest?.watcherCount).toBeNull()
    expect(asGuest?.iFollow).toBe(false)
  })
})
