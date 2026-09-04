import { beforeEach, describe, expect, it } from 'vitest'
import { emptyDatabase, MemoryStore, type MemoryDatabase } from '@/lib/store/memory-store'
import { seedDatabase } from '@/lib/store/seed'
import { resetStoreForTests } from '@/lib/store'
import { completeOrderForTest } from '../support/settle'
import { resetRateLimits } from '@/lib/server/rate-limit'
import { finalizeDueAuctions, placeBid } from '@/lib/server/market-service'
import { adjustBalance, forfeitDeposit, getWalletView, refundDeposit } from '@/lib/server/wallet-service'
import { availableBalance, type Listing } from '@/lib/domain/types'
import { halalasToRiyals, riyalsToHalalas } from '@/lib/domain/money'

let db: MemoryDatabase
let store: MemoryStore

const adminId = () => db.admins[0].id
const listingBy = (predicate: (l: Listing) => boolean) => db.listings.find(predicate)!

/** مزايد ليس البائع ولا صاحب أعلى مزايدة حالية. */
function pickBidder(listing: Listing): string {
  const highest = db.bids
    .filter((b) => b.listingId === listing.id && b.status === 'accepted')
    .sort((a, b) => b.serverSequence - a.serverSequence)[0]
  return db.users.find((u) => u.id !== listing.sellerId && u.id !== highest?.bidderId)!.id
}

/**
 * يُفرغ عرابين مزايد على إعلان بعينه، **ويُنقص المحجوز بقدرها فقط**.
 *
 * تصفير `held` كان يترك محفظة مخالفة لواقع عرابين المستخدم على إعلانات أخرى،
 * فإذا فُكّ أحدها لاحقًا هبط المحجوز تحت الصفر ورُفض الفكّ بـ`DEPOSIT_NOT_HELD`.
 */
function clearDepositsOn(listing: Listing, userId: string) {
  const mine = db.deposits.filter(
    (d) => d.listingId === listing.id && d.userId === userId && d.status === 'held',
  )
  db.deposits = db.deposits.filter((d) => !(d.listingId === listing.id && d.userId === userId))
  const wallet = db.wallets.get(userId)!
  wallet.held = Math.max(0, wallet.held - mine.reduce((sum, d) => sum + d.amount, 0))
  return wallet
}

beforeEach(() => {
  db = emptyDatabase()
  seedDatabase(db)
  store = new MemoryStore(db)
  resetStoreForTests(store)
  resetRateLimits()
})

