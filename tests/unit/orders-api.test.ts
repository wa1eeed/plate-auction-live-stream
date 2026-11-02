import { beforeEach, describe, expect, it } from 'vitest'
import { emptyDatabase, MemoryStore, type MemoryDatabase } from '@/lib/store/memory-store'
import { seedDatabase } from '@/lib/store/seed'
import { resetStoreForTests } from '@/lib/store'
import { getPurchases, getSales } from '@/lib/server/order-service'
import { startOrderPayment } from '@/lib/server/checkout-service'
import { buyNow } from '@/lib/server/market-service'

/**
 * **قائمةُ الصفقات — ما يحتاجه التطبيقُ الأصيل ولم يحتجه الويب.**
 *
 * فالويبُ يُصيّر «مشترياتي» و«مبيعاتي» على الخادم ويقرأ الخدمةَ مباشرةً،
 * والأصيلُ يرسم في الجهاز ويطلب بيانات. وهذه أوّلُ فجوةٍ كشفها الربط.
 */
describe('صفقاتُ المستخدم في ردٍّ واحد', () => {
  let db: MemoryDatabase
  let store: MemoryStore

  beforeEach(() => {
    /* و`seedDatabase` تأخذ القاعدةَ لا المستودع، وترتيبُها قبل إنشائه */
    db = emptyDatabase()
    seedDatabase(db)
    store = new MemoryStore(db)
    resetStoreForTests(store)
  })

  it('المشترياتُ والمبيعاتُ تُقرأ كلٌّ من جهتها', async () => {
    const listing = (await store.listListings({ status: ['active'] })).find(
      (l) => l.saleType === 'fixed',
    )!
    const buyerId = db.users.find((u) => u.id !== listing.sellerId)!.id

    const { order } = await buyNow({
      listingId: listing.id,
      buyerId,
      clientRequestId: 'buy-1',
    })

    const purchases = await getPurchases(buyerId)
    const sales = await getSales(listing.sellerId)

    expect(purchases.map((o) => o.id)).toContain(order.id)
    expect(sales.map((o) => o.id)).toContain(order.id)

    /* ولكلّ صفقةٍ لوحتُها واسمُ الطرف الآخر — فلا تُقرأ الشاشةُ بأرقام */
    const mine = purchases.find((o) => o.id === order.id)!
    expect(mine.plate).toBeTruthy()
    expect(mine.counterpartName).toBeTruthy()
    expect(mine.timeline.length).toBeGreaterThan(0)
  })

  /**
   * **ولا تُرى صفقةُ غيرك في قائمتك.**
   *
   * وهو ما يحرسه المسار: قائمةٌ تُرجع صفقاتِ من يطلبها وحده، لا من يُمرَّر
   * معرّفُه في الطلب.
   */
  it('ولا تظهر صفقةُ غيرك', async () => {
    const listing = (await store.listListings({ status: ['active'] })).find(
      (l) => l.saleType === 'fixed',
    )!
    const buyerId = db.users.find((u) => u.id !== listing.sellerId)!.id
    const stranger = db.users.find(
      (u) => u.id !== buyerId && u.id !== listing.sellerId,
    )!.id

    const { order } = await buyNow({
      listingId: listing.id,
      buyerId,
      clientRequestId: 'buy-1',
    })

    const theirs = await getPurchases(stranger)
    expect(theirs.map((o) => o.id)).not.toContain(order.id)
  })

  it('والمشترياتُ تحمل حالَ السداد', async () => {
    const listing = (await store.listListings({ status: ['active'] })).find(
      (l) => l.saleType === 'fixed',
    )!
    const buyerId = db.users.find((u) => u.id !== listing.sellerId)!.id
    const { order } = await buyNow({
      listingId: listing.id,
      buyerId,
      clientRequestId: 'buy-1',
    })

    const before = (await getPurchases(buyerId)).find((o) => o.id === order.id)!
    expect(before.status).toBe('awaiting_settlement')

    await store.updatePaymentSettings({
      tapEnabled: false,
      tapMode: 'test',
      bankTransferEnabled: true,
      bankName: 'مصرف الاختبار',
      bankAccountName: 'سوق اللوحات',
      bankIban: 'SA0380000000608010167519',
      bankAccountNumber: '',
      bankInstructions: '',
    })
    await startOrderPayment({
      orderId: order.id,
      userId: buyerId,
      method: 'bank_transfer',
    })

    const after = (await getPurchases(buyerId)).find((o) => o.id === order.id)!
    expect(after.settlement).toBeTruthy()
  })
})

/**
 * **فاتورةُ الصفقة لصاحبها وحده.**
 *
 * فالفاتورةُ تحمل مبلغَ الصفقة وعمولتَها واسمَ من صدرت له — وقراءتُها
 * برقم صفقةٍ وحده تُسرّب ذلك لمن يُخمّن الأرقام.
 */
describe('فاتورةُ الصفقة', () => {
  let db: MemoryDatabase
  let store: MemoryStore

  beforeEach(() => {
    db = emptyDatabase()
    seedDatabase(db)
    store = new MemoryStore(db)
    resetStoreForTests(store)
  })

  it('تُقرأ بمعرّف الصفقة وتُرشَّح بصاحبها', async () => {
    const listing = (await store.listListings({ status: ['active'] })).find(
      (l) => l.saleType === 'fixed',
    )!
    const buyerId = db.users.find((u) => u.id !== listing.sellerId)!.id
    const { order } = await buyNow({
      listingId: listing.id,
      buyerId,
      clientRequestId: 'inv-1',
    })

    /* ولكلّ طرفٍ فاتورتُه — فالترشيحُ بالمستخدم لا بالصفقة وحدها */
    const mine = await store.listInvoices({ orderId: order.id, userId: buyerId })
    const theirs = await store.listInvoices({
      orderId: order.id,
      userId: listing.sellerId,
    })

    for (const invoice of mine) expect(invoice.customerId).toBe(buyerId)
    for (const invoice of theirs) expect(invoice.customerId).toBe(listing.sellerId)
  })

  it('ولا تُقرأ فاتورةُ غيرك بترشيحٍ باسمك', async () => {
    const listing = (await store.listListings({ status: ['active'] })).find(
      (l) => l.saleType === 'fixed',
    )!
    const buyerId = db.users.find((u) => u.id !== listing.sellerId)!.id
    const stranger = db.users.find(
      (u) => u.id !== buyerId && u.id !== listing.sellerId,
    )!.id
    const { order } = await buyNow({
      listingId: listing.id,
      buyerId,
      clientRequestId: 'inv-2',
    })

    const theirs = await store.listInvoices({ orderId: order.id, userId: stranger })
    expect(theirs).toHaveLength(0)
  })
})
