import { beforeEach, describe, expect, it } from 'vitest'
import { emptyDatabase, MemoryStore, type MemoryDatabase } from '@/lib/store/memory-store'
import { seedDatabase } from '@/lib/store/seed'
import { resetStoreForTests } from '@/lib/store'
import { completeOrderForTest } from '../support/settle'
import { resetRateLimits } from '@/lib/server/rate-limit'
import { computeDeposit, DEFAULT_AUCTION_SETTINGS, type Listing } from '@/lib/domain/types'
import { riyalsToHalalas } from '@/lib/domain/money'
import { finalizeDueAuctions } from '@/lib/server/market-service'
import { getReawardContext, reawardOrder } from '@/lib/server/admin-service'
import { forfeitDeposit, undoForfeit } from '@/lib/server/wallet-service'
import { sendPaymentReminders } from '@/lib/server/order-service'

let db: MemoryDatabase
let store: MemoryStore

const adminId = () => db.admins[0].id
const listingBy = (predicate: (l: Listing) => boolean) => db.listings.find(predicate)!

beforeEach(() => {
  db = emptyDatabase()
  seedDatabase(db)
  store = new MemoryStore(db)
  resetStoreForTests(store)
  resetRateLimits()
})

describe('حساب العربون المركزي', () => {
  const settings = DEFAULT_AUCTION_SETTINGS

  it('النسبة تُحسب من السعر الافتتاحي', () => {
    expect(computeDeposit(settings, riyalsToHalalas(100_000))).toBe(riyalsToHalalas(5_000))
  })

  it('الحدّ الأدنى يحمي من عربون تافه', () => {
    // 5٪ من 1,000 = 50 ريالًا، والحدّ الأدنى 1,000
    expect(computeDeposit(settings, riyalsToHalalas(1_000))).toBe(settings.depositMin)
  })

  it('الحدّ الأقصى يمنع عربونًا يعطّل المزايدة', () => {
    expect(computeDeposit(settings, riyalsToHalalas(10_000_000))).toBe(settings.depositMax)
  })

  it('الوضع الثابت يتجاهل السعر', () => {
    const fixed = { ...settings, depositMode: 'fixed' as const, depositFixed: riyalsToHalalas(3_000) }
    expect(computeDeposit(fixed, riyalsToHalalas(10))).toBe(riyalsToHalalas(3_000))
    expect(computeDeposit(fixed, riyalsToHalalas(999_999))).toBe(riyalsToHalalas(3_000))
  })
})

describe('بقاء العرابين حتى اكتمال الصفقة', () => {
  async function endedAuction() {
    const listing = listingBy((l) => l.saleType === 'auction' && l.depositAmount > 0 && l.status === 'active')
    await store.updateListing(listing.id, {
      reservePrice: 0,
      endsAt: new Date(Date.now() - 1000).toISOString(),
    })
    await finalizeDueAuctions(store)
    const order = (await store.listOrders({ listingId: listing.id }))[0]
    return { listing, order }
  }

  it('عرابين الخاسرين تبقى محجوزة بعد رسوّ المزاد', async () => {
    const { listing, order } = await endedAuction()
    const held = await store.listDeposits({ listingId: listing.id, status: ['held'] })

    // الفائز وغيره: الجميع ما زال محجوزًا حتى يكتمل السداد
    expect(held.length).toBeGreaterThan(1)
    expect(held.some((d) => d.userId === order.buyerId)).toBe(true)
  })

  it('اكتمال الصفقة يفكّ عرابين الخاسرين ويخصم عربون الفائز', async () => {
    const { listing, order } = await endedAuction()
    await completeOrderForTest(store, order, adminId())

    const after = await store.listDeposits({ listingId: listing.id })
    for (const deposit of after) {
      if (deposit.userId === order.buyerId) expect(deposit.status).toBe('applied')
      else expect(deposit.status).toBe('released')
    }
  })

  it('انتهاء المزاد بلا بيع يفكّ الجميع فورًا', async () => {
    const listing = listingBy((l) => l.saleType === 'auction' && l.depositAmount > 0 && l.status === 'active')
    await store.updateListing(listing.id, {
      // احتياطي بعيد لا تبلغه المزايدات
      reservePrice: riyalsToHalalas(50_000_000),
      endsAt: new Date(Date.now() - 1000).toISOString(),
    })
    await finalizeDueAuctions(store)

    expect(await store.listDeposits({ listingId: listing.id, status: ['held'] })).toHaveLength(0)
  })
})

