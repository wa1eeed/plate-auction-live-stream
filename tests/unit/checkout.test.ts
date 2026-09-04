import { beforeEach, describe, expect, it } from 'vitest'
import { emptyDatabase, MemoryStore, type MemoryDatabase } from '@/lib/store/memory-store'
import { seedDatabase } from '@/lib/store/seed'
import { resetStoreForTests } from '@/lib/store'
import { resetRateLimits } from '@/lib/server/rate-limit'
import { getCheckoutView, startOrderPayment } from '@/lib/server/checkout-service'
import { halalasToRiyals, riyalsToHalalas } from '@/lib/domain/money'
import type { Order } from '@/lib/domain/types'

let db: MemoryDatabase
let store: MemoryStore

/** صفقة مبذورة بانتظار السداد، ومعها عربون محجوز. */
const pendingOrder = (): Order =>
  db.orders.find((o) => o.status === 'awaiting_settlement' && o.depositId)!

async function enableCommission(percent: number, vat: number) {
  await store.updateCommissionSettings({
    seller: { enabled: false, mode: 'percent', percent: 0, fixed: 0, min: 0, max: 0 },
    buyer: { enabled: true, mode: 'percent', percent, fixed: 0, min: 0, max: 0 },
    vatEnabled: vat > 0,
    vatPercent: vat,
  })
}

beforeEach(() => {
  db = emptyDatabase()
  seedDatabase(db)
  store = new MemoryStore(db)
  resetStoreForTests(store)
  resetRateLimits()
})

describe('صفحة السداد', () => {
  it('المطلوب = القيمة − العربون + العمولة + ضريبتها', async () => {
    await enableCommission(2.5, 15)
    const order = pendingOrder()
    const view = await getCheckoutView(order.id, order.buyerId)
    const deposit = (await store.getDeposit(order.depositId!))!

    const base = Math.round((order.amount * 2.5) / 100)
    const vat = Math.round((base * 15) / 100)
    expect(view.order.settlement.net).toBe(order.amount - deposit.amount + base + vat)
  })

  it('مقصورة على مشتري الصفقة', async () => {
    const order = pendingOrder()
    const other = db.users.find((u) => u.id !== order.buyerId)!.id
    await expect(getCheckoutView(order.id, other)).rejects.toMatchObject({
      code: 'NOT_YOUR_ORDER',
    })
  })

  it('المحفظة متاحة إن كفى المتاح، ومعطّلة بسبب مذكور إن لم يكفِ', async () => {
    const order = pendingOrder()
    const view = await getCheckoutView(order.id, order.buyerId)
    const wallet = view.methods.find((m) => m.method === 'wallet')!
    expect(wallet.hint).toMatch(/رصيدك المتاح/)

    // نستنزف رصيده
    db.wallets.get(order.buyerId)!.balance = 0
    const poor = await getCheckoutView(order.id, order.buyerId)
    expect(poor.methods.find((m) => m.method === 'wallet')!.available).toBe(false)
  })
})

describe('السداد من المحفظة', () => {
  it('يخصم الثمن والعربون والعمولة مرّة واحدة لا مرّتين', async () => {
    await enableCommission(2.5, 15)
    const order = pendingOrder()
    const deposit = (await store.getDeposit(order.depositId!))!
    const view = await getCheckoutView(order.id, order.buyerId)

    // نضمن كفاية الرصيد
    db.wallets.get(order.buyerId)!.balance = order.amount * 3
    const before = (await store.getWallet(order.buyerId)).balance

    const result = await startOrderPayment({
      orderId: order.id,
      userId: order.buyerId,
      method: 'wallet',
    })
    expect(result.settled).toBe(true)

    const after = (await store.getWallet(order.buyerId)).balance
    const base = Math.round((order.amount * 2.5) / 100)
    const vat = Math.round((base * 15) / 100)

    /*
     * الخارج من المحفظة = ثمن اللوحة كاملًا + العمولة وضريبتها.
     * العربون جزء من الثمن لا زيادة عليه، فيُخصم ضمنه لا فوقه.
     */
    expect(halalasToRiyals(before - after)).toBe(halalasToRiyals(order.amount + base + vat))

    // ولا يُخصم العربون مرّتين: قيدٌ واحد بحالته النهائية
    expect((await store.getDeposit(deposit.id))!.status).toBe('applied')
    const ledger = await store.listLedger({ userId: order.buyerId })
    expect(ledger.filter((l) => l.type === 'deposit_applied')).toHaveLength(1)
    expect(ledger.filter((l) => l.type === 'commission')).toHaveLength(1)
    expect(ledger.filter((l) => l.type === 'vat')).toHaveLength(1)

    // والمعروض في صفحة السداد يطابق الخارج بعد احتساب العربون المحجوز مسبقًا
    expect(view.order.settlement.net).toBe(order.amount - deposit.amount + base + vat)
  })

  it('يحجز الصفقة أمانةً ويربط العملية بها', async () => {
    const order = pendingOrder()
    db.wallets.get(order.buyerId)!.balance = order.amount * 3

    const result = await startOrderPayment({
      orderId: order.id,
      userId: order.buyerId,
      method: 'wallet',
    })
    // السداد يحجز ولا يُتمّ — الإفراج بعد نقل الملكية
    expect((await store.getOrder(order.id))!.status).toBe('escrow_held')

    const payments = await store.listPayments({ userId: order.buyerId })
    const settled = payments.find((p) => p.reference === result.paymentReference)!
    expect(settled.orderId).toBe(order.id)
    expect(settled.status).toBe('paid')
  })

  it('لا سداد مرّتين لصفقة حُجز مالها', async () => {
    const order = pendingOrder()
    db.wallets.get(order.buyerId)!.balance = order.amount * 3
    await startOrderPayment({ orderId: order.id, userId: order.buyerId, method: 'wallet' })

    await expect(
      startOrderPayment({ orderId: order.id, userId: order.buyerId, method: 'wallet' }),
    ).rejects.toMatchObject({ code: 'ORDER_NOT_PAYABLE' })
  })

  it('رصيد لا يكفي يُرفض بلا خصم', async () => {
    const order = pendingOrder()
    db.wallets.get(order.buyerId)!.balance = riyalsToHalalas(1)
    const before = (await store.getWallet(order.buyerId)).balance

    await expect(
      startOrderPayment({ orderId: order.id, userId: order.buyerId, method: 'wallet' }),
    ).rejects.toMatchObject({ code: 'METHOD_UNAVAILABLE' })
    expect((await store.getWallet(order.buyerId)).balance).toBe(before)
  })
})
