import { beforeEach, describe, expect, it } from 'vitest'
import { emptyDatabase, MemoryStore, type MemoryDatabase } from '@/lib/store/memory-store'
import { seedDatabase } from '@/lib/store/seed'
import { resetStoreForTests } from '@/lib/store'
import { resetRateLimits } from '@/lib/server/rate-limit'
import { getCheckoutView, startOrderPayment } from '@/lib/server/checkout-service'
import { markPaymentPaid } from '@/lib/server/payment-service'
import { halalasToRiyals } from '@/lib/domain/money'
import type { Order } from '@/lib/domain/types'

let db: MemoryDatabase
let store: MemoryStore

const adminId = () => db.admins[0].id
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

/** يبدأ حوالة بنكية على صفقة ويعيد سجلّها. */
async function startTransfer(order: Order) {
  const result = await startOrderPayment({
    orderId: order.id,
    userId: order.buyerId,
    method: 'bank_transfer',
  })
  const payments = await store.listPayments({ userId: order.buyerId })
  return payments.find((p) => p.reference === result.paymentReference)!
}

const countOf = async (userId: string, type: string) =>
  (await store.listLedger({ userId })).filter((l) => l.type === type).length

/**
 * لقطة أعداد القيود قبل الإجراء.
 *
 * البذرة تمنح كل مستخدم قيد `topup` افتتاحيًا، فعدّ القيود من الصفر يخلط
 * ما قبل الإجراء بما أحدثه. الفارق وحده هو أثر الإجراء.
 */
async function ledgerCounts(userId: string) {
  const rows = await store.listLedger({ userId })
  return (type: string) => rows.filter((l) => l.type === type).length
}

beforeEach(() => {
  db = emptyDatabase()
  seedDatabase(db)
  store = new MemoryStore(db)
  resetStoreForTests(store)
  resetRateLimits()
})

