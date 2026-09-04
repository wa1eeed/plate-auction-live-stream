import { beforeEach, describe, expect, it } from 'vitest'
import { emptyDatabase, MemoryStore, type MemoryDatabase } from '@/lib/store/memory-store'
import { seedDatabase } from '@/lib/store/seed'
import { resetStoreForTests } from '@/lib/store'
import { resetRateLimits } from '@/lib/server/rate-limit'
import { settleOrderForTest, completeOrderForTest } from '../support/settle'
import { refundOrderEscrow, submitTransferProof } from '@/lib/server/escrow-service'
import { cancelDisbursement, payDisbursement } from '@/lib/server/disbursement-service'
import { availableBalance, type Order } from '@/lib/domain/types'
import { halalasToRiyals } from '@/lib/domain/money'

let db: MemoryDatabase
let store: MemoryStore

const adminId = () => db.admins[0].id
const pending = (): Order => db.orders.find((o) => o.status === 'awaiting_settlement' && o.depositId)!

async function enableCommission(percent: number, vat: number) {
  await store.updateCommissionSettings({
    seller: { enabled: true, mode: 'percent', percent, fixed: 0, min: 0, max: 0 },
    buyer: { enabled: false, mode: 'percent', percent: 0, fixed: 0, min: 0, max: 0 },
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

describe('أمر الصرف يُفتح بقرار الإدارة', () => {
  /*
   * القرار يقيّد في المحفظة **و** يفتح التزامًا.
   *
   * لو اكتفينا بالقيد لبقي خروج المال من البنك بلا ورقة: لا مستفيد مُثبَت،
   * ولا آيبان مُلتقَط وقت القرار، ولا مرجع حوالة يُطابَق به كشف البنك.
   */
  it('التحويل للبائع يفتح أمر صرف بصافي عائده', async () => {
    await enableCommission(2, 15)
    const order = pending()
    await completeOrderForTest(store, order, adminId())

    const [payout] = await store.listDisbursements({ orderId: order.id })
    expect(payout.kind).toBe('seller_payout')
    expect(payout.status).toBe('pending')
    expect(payout.beneficiaryId).toBe(order.sellerId)

    // صافي العائد: قيمة الصفقة ناقص العمولة وضريبتها
    const commission = Math.round(order.amount * 0.02)
    const vat = Math.round(commission * 0.15)
    expect(payout.amount).toBe(order.amount - commission - vat)
    expect(payout.commissionAmount).toBe(commission)
    expect(payout.vatAmount).toBe(vat)
  })

  it('الإعادة للمشتري تفتح أمر صرف باسمه هو', async () => {
    const order = pending()
    await settleOrderForTest(store, order, adminId())
    const held = (await store.getOrder(order.id))!
    await refundOrderEscrow(held, { reason: 'لم تُنقل الملكية', adminId: adminId() })

    const [refund] = await store.listDisbursements({ orderId: order.id })
    expect(refund.kind).toBe('buyer_refund')
    expect(refund.beneficiaryId).toBe(order.buyerId)
    expect(refund.amount).toBe(held.escrowAmount)
  })

  /*
   * الآيبان **لقطة** لا مرجع.
   *
   * لو قُرئ من ملفّ المستفيد وقت الصرف، لتحوّل المال إلى آيبان بُدّل بعد
   * صدور الأمر — والتحويل حينها إلى غير من صدر له.
   */
  it('يلتقط الحساب البنكي وقت الإصدار فلا يتبدّل بتبديل صاحبه', async () => {
    const order = pending()
    await completeOrderForTest(store, order, adminId())
    const [payout] = await store.listDisbursements({ orderId: order.id })
    const captured = payout.bankIban

    await store.updateUser(order.sellerId, {
      payout: { bankName: 'بنك آخر', iban: 'SA9805000000682012345678', accountName: 'اسم آخر' },
    })

    const [again] = await store.listDisbursements({ orderId: order.id })
    expect(again.bankIban).toBe(captured)
  })

  it('لا يفتح أمرين لصفقة ونوع واحد', async () => {
    const order = pending()
    await completeOrderForTest(store, order, adminId())
    const before = await store.listDisbursements({ orderId: order.id })

    // إعادة التحويل لا تُنتج التزامًا ثانيًا على مالٍ واحد
    const released = (await store.getOrder(order.id))!
    const { releaseOrderEscrow } = await import('@/lib/server/escrow-service')
    await releaseOrderEscrow(released, { by: 'admin', adminId: adminId() })

    expect(await store.listDisbursements({ orderId: order.id })).toHaveLength(before.length)
  })
})

describe('تنفيذ أمر الصرف', () => {
  async function raisedPayout() {
    const order = pending()
    await completeOrderForTest(store, order, adminId())
    const [payout] = await store.listDisbursements({ orderId: order.id })
    return { order, payout }
  }

  /*
   * الخصم هو نصف القيد الثاني.
   *
   * القرار قيّد العائد دائنًا في المحفظة؛ والصرف يُخرجه إلى البنك. ولو لم
   * يُخصم لبقي في المحفظة رصيدٌ صُرف نظيره — مالٌ يُنفَق مرّتين.
   */
  it('يخصم من المحفظة عند الإقفال فلا يبقى رصيد صُرف نظيره', async () => {
    const { payout } = await raisedPayout()
    const before = availableBalance(await store.getWallet(payout.beneficiaryId))

    await payDisbursement({ id: payout.id, paymentReference: 'TRX-9911', adminId: adminId() })

    const after = availableBalance(await store.getWallet(payout.beneficiaryId))
    expect(halalasToRiyals(before - after)).toBe(halalasToRiyals(payout.amount))

    const closed = (await store.getDisbursement(payout.id))!
    expect(closed.status).toBe('paid')
    expect(closed.paymentReference).toBe('TRX-9911')
    expect(closed.ledgerEntryId).not.toBeNull()
  })

  it('لا يُقفل بلا مرجع حوالة — وإلا لم يُطابَق كشف البنك', async () => {
    const { payout } = await raisedPayout()
    await expect(
      payDisbursement({ id: payout.id, paymentReference: '   ', adminId: adminId() }),
    ).rejects.toThrow(/مرجع/)
  })

  it('الإقفال مرّتين لا يخصم مرّتين', async () => {
    const { payout } = await raisedPayout()
    await payDisbursement({ id: payout.id, paymentReference: 'TRX-1', adminId: adminId() })
    const after = availableBalance(await store.getWallet(payout.beneficiaryId))

    await payDisbursement({ id: payout.id, paymentReference: 'TRX-2', adminId: adminId() })
    expect(availableBalance(await store.getWallet(payout.beneficiaryId))).toBe(after)
    expect((await store.getDisbursement(payout.id))!.paymentReference).toBe('TRX-1')
  })

  /*
   * الإلغاء يُسقط الحوالة لا الاستحقاق.
   *
   * من آثر ترك ماله في محفظته لا يُنقص منه شيء — والخطأ هنا يعني مصادرةً
   * صامتة لمال مستحقّ.
   */
  it('الإلغاء لا يمسّ رصيد المستفيد', async () => {
    const { payout } = await raisedPayout()
    const before = availableBalance(await store.getWallet(payout.beneficiaryId))

    await cancelDisbursement({ id: payout.id, reason: 'طلب إبقاءه في المحفظة', adminId: adminId() })

    expect(availableBalance(await store.getWallet(payout.beneficiaryId))).toBe(before)
    expect((await store.getDisbursement(payout.id))!.status).toBe('cancelled')
  })

  it('أمرٌ صُرف لا يُلغى — يُصحَّح بقيد مقابل', async () => {
    const { payout } = await raisedPayout()
    await payDisbursement({ id: payout.id, paymentReference: 'TRX-3', adminId: adminId() })
    await expect(
      cancelDisbursement({ id: payout.id, reason: 'تراجع', adminId: adminId() }),
    ).rejects.toThrow(/لا يُلغى/)
  })

  it('أمرٌ أُلغي لا يُصرف بعد إلغائه', async () => {
    const { payout } = await raisedPayout()
    await cancelDisbursement({ id: payout.id, reason: 'خطأ إداري', adminId: adminId() })
    await expect(
      payDisbursement({ id: payout.id, paymentReference: 'TRX-4', adminId: adminId() }),
    ).rejects.toThrow(/مُلغى/)
  })

  /*
   * حسابٌ ناقص يوقف الصرف عند المحاسب.
   *
   * وهو الوحيد الذي لا يمضي بقراره بل بإكمال صاحبه بياناته — فلا يُحوَّل
   * إلى آيبان مظنون.
   */
  it('من لا حساب له يصدر أمره موقوفًا', async () => {
    const order = pending()
    await store.updateUser(order.sellerId, {
      payout: { bankName: '', iban: '', accountName: '' },
    })
    await completeOrderForTest(store, order, adminId())

    const [payout] = await store.listDisbursements({ orderId: order.id })
    expect(payout.bankIban).toBeNull()

    const { isPayable } = await import('@/lib/server/disbursement-service')
    expect(isPayable(payout)).toBe(false)
  })
})

describe('الفواتير الضريبية', () => {
  async function enableTax() {
    await store.updateTaxSettings({ enabled: true, vatNumber: '312345678910003' })
  }

  it('تُصدَر عن العمولة لا عن قيمة اللوحة', async () => {
    await enableCommission(2, 15)
    await enableTax()
    const order = pending()
    await completeOrderForTest(store, order, adminId())

    const invoices = await store.listInvoices({ orderId: order.id })
    const seller = invoices.find((row) => row.kind === 'seller_commission')!
    const commission = Math.round(order.amount * 0.02)

    expect(seller.netAmount).toBe(commission)
    expect(seller.vatAmount).toBe(Math.round(commission * 0.15))
    expect(seller.totalAmount).toBe(commission + Math.round(commission * 0.15))
    // قيمة اللوحة لا تدخل الوعاء
    expect(seller.netAmount).toBeLessThan(order.amount)
  })

  /*
   * السلسلة تكشف الحذف.
   *
   * كل فاتورة تحمل تجزئة سابقتها، فإسقاط واحدة من الوسط يقطع الحلقة —
   * وهذا ما يجعل الدفتر شاهدًا لا مجرّد قائمة.
   */
  it('تُسلسل بالتجزئة، وحذف واحدة يكسر السلسلة', async () => {
    await enableCommission(2, 15)
    await enableTax()
    const { verifyInvoiceChain, genesisHash } = await import('@/lib/server/invoice-service')

    const first = pending()
    await completeOrderForTest(store, first, adminId())
    const second = db.orders.find(
      (o) => o.status === 'awaiting_settlement' && o.id !== first.id,
    )
    if (second) {
      await settleOrderForTest(store, second, adminId())
      await submitTransferProof({ orderId: second.id, sellerId: second.sellerId, note: 'نُقلت' })
      const { releaseOrderEscrow } = await import('@/lib/server/escrow-service')
      await releaseOrderEscrow((await store.getOrder(second.id))!, {
        by: 'admin',
        adminId: adminId(),
      })
    }

    const chain = db.invoices
    expect(chain.length).toBeGreaterThan(0)
    expect(chain[0].previousHash).toBe(genesisHash())
    expect(verifyInvoiceChain(chain).ok).toBe(true)

    if (chain.length > 1) {
      expect(verifyInvoiceChain(chain.slice(1)).ok).toBe(false)
    }
  })

  it('لا تُصدَر مرّتين عن التوريد نفسه', async () => {
    await enableCommission(2, 15)
    await enableTax()
    const order = pending()
    await completeOrderForTest(store, order, adminId())
    const before = (await store.listInvoices({ orderId: order.id })).length

    const { releaseOrderEscrow } = await import('@/lib/server/escrow-service')
    await releaseOrderEscrow((await store.getOrder(order.id))!, { by: 'admin', adminId: adminId() })

    expect(await store.listInvoices({ orderId: order.id })).toHaveLength(before)
  })

  /*
   * الامتناع أسلم من إصدار باطل.
   *
   * فاتورة برقم ضريبي مختلّ تُرفض من الهيئة، ورقمها استُهلك من السلسلة —
   * فلا تُصدَر أصلًا.
   */
  it('لا تُصدَر برقم ضريبي مختلّ', async () => {
    await enableCommission(2, 15)
    await store.updateTaxSettings({ enabled: true, vatNumber: '123' })
    const order = pending()
    await completeOrderForTest(store, order, adminId())
    expect(await store.listInvoices({ orderId: order.id })).toHaveLength(0)
  })

  it('لا تُصدَر والفوترة معطّلة', async () => {
    await enableCommission(2, 15)
    await store.updateTaxSettings({ enabled: false })
    const order = pending()
    await completeOrderForTest(store, order, adminId())
    expect(await store.listInvoices({ orderId: order.id })).toHaveLength(0)
  })
})
