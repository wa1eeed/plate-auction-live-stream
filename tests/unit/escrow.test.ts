import { beforeEach, describe, expect, it } from 'vitest'
import { emptyDatabase, MemoryStore, type MemoryDatabase } from '@/lib/store/memory-store'
import { seedDatabase } from '@/lib/store/seed'
import { resetStoreForTests } from '@/lib/store'
import { resetRateLimits } from '@/lib/server/rate-limit'
import { settleOrderForTest } from '../support/settle'
import {
  openDispute,
  releaseOrderEscrow,
  submitTransferProof,
  sweepEscrow,
} from '@/lib/server/escrow-service'
import { resolveDispute, setOrderStatusByAdmin } from '@/lib/server/admin-service'
import { updateOrderStatus } from '@/lib/server/order-service'
import { halalasToRiyals } from '@/lib/domain/money'
import type { Order } from '@/lib/domain/types'

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

/** يصل بالصفقة إلى الحجز. */
async function held(): Promise<Order> {
  const order = pending()
  await settleOrderForTest(store, order, adminId())
  return (await store.getOrder(order.id))!
}

beforeEach(() => {
  db = emptyDatabase()
  seedDatabase(db)
  store = new MemoryStore(db)
  resetStoreForTests(store)
  resetRateLimits()
})

describe('تحصيل الضمان', () => {
  it('السداد يحجز ولا يُتمّ — والعربون يُخصم وعرابين الخاسرين تعود', async () => {
    const order = pending()
    const deposit = (await store.getDeposit(order.depositId!))!
    const escrowed = await (async () => {
      await settleOrderForTest(store, order, adminId())
      return (await store.getOrder(order.id))!
    })()

    expect(escrowed.status).toBe('escrow_held')
    expect(escrowed.paidAt).not.toBeNull()
    expect(escrowed.escrowAmount).toBe(order.amount)
    // مهلة البائع مثبّتة من لقطة الإعلان لا من الإعدادات الحالية
    expect(escrowed.transferDueAt).not.toBeNull()

    expect((await store.getDeposit(deposit.id))!.status).toBe('applied')
    // المشتري أدّى، فسقط احتمال إعادة الإرساء ولا وجه لتجميد مال غيره
    const stillHeld = await store.listDeposits({ listingId: order.listingId, status: ['held'] })
    expect(stillHeld).toHaveLength(0)
  })

  it('البائع لا يملك «تمّت الصفقة» بعد اليوم', async () => {
    const order = pending()
    await expect(
      updateOrderStatus({ orderId: order.id, userId: order.sellerId, status: 'completed' }),
    ).rejects.toMatchObject({ code: 'USE_TRANSFER_FLOW' })
  })

  it('ولا الأدمن يُتمّها بتبديل حالة', async () => {
    const order = pending()
    await expect(
      setOrderStatusByAdmin({ orderId: order.id, status: 'completed', adminId: adminId() }),
    ).rejects.toMatchObject({ code: 'USE_RELEASE_FLOW' })
  })
})