describe('إعادة الإرساء على المزايد التالي', () => {
  async function defaulted() {
    const listing = listingBy((l) => l.saleType === 'auction' && l.depositAmount > 0 && l.status === 'active')
    await store.updateListing(listing.id, {
      reservePrice: 0,
      endsAt: new Date(Date.now() - 1000).toISOString(),
    })
    await finalizeDueAuctions(store)
    const order = (await store.listOrders({ listingId: listing.id }))[0]
    // نُقدّم مهلة السداد إلى الماضي — لا مصادرة ولا إعادة إرساء قبل انقضائها
    db.orders.find((row) => row.id === order.id)!.paymentDueAt = new Date(
      Date.now() - 60_000,
    ).toISOString()
    return { listing, order: (await store.getOrder(order.id))! }
  }

  it('يسرد المزايدين التالين مرتّبين تنازليًا بحالة عربونهم', async () => {
    const { order } = await defaulted()
    const context = await getReawardContext(order.id)

    expect(context.candidates.length).toBeGreaterThan(0)
    expect(context.candidates.every((c) => c.userId !== order.buyerId)).toBe(true)
    // مرتّبة تنازليًا
    const amounts = context.candidates.map((c) => c.amount)
    expect([...amounts].sort((a, b) => b - a)).toEqual(amounts)
    // وعرابينهم ما زالت محجوزة — وهو ما يجعل إعادة الإرساء ممكنة أصلًا
    expect(context.candidates.some((c) => c.depositHeld)).toBe(true)
  })

  it('يصادر عربون المتخلّف ويُرسي على التالي بمهلة جديدة', async () => {
    const { listing, order } = await defaulted()
    const context = await getReawardContext(order.id)
    const next = context.candidates[0]
    const before = await store.getWallet(order.buyerId)

    const result = await reawardOrder({
      orderId: order.id,
      nextBidderId: next.userId,
      forfeitCurrentDeposit: true,
      reason: 'لم يسدّد خلال المهلة',
      adminId: adminId(),
    })

    // المتخلّف: صفقته متخلّفة وعربونه مُصادَر ورصيده نقص
    expect((await store.getOrder(order.id))!.status).toBe('defaulted')
    expect((await store.getDeposit(order.depositId!))!.status).toBe('forfeited')
    expect((await store.getWallet(order.buyerId)).balance).toBeLessThan(before.balance)

    // التالي: صفقة جديدة بمبلغ مزايدته ومهلة سداد جديدة
    expect(result.order.buyerId).toBe(next.userId)
    expect(result.order.amount).toBe(next.amount)
    expect(result.order.status).toBe('awaiting_settlement')
    expect(new Date(result.order.paymentDueAt!).getTime()).toBeGreaterThan(Date.now())

    // واللوحة رست عليه
    const updated = await store.getListing(listing.id)
    expect(updated!.soldToUserId).toBe(next.userId)
    expect(updated!.soldAmount).toBe(next.amount)
  })

  it('إعادة الإرساء بلا مصادرة تُعيد عربون المتخلّف لا تُبقيه محجوزًا', async () => {
    const { order } = await defaulted()
    const context = await getReawardContext(order.id)

    await reawardOrder({
      orderId: order.id,
      nextBidderId: context.candidates[0].userId,
      forfeitCurrentDeposit: false,
      reason: 'اتفاق ودّي',
      adminId: adminId(),
    })
    // خرج من المزاد فلم يعد عربونه يضمن شيئًا — وإبقاؤه محجوزًا تجميد بلا سبب
    expect((await store.getDeposit(order.depositId!))!.status).toBe('released')
  })

  it('يرفض إرساء على من ليس مزايدًا', async () => {
    const { order } = await defaulted()
    await expect(
      reawardOrder({
        orderId: order.id,
        nextBidderId: 'usr_stranger',
        forfeitCurrentDeposit: false,
        reason: 'اختبار',
        adminId: adminId(),
      }),
    ).rejects.toMatchObject({ code: 'NOT_A_BIDDER' })
  })

  it('يرفض إعادة إرساء صفقة مكتملة', async () => {
    const { order } = await defaulted()
    await completeOrderForTest(store, order, adminId())
    await expect(
      reawardOrder({
        orderId: order.id,
        nextBidderId: db.users[1].id,
        forfeitCurrentDeposit: false,
        reason: 'اختبار',
        adminId: adminId(),
      }),
    ).rejects.toMatchObject({ code: 'ORDER_COMPLETED' })
  })
})