describe('حجز العربون عند المزايدة', () => {
  it('يحجز العربون تلقائيًا عند أول مزايدة ويظهر في كشف الحساب', async () => {
    const listing = listingBy((l) => l.saleType === 'auction' && l.depositAmount > 0 && l.status === 'active')
    const bidderId = pickBidder(listing)
    // نُفرغ عرابينه السابقة على هذا الإعلان حتى نختبر الحجز الأول فعلًا
    clearDepositsOn(listing, bidderId)

    const walletBefore = await store.getWallet(bidderId)
    const before = availableBalance(walletBefore)
    const highest = db.bids
      .filter((b) => b.listingId === listing.id)
      .sort((a, b) => b.amount - a.amount)[0]
    const amount = halalasToRiyals((highest?.amount ?? listing.startingPrice) + listing.minimumIncrement)

    await placeBid({
      listingId: listing.id,
      bidderId,
      amountRiyals: amount,
      isCustomAmount: false,
      clientRequestId: 'test-hold-1',
    })

    const after = await store.getWallet(bidderId)
    // الفارق لا المطلق: قد يحمل المزايد عرابين على إعلانات أخرى
    expect(after.held - walletBefore.held).toBe(listing.depositAmount)
    expect(availableBalance(after)).toBe(before - listing.depositAmount)

    const deposits = await store.listDeposits({ listingId: listing.id, userId: bidderId })
    expect(deposits[0].status).toBe('held')

    const view = await getWalletView(bidderId)
    expect(view.statement.lines.some((line) => line.type === 'deposit_hold')).toBe(true)
  })

  it('يرفض المزايدة إذا لم يكفِ الرصيد المتاح للعربون', async () => {
    const listing = listingBy((l) => l.saleType === 'auction' && l.depositAmount > 0 && l.status === 'active')
    const bidderId = pickBidder(listing)
    const wallet = clearDepositsOn(listing, bidderId)
    // نستنزف الرصيد حتى يقلّ عن العربون
    wallet.balance = wallet.held + listing.depositAmount - 1
    // البذرة قد تحوي مزايدة سابقة لهذا المستخدم، فنقارن العدد لا الوجود
    const bidsBefore = db.bids.filter(
      (b) => b.bidderId === bidderId && b.listingId === listing.id,
    ).length

    const standing = db.bids
      .filter((b) => b.listingId === listing.id && b.status === 'accepted')
      .sort((a, b) => b.amount - a.amount)[0]
    const validAmount = (standing?.amount ?? listing.startingPrice) + listing.minimumIncrement

    await expect(
      placeBid({
        listingId: listing.id,
        bidderId,
        // مبلغ صحيح عمدًا: نختبر رفض العربون لا رفض المبلغ
        amountRiyals: halalasToRiyals(validAmount),
        isCustomAmount: false,
        clientRequestId: 'test-blocked-1',
      }),
    ).rejects.toMatchObject({ code: 'DEPOSIT_REQUIRED' })

    // ولا تُسجَّل مزايدة جديدة ولا يبقى عربون معلّق بلا مقابل
    expect(
      db.bids.filter((b) => b.bidderId === bidderId && b.listingId === listing.id).length,
    ).toBe(bidsBefore)
    expect(db.deposits.some((d) => d.userId === bidderId && d.listingId === listing.id)).toBe(false)
  })

  it('لا يحجز عربونًا ثانيًا عند المزايدة مرة أخرى على المزاد نفسه', async () => {
    const listing = listingBy((l) => l.saleType === 'auction' && l.depositAmount > 0 && l.status === 'active')
    const bidderId = pickBidder(listing)
    const heldBefore = clearDepositsOn(listing, bidderId).held

    const highestOf = () =>
      db.bids
        .filter((b) => b.listingId === listing.id && b.status === 'accepted')
        .sort((a, b) => b.amount - a.amount)[0]

    await placeBid({
      listingId: listing.id,
      bidderId,
      amountRiyals: halalasToRiyals(highestOf().amount + listing.minimumIncrement),
      isCustomAmount: false,
      clientRequestId: 'first',
    })
    // مزايد آخر يتجاوزه ثم يعود الأول
    const other = db.users.find((u) => u.id !== bidderId && u.id !== listing.sellerId)!.id
    await placeBid({
      listingId: listing.id,
      bidderId: other,
      amountRiyals: halalasToRiyals(highestOf().amount + listing.minimumIncrement),
      isCustomAmount: false,
      clientRequestId: 'other',
    })
    await placeBid({
      listingId: listing.id,
      bidderId,
      amountRiyals: halalasToRiyals(highestOf().amount + listing.minimumIncrement),
      isCustomAmount: false,
      clientRequestId: 'second',
    })

    const deposits = await store.listDeposits({ listingId: listing.id, userId: bidderId })
    expect(deposits).toHaveLength(1)
    // حُجز مرّة واحدة مهما تكرّرت مزايداته
    expect((await store.getWallet(bidderId)).held - heldBefore).toBe(listing.depositAmount)
  })
})