describe('نقل الملكية وتأكيد المشتري', () => {
  it('البائع يرفع الإثبات فيبدأ مؤقّت التأكيد', async () => {
    const order = await held()
    const after = await submitTransferProof({
      orderId: order.id,
      sellerId: order.sellerId,
      note: 'نُقلت في أبشر برقم 12345',
    })
    expect(after.status).toBe('ownership_transferred')
    expect(after.transferProofAt).not.toBeNull()
    expect(after.confirmDueAt).not.toBeNull()
  })

  it('لا يرفعه غير البائع، ولا قبل وصول المال', async () => {
    const order = pending()
    await expect(
      submitTransferProof({ orderId: order.id, sellerId: order.sellerId, note: 'قبل السداد' }),
    ).rejects.toMatchObject({ code: 'ORDER_STATE_INVALID' })

    const escrowed = await held()
    await expect(
      submitTransferProof({ orderId: escrowed.id, sellerId: escrowed.buyerId, note: 'لست البائع' }),
    ).rejects.toMatchObject({ code: 'NOT_YOUR_ORDER' })
  })

  it('تأكيد المشتري يُفرج العائد بعد خصم عمولة البائع وضريبتها', async () => {
    await enableCommission(2.5, 15)
    const order = await held()
    await submitTransferProof({ orderId: order.id, sellerId: order.sellerId, note: 'نُقلت' })

    const before = (await store.getWallet(order.sellerId)).balance
    const done = await releaseOrderEscrow((await store.getOrder(order.id))!, { by: 'admin', adminId: adminId() })

    expect(done.status).toBe('completed')
    expect(done.payoutLedgerEntryId).not.toBeNull()

    const base = Math.round((order.amount * 2.5) / 100)
    const vat = Math.round((base * 15) / 100)
    const after = (await store.getWallet(order.sellerId)).balance
    /*
     * العمولة تُخصم من العائد لا من محفظة البائع: لا يملك رصيدًا ليدفع
     * عمولة بيعٍ لم يقبض ثمنه بعد.
     */
    expect(halalasToRiyals(after - before)).toBe(halalasToRiyals(order.amount - base - vat))

    // قيود **هذه الصفقة** لا كل قيود البائع: بذرته تحمل صفقات أخرى مكتملة
    const ledger = (await store.listLedger({ userId: order.sellerId })).filter(
      (l) => l.orderId === order.id,
    )
    expect(ledger.filter((l) => l.type === 'sale_proceeds')).toHaveLength(1)
    expect(ledger.filter((l) => l.type === 'commission')).toHaveLength(0)

    // والعمولة تُقيَّد إيرادًا محصَّلًا
    const revenue = await store.listPlatformEntries({ orderId: order.id })
    const sellerRows = revenue.filter((r) => r.type === 'commission_seller' || r.type === 'vat_seller')
    expect(sellerRows).toHaveLength(2)
    expect(sellerRows.every((r) => r.settled)).toBe(true)
  })

  it('لا إفراج مرّتين', async () => {
    const order = await held()
    await submitTransferProof({ orderId: order.id, sellerId: order.sellerId, note: 'نُقلت' })
    await releaseOrderEscrow((await store.getOrder(order.id))!, { by: 'admin', adminId: adminId() })

    const balance = (await store.getWallet(order.sellerId)).balance
    // نداء ثانٍ لا يُقيّد شيئًا: قيد العائد هو الختم لا الحالة
    await releaseOrderEscrow((await store.getOrder(order.id))!, { by: 'admin', adminId: adminId() })
    expect((await store.getWallet(order.sellerId)).balance).toBe(balance)
  })
})

describe('الإفراج قرار إدارة لا مؤقّت', () => {
  /*
   * كان المال يخرج بانقضاء مهلة تأكيد المشتري. وقد صار الإفراج قرار إدارة،
   * فبقاء التلقائي يعني خروج مالٍ بلا قرارٍ من أحد.
   */
  it('انقضاء المهلة لا يُفرج شيئًا', async () => {
    const order = await held()
    await submitTransferProof({ orderId: order.id, sellerId: order.sellerId, note: 'نُقلت' })

    db.orders.find((o) => o.id === order.id)!.confirmDueAt = new Date(
      Date.now() - 60_000,
    ).toISOString()
    await sweepEscrow(store)

    const after = (await store.getOrder(order.id))!
    expect(after.status).toBe('ownership_transferred')
    expect(after.payoutLedgerEntryId).toBeNull()
  })

  it('وتُذكَّر بتأخّر المراجعة مرّة واحدة', async () => {
    const order = await held()
    await submitTransferProof({ orderId: order.id, sellerId: order.sellerId, note: 'نُقلت' })
    db.orders.find((o) => o.id === order.id)!.confirmDueAt = new Date(
      Date.now() - 60_000,
    ).toISOString()

    expect(await sweepEscrow(store)).toBe(1)
    expect(await sweepEscrow(store)).toBe(0)

    // والبائع هو صاحب المال المنتظِر
    const notices = (await store.listNotifications(order.sellerId)).filter((n) =>
      n.title.includes('مهلة مراجعة'),
    )
    expect(notices).toHaveLength(1)
  })

  it('ولا يُفرج إلا بقرار: قرار الإدارة يُتمّها', async () => {
    const order = await held()
    await submitTransferProof({ orderId: order.id, sellerId: order.sellerId, note: 'نُقلت' })

    await resolveDispute({
      orderId: order.id,
      decision: 'release',
      reason: 'تحقّقنا من النقل في أبشر',
      adminId: adminId(),
    })
    expect((await store.getOrder(order.id))!.status).toBe('completed')
  })
})

