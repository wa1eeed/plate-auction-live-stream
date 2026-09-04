import { beforeEach, describe, expect, it } from 'vitest'
import { emptyDatabase, MemoryStore, type MemoryDatabase } from '@/lib/store/memory-store'
import { seedDatabase } from '@/lib/store/seed'
import { resetStoreForTests } from '@/lib/store'
import { resetRateLimits } from '@/lib/server/rate-limit'
import { getReawardContext, reawardOrder, setOrderStatusByAdmin } from '@/lib/server/admin-service'
import { startOrderPayment } from '@/lib/server/checkout-service'
import { markPaymentFailed, markPaymentPaid } from '@/lib/server/payment-service'
import { finalizeDueAuctions } from '@/lib/server/market-service'
import type { Order, Payment } from '@/lib/domain/types'

let db: MemoryDatabase
let store: MemoryStore

const adminId = () => db.admins[0].id
const pendingOrder = (): Order =>
  db.orders.find((o) => o.status === 'awaiting_settlement' && o.depositId)!

async function enableBank() {
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
}

async function startTransfer(order: Order): Promise<Payment> {
  const result = await startOrderPayment({
    orderId: order.id,
    userId: order.buyerId,
    method: 'bank_transfer',
  })
  const rows = await store.listPayments({ userId: order.buyerId })
  return rows.find((p) => p.reference === result.paymentReference)!
}

beforeEach(() => {
  db = emptyDatabase()
  seedDatabase(db)
  store = new MemoryStore(db)
  resetStoreForTests(store)
  resetRateLimits()
})

describe('الأدمن لا يُتمّ صفقة بتبديل حالة', () => {
  it('يرفض `completed` ويحيل إلى الإفراج', async () => {
    const order = pendingOrder()
    const deposit = (await store.getDeposit(order.depositId!))!

    await expect(
      setOrderStatusByAdmin({ orderId: order.id, status: 'completed', adminId: adminId() }),
    ).rejects.toMatchObject({ code: 'USE_RELEASE_FLOW' })

    // ولا يمسّ العربون: كانت تُخصمه قبل أن يصل ريال
    expect((await store.getDeposit(deposit.id))!.status).toBe('held')
    expect((await store.getOrder(order.id))!.status).toBe('awaiting_settlement')
  })

  it('السداد يحجز أمانةً ولا يُتمّ', async () => {
    await enableBank()
    const order = pendingOrder()
    const payment = await startTransfer(order)
    await markPaymentPaid({ paymentId: payment.id, adminId: adminId(), note: null })
    expect((await store.getOrder(order.id))!.status).toBe('escrow_held')
  })
})

describe('السداد قائمة سماح لا منع', () => {
  it('صفقة متخلّفة لا تُسدَّد — كانت تمرّ', async () => {
    await enableBank()
    const order = pendingOrder()
    await store.updateOrderStatus(order.id, 'defaulted', Date.now())

    await expect(
      startOrderPayment({ orderId: order.id, userId: order.buyerId, method: 'bank_transfer' }),
    ).rejects.toMatchObject({ code: 'ORDER_NOT_PAYABLE' })
  })

  it('الملغاة والمكتملة تحتفظان برمزيهما المميّزين', async () => {
    await enableBank()
    const order = pendingOrder()
    await store.updateOrderStatus(order.id, 'cancelled', Date.now())
    await expect(
      startOrderPayment({ orderId: order.id, userId: order.buyerId, method: 'bank_transfer' }),
    ).rejects.toMatchObject({ code: 'ORDER_CANCELLED' })
  })
})

describe('إعادة الإرساء لا تُيتّم مالًا', () => {
  it('ترفض صفقة وصل مالها', async () => {
    await enableBank()
    const listing = db.listings.find(
      (l) => l.saleType === 'auction' && l.status === 'active' && l.depositAmount > 0,
    )!
    await store.updateListing(listing.id, {
      reservePrice: 0,
      endsAt: new Date(Date.now() - 1000).toISOString(),
    })
    await finalizeDueAuctions(store)
    const order = (await store.listOrders({ listingId: listing.id }))[0]
    db.orders.find((r) => r.id === order.id)!.paymentDueAt = new Date(
      Date.now() - 60_000,
    ).toISOString()

    const context = await getReawardContext(order.id)
    const payment = await startTransfer((await store.getOrder(order.id))!)
    await markPaymentPaid({ paymentId: payment.id, adminId: adminId(), note: null })

    /*
     * سُدّدت فحُجز مالها أمانةً: إعادة إرسائها على غيره تترك ما دفعه بلا
     * صفقة تقابله — مالٌ يتيم في حساب المنصّة.
     */
    await expect(
      reawardOrder({
        orderId: order.id,
        nextBidderId: context.candidates[0].userId,
        forfeitCurrentDeposit: true,
        reason: 'محاولة',
        adminId: adminId(),
      }),
    ).rejects.toMatchObject({ code: 'ORDER_ALREADY_PAID' })
  })
})

describe('ردّ دفعة عالقة', () => {
  it('رفض دفعة صفقة تحت المراجعة يُعيد المبلغ إلى رصيد صاحبها', async () => {
    await enableBank()
    const order = pendingOrder()
    const payment = await startTransfer(order)

    // صارت الصفقة غير قابلة للتسوية، فحُجزت الدفعة للمراجعة
    await store.updateOrderStatus(order.id, 'cancelled', Date.now())
    const held = await markPaymentPaid({ paymentId: payment.id, adminId: adminId(), note: null })
    expect(held.status).toBe('under_review')

    const before = (await store.getWallet(order.buyerId)).balance
    const failed = await markPaymentFailed({
      paymentId: payment.id,
      adminId: adminId(),
      reason: 'أُلغيت الصفقة',
    })

    expect(failed.status).toBe('failed')
    // المال وصل المنصّة فعلًا — فلا يُسقَط صمتًا بل يعود
    expect((await store.getWallet(order.buyerId)).balance).toBe(before + payment.amount)
    const refunds = (await store.listLedger({ userId: order.buyerId })).filter(
      (l) => l.type === 'purchase_refund',
    )
    expect(refunds).toHaveLength(1)
    expect(refunds[0].amount).toBe(payment.amount)
  })

  it('لا يُرفض ما سُوّي فعلًا ولو كان بلا قيد محفظة', async () => {
    await enableBank()
    const order = pendingOrder()
    const payment = await startTransfer(order)
    await markPaymentPaid({ paymentId: payment.id, adminId: adminId(), note: null })

    await expect(
      markPaymentFailed({ paymentId: payment.id, adminId: adminId(), reason: 'تراجع' }),
    ).rejects.toMatchObject({ code: 'PAYMENT_SETTLED' })
  })
})