describe('نسبة المصادرة والتراجع عنها', () => {
  async function defaultedDeposit(patch: Partial<{ forfeitPercent: number; forfeitUndoWindowHours: number }> = {}) {
    const listing = listingBy(
      (l) => l.saleType === 'auction' && l.depositAmount > 0 && l.status === 'active',
    )
    await store.updateListing(listing.id, {
      reservePrice: 0,
      endsAt: new Date(Date.now() - 1000).toISOString(),
      ...patch,
    })
    await finalizeDueAuctions(store)
    const order = (await store.listOrders({ listingId: listing.id }))[0]
    db.orders.find((row) => row.id === order.id)!.paymentDueAt = new Date(
      Date.now() - 60_000,
    ).toISOString()
    return { order, deposit: (await store.getDeposit(order.depositId!))! }
  }

  it('المصادرة الجزئية تخصم النسبة وتعيد الباقي', async () => {
    const { deposit } = await defaultedDeposit({ forfeitPercent: 40 })
    const before = await store.getWallet(deposit.userId)

    await forfeitDeposit({ depositId: deposit.id, adminId: adminId(), reason: 'تخلّف' })

    const expected = Math.round((deposit.amount * 40) / 100)
    const after = await store.getWallet(deposit.userId)
    expect(before.balance - after.balance).toBe(expected)
    // الحجز يُفكّ كاملًا: المُصادَر خرج، والباقي عاد متاحًا
    expect(before.held - after.held).toBe(deposit.amount)

    const updated = (await store.getDeposit(deposit.id))!
    expect(updated.status).toBe('forfeited')
    expect(updated.forfeitedAmount).toBe(expected)
  })

  it('نسبة صفر تعطّل المصادرة أصلًا', async () => {
    const { deposit } = await defaultedDeposit({ forfeitPercent: 0 })
    await expect(
      forfeitDeposit({ depositId: deposit.id, adminId: adminId(), reason: 'تخلّف' }),
    ).rejects.toMatchObject({ code: 'FORFEIT_DISABLED' })
  })

  it('كل مصادرة تُقيَّد في حساب المنصّة', async () => {
    const { deposit } = await defaultedDeposit({ forfeitPercent: 100 })
    await forfeitDeposit({ depositId: deposit.id, adminId: adminId(), reason: 'تخلّف' })

    const [entry] = await store.listPlatformEntries({ depositId: deposit.id })
    expect(entry.type).toBe('deposit_forfeit')
    expect(entry.amount).toBe(deposit.amount)
    expect(entry.settled).toBe(true)
  })

  it('التراجع يعيد المال ويُبطل قيد الإيراد ويُعيد الصفقة للانتظار', async () => {
    const { order, deposit } = await defaultedDeposit({ forfeitUndoWindowHours: 24 })
    const before = await store.getWallet(deposit.userId)
    await forfeitDeposit({ depositId: deposit.id, adminId: adminId(), reason: 'تخلّف' })

    await undoForfeit({ depositId: deposit.id, adminId: adminId(), reason: 'وصل عذر' })

    expect((await store.getWallet(deposit.userId)).balance).toBe(before.balance)
    expect((await store.getDeposit(deposit.id))!.status).toBe('released')
    expect((await store.getOrder(order.id))!.status).toBe('awaiting_settlement')

    const [entry] = await store.listPlatformEntries({ depositId: deposit.id })
    expect(entry.reversedAt).toBeTruthy()
    expect(entry.reversalReason).toBe('وصل عذر')
  })

  it('لا تراجع بعد انقضاء مهلته', async () => {
    const { deposit } = await defaultedDeposit({ forfeitUndoWindowHours: 0 })
    await forfeitDeposit({ depositId: deposit.id, adminId: adminId(), reason: 'تخلّف' })
    await expect(
      undoForfeit({ depositId: deposit.id, adminId: adminId(), reason: 'متأخّر' }),
    ).rejects.toMatchObject({ code: 'UNDO_WINDOW_CLOSED' })
  })
})