describe('تأكيد حوالة صفقة لا يشحن محفظة', () => {
  it('يخصم العربون وحده، ولا يكتب topup ولا purchase_payment ولا عمولة', async () => {
    await enableCommission(2.5, 15)
    await enableBank()
    const order = pendingOrder()
    const deposit = (await store.getDeposit(order.depositId!))!
    const before = (await store.getWallet(order.buyerId)).balance

    const payment = await startTransfer(order)
    const was = await ledgerCounts(order.buyerId)
    await markPaymentPaid({ paymentId: payment.id, adminId: adminId(), note: null })

    /*
     * المال وصل حساب المنصّة لا المحفظة، فالقيد الوحيد هو خصم العربون —
     * وهو المال الوحيد الذي كان في المحفظة فعلًا.
     */
    const after = (await store.getWallet(order.buyerId)).balance
    expect(halalasToRiyals(before - after)).toBe(halalasToRiyals(deposit.amount))

    const now = await ledgerCounts(order.buyerId)
    for (const type of ['topup', 'purchase_payment', 'commission', 'vat']) {
      expect(now(type) - was(type), `قيد ${type} لا يجب أن يقع`).toBe(0)
    }
    expect(now('deposit_applied') - was('deposit_applied')).toBe(1)
  })

  it('يحجز الصفقة أمانةً ويختم العملية مدفوعة', async () => {
    await enableBank()
    const order = pendingOrder()
    const payment = await startTransfer(order)

    const settled = await markPaymentPaid({
      paymentId: payment.id,
      adminId: adminId(),
      note: null,
    })
    expect(settled.status).toBe('paid')
    expect(settled.settledAt).not.toBeNull()
    // السداد يحجز ولا يُتمّ — الإفراج بعد نقل الملكية
    expect((await store.getOrder(order.id))!.status).toBe('escrow_held')
  })

  it('يُقيّد عمولة المشتري إيرادًا **محصَّلًا خارج المحفظة**', async () => {
    await enableCommission(2.5, 15)
    await enableBank()
    const order = pendingOrder()
    const payment = await startTransfer(order)
    await markPaymentPaid({ paymentId: payment.id, adminId: adminId(), note: null })

    const revenue = await store.listPlatformEntries({ orderId: order.id })
    const buyerRows = revenue.filter((r) => r.type === 'commission_buyer' || r.type === 'vat_buyer')
    expect(buyerRows.length).toBe(2)
    for (const row of buyerRows) {
      expect(row.settled).toBe(true)
      // حُصّل خارج المحفظة: لا قيد محفظة مقابل، والعملية مذكورة
      expect(row.ledgerEntryId).toBeNull()
      expect(row.paymentId).toBe(payment.id)
    }
    const total = buyerRows.reduce((sum, r) => sum + r.amount, 0)
    expect(total).toBe((payment.buyerCommission ?? 0) + (payment.buyerVat ?? 0))
  })

  it('الإيراد يُقيَّد بالمجمَّد لا بالمحسوب لو تغيّرت الإعدادات بين البدء والتأكيد', async () => {
    await enableCommission(2.5, 15)
    await enableBank()
    const order = pendingOrder()
    const payment = await startTransfer(order)
    const frozen = (payment.buyerCommission ?? 0) + (payment.buyerVat ?? 0)
    expect(frozen).toBeGreaterThan(0)

    // الإدارة تُعطّل العمولة بعد أن حوّل المشتري بمبلغ يشملها
    await enableCommission(0, 0)
    await markPaymentPaid({ paymentId: payment.id, adminId: adminId(), note: null })

    const revenue = await store.listPlatformEntries({ orderId: order.id })
    const collected = revenue
      .filter((r) => r.type === 'commission_buyer' || r.type === 'vat_buyer')
      .reduce((sum, r) => sum + r.amount, 0)
    expect(collected).toBe(frozen)
  })

  it('لا تُسوّى مرّتين مهما تكرّر التأكيد', async () => {
    await enableBank()
    const order = pendingOrder()
    const deposit = (await store.getDeposit(order.depositId!))!
    const payment = await startTransfer(order)

    await markPaymentPaid({ paymentId: payment.id, adminId: adminId(), note: null })
    const balance = (await store.getWallet(order.buyerId)).balance
    await markPaymentPaid({ paymentId: payment.id, adminId: adminId(), note: null })

    expect((await store.getWallet(order.buyerId)).balance).toBe(balance)
    expect(await countOf(order.buyerId, 'deposit_applied')).toBe(1)
    expect((await store.getDeposit(deposit.id))!.status).toBe('applied')
  })

  it('دفعة على صفقة لم تعد قابلة للسداد تُحجز للمراجعة بلا أي قيد', async () => {
    await enableBank()
    const order = pendingOrder()
    const payment = await startTransfer(order)

    // أُلغيت الصفقة بعد أن حوّل المشتري
    await store.updateOrderStatus(order.id, 'cancelled', Date.now())
    const before = (await store.getWallet(order.buyerId)).balance

    const held = await markPaymentPaid({ paymentId: payment.id, adminId: adminId(), note: null })
    expect(held.status).toBe('under_review')
    expect(held.failureReason).toBeTruthy()
    expect((await store.getWallet(order.buyerId)).balance).toBe(before)
  })
})

describe('شحن المحفظة لم يتغيّر', () => {
  it('عملية بلا صفقة تُضيف رصيدًا كما كانت', async () => {
    await enableBank()
    const user = db.users[0]
    const before = (await store.getWallet(user.id)).balance
    const payment = await store.createPayment({
      userId: user.id,
      orderId: null,
      orderPrice: null,
      buyerCommission: null,
      buyerVat: null,
      amount: 100_000,
      method: 'bank_transfer',
      status: 'under_review',
      tapChargeId: null,
      tapMode: null,
      tapStatus: null,
      transferNote: null,
      ledgerEntryId: null,
      failureReason: null,
    })

    const paid = await markPaymentPaid({ paymentId: payment.id, adminId: adminId(), note: null })
    expect(paid.status).toBe('paid')
    expect(paid.ledgerEntryId).not.toBeNull()
    expect((await store.getWallet(user.id)).balance).toBe(before + 100_000)
    expect(await countOf(user.id, 'topup')).toBeGreaterThan(0)
  })
})

describe('صفحة السداد بعد الإصلاح', () => {
  it('المطلوب = الثمن + الرسوم، والثمن معروض مستقلًّا', async () => {
    await enableCommission(2.5, 15)
    const order = pendingOrder()
    const view = await getCheckoutView(order.id, order.buyerId)
    const s = view.order.settlement
    expect(s.net).toBe(s.price + (s.commission?.total ?? 0))
  })
})