describe('الاعتراض وفصله', () => {
  it('يُنبَّه الطرف الآخر ولا يُترك يكتشف توقّف صفقته', async () => {
    const order = await held()
    await openDispute({ orderId: order.id, userId: order.buyerId, reason: 'لم تُنقل الملكية' })

    const seller = await store.listNotifications(order.sellerId)
    expect(seller.some((n) => n.type === 'order_disputed')).toBe(true)
  })

  it('الأدمن يُفرج فيصل العائد للبائع', async () => {
    const order = await held()
    await openDispute({ orderId: order.id, userId: order.sellerId, reason: 'المشتري لا يردّ' })
    const before = (await store.getWallet(order.sellerId)).balance

    const resolved = await resolveDispute({
      orderId: order.id,
      decision: 'release',
      reason: 'الإثبات صحيح',
      adminId: adminId(),
    })
    expect(resolved.status).toBe('completed')
    expect((await store.getWallet(order.sellerId)).balance).toBeGreaterThan(before)
  })

  it('الأدمن يستردّ فيعود المال للمشتري وتُبطَل قيود إيراده', async () => {
    await store.updateCommissionSettings({
      seller: { enabled: false, mode: 'percent', percent: 0, fixed: 0, min: 0, max: 0 },
      buyer: { enabled: true, mode: 'percent', percent: 2, fixed: 0, min: 0, max: 0 },
      vatEnabled: true,
      vatPercent: 15,
    })
    const order = await held()
    await openDispute({ orderId: order.id, userId: order.buyerId, reason: 'لم تُنقل' })
    const before = (await store.getWallet(order.buyerId)).balance

    const resolved = await resolveDispute({
      orderId: order.id,
      decision: 'refund',
      reason: 'ثبت عدم النقل',
      adminId: adminId(),
    })
    expect(resolved.status).toBe('refunded')

    // يعود الثمن وعمولته وضريبتها معًا
    const revenue = await store.listPlatformEntries({ orderId: order.id })
    const buyerRows = revenue.filter((r) => r.type === 'commission_buyer' || r.type === 'vat_buyer')
    const fees = buyerRows.reduce((sum, r) => sum + r.amount, 0)
    expect((await store.getWallet(order.buyerId)).balance).toBe(before + order.amount + fees)

    // والقيود تُوسَم مُبطَلة ولا تُحذف — الدفتر يروي ما حدث
    for (const row of buyerRows) expect(row.reversedAt).not.toBeNull()
  })

  it('لا فصل في صفقة استقرّ مالها', async () => {
    const order = await held()
    await submitTransferProof({ orderId: order.id, sellerId: order.sellerId, note: 'نُقلت' })
    await releaseOrderEscrow((await store.getOrder(order.id))!, { by: 'admin', adminId: adminId() })

    await expect(
      resolveDispute({ orderId: order.id, decision: 'refund', reason: 'متأخّر', adminId: adminId() }),
    ).rejects.toMatchObject({ code: 'ORDER_STATE_INVALID' })
  })
})

describe('باب السؤال لا يُغلق', () => {
  /*
   * المشتري لا يُطالَب بشيء بعد رفع الإثبات، لكنّه قد يكون لديه ما يقوله.
   * والاستفسار قبل السداد لا يُجمَّد: تجميدُ صفقةٍ لم يصل مالها يمنع صاحبها
   * من الدفع — فيُعاقَب على سؤاله.
   */
  it('قبل السداد: يُسجَّل ويُرفع بلا تجميد', async () => {
    const order = pending()
    const after = await openDispute({
      orderId: order.id,
      userId: order.buyerId,
      reason: 'أين أجد بيانات البائع؟',
    })
    expect(after.status).toBe('awaiting_settlement')
    expect(after.disputedAt).not.toBeNull()
    expect(after.disputeReason).toBe('أين أجد بيانات البائع؟')
  })

  it('وبعد الحجز: يُجمَّد الإفراج', async () => {
    const order = await held()
    const after = await openDispute({
      orderId: order.id,
      userId: order.buyerId,
      reason: 'لم تُنقل باسمي',
    })
    expect(after.status).toBe('disputed')
  })

  it('وبعد رفع الإثبات كذلك — الباب مفتوح حتى الإفراج', async () => {
    const order = await held()
    await submitTransferProof({ orderId: order.id, sellerId: order.sellerId, note: 'نُقلت' })
    const after = await openDispute({
      orderId: order.id,
      userId: order.buyerId,
      reason: 'الإثبات لا يطابق لوحتي',
    })
    expect(after.status).toBe('disputed')
  })

  it('ولا اعتراض بعد أن استقرّ المال', async () => {
    const order = await held()
    await submitTransferProof({ orderId: order.id, sellerId: order.sellerId, note: 'نُقلت' })
    await releaseOrderEscrow((await store.getOrder(order.id))!, { by: 'admin', adminId: adminId() })

    await expect(
      openDispute({ orderId: order.id, userId: order.buyerId, reason: 'تأخّرت' }),
    ).rejects.toMatchObject({ code: 'ORDER_STATE_INVALID' })
  })
})