describe('تسوية العرابين عند انتهاء المزاد', () => {
  it('يفكّ عرابين الخاسرين ويُبقي عربون الفائز محجوزًا', async () => {
    const listing = listingBy((l) => l.saleType === 'auction' && l.depositAmount > 0 && l.status === 'active')
    // نُنهي المزاد فورًا
    await store.updateListing(listing.id, { endsAt: new Date(Date.now() - 1000).toISOString() })

    const held = await store.listDeposits({ listingId: listing.id, status: ['held'] })
    expect(held.length).toBeGreaterThan(1)

    await finalizeDueAuctions(store)

    const updated = await store.getListing(listing.id)
    const winnerId = updated!.soldToUserId
    const after = await store.listDeposits({ listingId: listing.id })

    for (const deposit of after) {
      if (deposit.userId === winnerId) expect(deposit.status).toBe('held')
      else expect(deposit.status).toBe('released')
    }
    // المحجوز عند الخاسر نقص بمقدار عربون هذا المزاد بالضبط.
    // لا نتحقّق من صفريّته: قد يكون له عربون محجوز على مزاد آخر ما زال جاريًا.
    const loser = after.find((d) => d.userId !== winnerId)!
    const stillHeld = (await store.listDeposits({ userId: loser.userId, status: ['held'] }))
      .filter((d) => d.listingId === listing.id)
    expect(stillHeld).toHaveLength(0)
  })

  it('ينشئ للفائز صفقة بمهلة سداد مرتبطة بعربونه', async () => {
    const listing = listingBy((l) => l.saleType === 'auction' && l.depositAmount > 0 && l.status === 'active')
    await store.updateListing(listing.id, {
      reservePrice: 0,
      endsAt: new Date(Date.now() - 1000).toISOString(),
    })
    await finalizeDueAuctions(store)

    const order = (await store.listOrders({ listingId: listing.id }))[0]
    expect(order.paymentDueAt).toBeTruthy()
    expect(order.depositId).toBeTruthy()

    const deposit = await store.getDeposit(order.depositId!)
    expect(deposit!.userId).toBe(order.buyerId)
  })
})

describe('قرارات الإدارة على العربون', () => {
  async function endedAuction() {
    const listing = listingBy((l) => l.saleType === 'auction' && l.depositAmount > 0 && l.status === 'active')
    // بيانات البذرة لا تبلغ السعر الاحتياطي، فينتهي المزاد بلا بيع ولا صفقة.
    // نُسقط الاحتياطي حتى ترسو اللوحة ويُنشأ الطلب المرتبط بالعربون.
    await store.updateListing(listing.id, {
      reservePrice: 0,
      endsAt: new Date(Date.now() - 1000).toISOString(),
    })
    await finalizeDueAuctions(store)
    const order = (await store.listOrders({ listingId: listing.id }))[0]
    return { listing, order, deposit: (await store.getDeposit(order.depositId!))! }
  }

  /** يُقدّم مهلة سداد صفقة إلى الماضي — المصادرة لا تجوز قبل انقضائها. */
  function expirePaymentWindow(orderId: string) {
    db.orders.find((row) => row.id === orderId)!.paymentDueAt = new Date(
      Date.now() - 60_000,
    ).toISOString()
  }

  it('المصادرة تخصم المبلغ وتعلّم الصفقة متخلّفة', async () => {
    const { order, deposit } = await endedAuction()
    expirePaymentWindow(order.id)
    const before = await store.getWallet(deposit.userId)

    await forfeitDeposit({ depositId: deposit.id, adminId: adminId(), reason: 'لم يسدّد' })

    const after = await store.getWallet(deposit.userId)
    expect(after.balance).toBe(before.balance - deposit.amount)
    expect(after.held).toBe(before.held - deposit.amount)

    expect((await store.getDeposit(deposit.id))!.status).toBe('forfeited')
    expect((await store.getOrder(order.id))!.status).toBe('defaulted')

    const view = await getWalletView(deposit.userId)
    const line = view.statement.lines.find((l) => l.type === 'deposit_forfeit')
    expect(line?.direction).toBe('debit')
    expect(line?.note).toBe('لم يسدّد')
  })

  it('لا تجوز المصادرة ومهلة السداد قائمة — والخادم هو من يمنع', async () => {
    const { deposit } = await endedAuction()
    await expect(
      forfeitDeposit({ depositId: deposit.id, adminId: adminId(), reason: 'مبكّرة' }),
    ).rejects.toMatchObject({ code: 'FORFEIT_TOO_EARLY' })
    expect((await store.getDeposit(deposit.id))!.status).toBe('held')
  })

  it('لا يُصادَر عربون مزايد لم ترسُ عليه اللوحة', async () => {
    const listing = listingBy(
      (l) => l.saleType === 'auction' && l.depositAmount > 0 && l.status === 'active',
    )
    const [deposit] = await store.listDeposits({ listingId: listing.id, status: ['held'] })
    await expect(
      forfeitDeposit({ depositId: deposit.id, adminId: adminId(), reason: 'بلا صفقة' }),
    ).rejects.toMatchObject({ code: 'NO_ORDER_FOR_DEPOSIT' })
  })

  it('لا يُردّ عربون مزايد مزايدته قائمة في مزاد جارٍ', async () => {
    const listing = listingBy(
      (l) => l.saleType === 'auction' && l.depositAmount > 0 && l.status === 'active',
    )
    const [deposit] = await store.listDeposits({ listingId: listing.id, status: ['held'] })
    await expect(
      refundDeposit({ depositId: deposit.id, adminId: adminId(), reason: 'طلب المستخدم' }),
    ).rejects.toMatchObject({ code: 'BIDS_STILL_STANDING' })
  })

  it('الردّ يعيد المبلغ إلى المتاح بلا خصم', async () => {
    const { deposit } = await endedAuction()
    const before = await store.getWallet(deposit.userId)

    await refundDeposit({ depositId: deposit.id, adminId: adminId(), reason: 'اتفاق ودّي' })

    const after = await store.getWallet(deposit.userId)
    expect(after.balance).toBe(before.balance)
    expect(availableBalance(after)).toBe(availableBalance(before) + deposit.amount)
    expect((await store.getDeposit(deposit.id))!.status).toBe('released')
  })

  it('لا يُصادَر العربون مرتين', async () => {
    const { order, deposit } = await endedAuction()
    expirePaymentWindow(order.id)
    await forfeitDeposit({ depositId: deposit.id, adminId: adminId(), reason: 'أولى' })
    await expect(
      forfeitDeposit({ depositId: deposit.id, adminId: adminId(), reason: 'ثانية' }),
    ).rejects.toMatchObject({ code: 'DEPOSIT_RESOLVED' })
  })

  it('إتمام الصفقة يخصم العربون من قيمتها', async () => {
    const { order, deposit } = await endedAuction()
    const before = await store.getWallet(deposit.userId)

    await completeOrderForTest(store, order, adminId())

    const after = await store.getWallet(deposit.userId)
    expect(after.balance).toBe(before.balance - deposit.amount)
    expect(after.held).toBe(0)
    expect((await store.getDeposit(deposit.id))!.status).toBe('applied')
    expect((await store.getOrder(order.id))!.status).toBe('completed')
  })
})