describe('تذكيرات مهلة السداد', () => {
  async function orderDueIn(ms: number) {
    const listing = listingBy(
      (l) => l.saleType === 'auction' && l.depositAmount > 0 && l.status === 'active',
    )
    await store.updateListing(listing.id, {
      reservePrice: 0,
      endsAt: new Date(Date.now() - 1000).toISOString(),
    })
    await finalizeDueAuctions(store)
    const order = (await store.listOrders({ listingId: listing.id }))[0]
    db.orders.find((row) => row.id === order.id)!.paymentDueAt = new Date(
      Date.now() + ms,
    ).toISOString()
    return (await store.getOrder(order.id))!
  }

  /*
   * مقصورة على إعلان الصفقة المختبَرة.
   *
   * البذرة تحمل صفقات أخرى متأخّرة عمدًا (لتجربة المصادرة)، فالمسح يُنبّه
   * أصحابها أيضًا — وعدُّ إشعارات المستخدم كلّها يخلط تنبيهًا بتنبيه.
   */
  const buyerNotices = async (userId: string, listingId: string) =>
    (await store.listNotifications(userId)).filter(
      (n) =>
        n.listingId === listingId &&
        (n.type === 'payment_due_soon' || n.type === 'payment_overdue'),
    )

  it('لا تذكير ما دامت المهلة بعيدة', async () => {
    const order = await orderDueIn(40 * 3_600_000)
    await sendPaymentReminders(store)
    expect(await buyerNotices(order.buyerId, order.listingId)).toHaveLength(0)
  })

  it('تذكير قبل ٢٤ ساعة، ولا يتكرّر مع كل مسح', async () => {
    const order = await orderDueIn(20 * 3_600_000)
    await sendPaymentReminders(store)
    await sendPaymentReminders(store)
    await sendPaymentReminders(store)

    const notices = await buyerNotices(order.buyerId, order.listingId)
    expect(notices).toHaveLength(1)
    expect(notices[0].type).toBe('payment_due_soon')
    expect((await store.getOrder(order.id))!.remindersSent).toEqual(['24h'])
  })

  it('انقضاء المهلة يُنبّه المشتري والبائع معًا', async () => {
    const order = await orderDueIn(-60_000)
    await sendPaymentReminders(store)

    expect(
      (await buyerNotices(order.buyerId, order.listingId)).some(
        (n) => n.type === 'payment_overdue',
      ),
    ).toBe(true)
    expect(
      (await buyerNotices(order.sellerId, order.listingId)).some(
        (n) => n.type === 'payment_overdue',
      ),
    ).toBe(true)
    expect((await store.getOrder(order.id))!.remindersSent).toContain('overdue')
  })
})

describe('إعادة الإرساء لا تقع مرّتين', () => {
  async function defaulted() {
    const listing = listingBy(
      (l) => l.saleType === 'auction' && l.depositAmount > 0 && l.status === 'active',
    )
    await store.updateListing(listing.id, {
      reservePrice: 0,
      endsAt: new Date(Date.now() - 1000).toISOString(),
    })
    await finalizeDueAuctions(store)
    const order = (await store.listOrders({ listingId: listing.id }))[0]
    // المهلة إلى الماضي — لا مصادرة ولا إعادة إرساء قبل انقضائها
    db.orders.find((row) => row.id === order.id)!.paymentDueAt = new Date(
      Date.now() - 60_000,
    ).toISOString()
    return (await store.getOrder(order.id))!
  }

  it('النداء الثاني على الصفقة نفسها يُرفض ولا يُنشئ صفقة مكرّرة', async () => {
    const order = await defaulted()
    const context = await getReawardContext(order.id)
    const next = context.candidates[0]

    await reawardOrder({
      orderId: order.id,
      nextBidderId: next.userId,
      forfeitCurrentDeposit: true,
      reason: 'تخلّف',
      adminId: adminId(),
    })
    const afterFirst = (await store.listOrders({ listingId: order.listingId })).length

    // ضغطة ثانية — كانت تُنشئ صفقتين متطابقتين لا يُعرف أيّهما الحقيقية
    await expect(
      reawardOrder({
        orderId: order.id,
        nextBidderId: next.userId,
        forfeitCurrentDeposit: true,
        reason: 'تخلّف',
        adminId: adminId(),
      }),
    ).rejects.toMatchObject({ code: 'ALREADY_REAWARDED' })

    expect((await store.listOrders({ listingId: order.listingId })).length).toBe(afterFirst)
  })

  it('تُعيد مبلغ ما صودر فعلًا فتقدر الواجهة أن تقول ما وقع', async () => {
    const order = await defaulted()
    const context = await getReawardContext(order.id)

    const withForfeit = await reawardOrder({
      orderId: order.id,
      nextBidderId: context.candidates[0].userId,
      forfeitCurrentDeposit: true,
      reason: 'تخلّف',
      adminId: adminId(),
    })
    expect(withForfeit.forfeited).toBe(context.currentDepositAmount)
  })

  it('بلا مصادرة: يعود عربون المتخلّف ولا يبقى محجوزًا على مزادٍ خرج منه', async () => {
    const order = await defaulted()
    const context = await getReawardContext(order.id)

    const result = await reawardOrder({
      orderId: order.id,
      nextBidderId: context.candidates[0].userId,
      forfeitCurrentDeposit: false,
      reason: 'عذر مقبول',
      adminId: adminId(),
    })
    expect(result.forfeited).toBe(0)
    expect((await store.getDeposit(order.depositId!))!.status).toBe('released')
  })
})