describe('حركات الإدارة على المحفظة', () => {
  it('الشحن يزيد الرصيد ويُنسب إلى الأدمن في القيد', async () => {
    const userId = db.users[0].id
    const before = await store.getWallet(userId)

    await adjustBalance({
      userId,
      amount: riyalsToHalalas(7_500),
      type: 'topup',
      note: 'تحويل بنكي',
      adminId: adminId(),
    })

    const after = await store.getWallet(userId)
    expect(after.balance).toBe(before.balance + riyalsToHalalas(7_500))

    const entries = await store.listLedger({ userId })
    expect(entries[0].actorAdminId).toBe(adminId())
    expect(entries[0].note).toBe('تحويل بنكي')
  })

  it('لا يسحب الأدمن مبلغًا يتجاوز الرصيد المتاح', async () => {
    const userId = db.users[0].id
    const wallet = await store.getWallet(userId)
    await expect(
      adjustBalance({
        userId,
        amount: wallet.balance + riyalsToHalalas(1),
        type: 'withdrawal',
        note: null,
        adminId: adminId(),
      }),
    ).rejects.toMatchObject({ status: 409 })
  })

  it('يرفض حركة على مستخدم غير موجود', async () => {
    await expect(
      adjustBalance({
        userId: 'usr_missing',
        amount: riyalsToHalalas(100),
        type: 'topup',
        note: null,
        adminId: adminId(),
      }),
    ).rejects.toMatchObject({ code: 'USER_NOT_FOUND' })
  })
})
