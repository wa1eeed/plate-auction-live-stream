import { beforeEach, describe, expect, it } from 'vitest'
import { emptyDatabase, MemoryStore, type MemoryDatabase } from '@/lib/store/memory-store'
import { seedDatabase } from '@/lib/store/seed'
import { resetStoreForTests } from '@/lib/store'
import {
  computeCommission,
  computeCommissionSide,
  DEFAULT_COMMISSION_SETTINGS,
  type CommissionSide,
} from '@/lib/domain/types'
import { riyalsToHalalas } from '@/lib/domain/money'
import { finalizeDueAuctions, getListingDetail } from '@/lib/server/market-service'
import type { Order } from '@/lib/domain/types'
import { getRevenue } from '@/lib/server/admin-service'
import { startOrderPayment } from '@/lib/server/checkout-service'
import { releaseOrderEscrow, submitTransferProof } from '@/lib/server/escrow-service'
import { markPaymentPaid } from '@/lib/server/payment-service'
import { chargeOrderCommission } from '@/lib/server/commission-service'

let db: MemoryDatabase
let store: MemoryStore
const adminId = () => db.admins[0].id

const percentSide = (percent: number, extra: Partial<CommissionSide> = {}): CommissionSide => ({
  enabled: true,
  mode: 'percent',
  percent,
  fixed: 0,
  min: 0,
  max: 0,
  ...extra,
})

beforeEach(() => {
  db = emptyDatabase()
  seedDatabase(db)
  store = new MemoryStore(db)
  resetStoreForTests(store)
})

describe('حساب العمولة', () => {
  const noVat = { enabled: false, percent: 0 }

  it('النسبة تُحسب من قيمة الصفقة', () => {
    const result = computeCommissionSide(percentSide(2.5), riyalsToHalalas(100_000), noVat)
    expect(result.base).toBe(riyalsToHalalas(2_500))
    expect(result.vat).toBe(0)
    expect(result.total).toBe(riyalsToHalalas(2_500))
  })

  it('المبلغ الثابت يتجاهل قيمة الصفقة', () => {
    const side: CommissionSide = {
      enabled: true,
      mode: 'fixed',
      percent: 0,
      fixed: riyalsToHalalas(500),
      min: 0,
      max: 0,
    }
    expect(computeCommissionSide(side, riyalsToHalalas(10_000), noVat).base).toBe(
      riyalsToHalalas(500),
    )
    expect(computeCommissionSide(side, riyalsToHalalas(900_000), noVat).base).toBe(
      riyalsToHalalas(500),
    )
  })

  it('الحدّان يقيّدان الأساس', () => {
    const side = percentSide(2.5, { min: riyalsToHalalas(200), max: riyalsToHalalas(3_000) })
    // 2.5٪ من 1,000 = 25 → يرتفع إلى الحدّ الأدنى
    expect(computeCommissionSide(side, riyalsToHalalas(1_000), noVat).base).toBe(
      riyalsToHalalas(200),
    )
    // 2.5٪ من 500,000 = 12,500 → ينزل إلى السقف
    expect(computeCommissionSide(side, riyalsToHalalas(500_000), noVat).base).toBe(
      riyalsToHalalas(3_000),
    )
  })

  it('المعطّلة صفر، والصفقة الصفرية بلا عمولة', () => {
    expect(computeCommissionSide({ ...percentSide(5), enabled: false }, 100_000, noVat).total).toBe(0)
    expect(computeCommissionSide(percentSide(5), 0, noVat).total).toBe(0)
  })

  it('العمولة لا تتجاوز قيمة الصفقة مهما كانت الإعدادات', () => {
    const side: CommissionSide = {
      enabled: true,
      mode: 'fixed',
      percent: 0,
      fixed: riyalsToHalalas(10_000),
      min: 0,
      max: 0,
    }
    expect(computeCommissionSide(side, riyalsToHalalas(400), noVat).base).toBe(riyalsToHalalas(400))
  })

  it('الضريبة تُحتسب على العمولة وحدها لا على قيمة اللوحة', () => {
    const amount = riyalsToHalalas(100_000)
    const result = computeCommissionSide(percentSide(2), amount, { enabled: true, percent: 15 })
    expect(result.base).toBe(riyalsToHalalas(2_000))
    expect(result.vat).toBe(riyalsToHalalas(300)) // 15٪ من 2,000 لا من 100,000
    expect(result.total).toBe(riyalsToHalalas(2_300))
  })

  it('السقف يقيّد الأساس قبل الضريبة فتُحتسب فوقه', () => {
    const side = percentSide(10, { max: riyalsToHalalas(1_000) })
    const result = computeCommissionSide(side, riyalsToHalalas(100_000), {
      enabled: true,
      percent: 15,
    })
    expect(result.base).toBe(riyalsToHalalas(1_000))
    expect(result.total).toBe(riyalsToHalalas(1_150))
  })

  it('يجمع عمولتي الطرفين', () => {
    const result = computeCommission(
      {
        ...DEFAULT_COMMISSION_SETTINGS,
        seller: percentSide(2),
        buyer: percentSide(1),
        vatEnabled: false,
      },
      riyalsToHalalas(100_000),
    )
    expect(result.seller.total).toBe(riyalsToHalalas(2_000))
    expect(result.buyer.total).toBe(riyalsToHalalas(1_000))
    expect(result.total).toBe(riyalsToHalalas(3_000))
  })
})

describe('اقتطاع العمولة عند اكتمال الصفقة', () => {
  async function soldAuction() {
    const listing = db.listings.find(
      (l) => l.saleType === 'auction' && l.depositAmount > 0 && l.status === 'active',
    )!
    await store.updateListing(listing.id, {
      reservePrice: 0,
      endsAt: new Date(Date.now() - 1000).toISOString(),
    })
    await finalizeDueAuctions(store)
    return (await store.listOrders({ listingId: listing.id }))[0]
  }

  /**
   * يُتمّ الصفقة **بالسداد الحقيقي** لا باختصار الأدمن.
   *
   * صار الإتمام يشترط دفعة مختومة — فالبائع (والأدمن) لا يُغلق صفقة لم يدفع
   * فيها المشتري ريالًا. والاختبار يمرّ بما يمرّ به المستخدم.
   */
  async function settle(order: Order) {
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
    const started = await startOrderPayment({
      orderId: order.id,
      userId: order.buyerId,
      method: 'bank_transfer',
    })
    const rows = await store.listPayments({ userId: order.buyerId })
    const payment = rows.find((p) => p.reference === started.paymentReference)!
    await markPaymentPaid({ paymentId: payment.id, adminId: adminId(), note: null })

    /*
     * والمسار كاملًا: السداد يحجز، وعمولة البائع تُخصم من عائده لحظة الإفراج.
     * فما يختبر «اقتطاع العمولة من الطرفين» يحتاج الإفراج لا التحصيل وحده.
     */
    await submitTransferProof({
      orderId: order.id,
      sellerId: order.sellerId,
      note: 'نُقلت الملكية — اختبار',
    })
    await releaseOrderEscrow((await store.getOrder(order.id))!, { by: 'admin', adminId: adminId() })
  }

  async function enableCommission(percent = 2) {
    await store.updateCommissionSettings({
      seller: percentSide(percent),
      buyer: percentSide(percent),
      vatEnabled: true,
      vatPercent: 15,
    })
  }

  it('لا عمولة ما دامت معطّلة', async () => {
    const order = await soldAuction()
    await settle(order)
    expect(await store.listPlatformEntries({ orderId: order.id })).toHaveLength(0)
  })

  it('تُقتطع من الطرفين وتُقيَّد في حساب المنصّة مع ضريبتها', async () => {
    await enableCommission()
    const order = await soldAuction()
    const sellerBefore = await store.getWallet(order.sellerId)

    await settle(order)

    const entries = await store.listPlatformEntries({ orderId: order.id })
    const types = entries.map((e) => e.type).sort()
    expect(types).toEqual([
      'commission_buyer',
      'commission_seller',
      'vat_buyer',
      'vat_seller',
    ])

    /*
     * البائع **يقبض** لا يدفع: عائده = قيمة الصفقة ناقص عمولته وضريبتها،
     * تُخصمان من العائد لا من محفظته.
     */
    const sellerAfter = await store.getWallet(order.sellerId)
    const sellerShare = entries
      .filter((e) => e.userId === order.sellerId)
      .reduce((sum, e) => sum + e.amount, 0)
    expect(sellerAfter.balance - sellerBefore.balance).toBe(order.amount - sellerShare)
    expect(entries.every((e) => e.settled)).toBe(true)
  })

  it('لا تُقتطع مرّتين لو أُعيد تعليم الصفقة مكتملة', async () => {
    await enableCommission()
    const order = await soldAuction()
    await settle(order)
    const before = await store.listPlatformEntries({ orderId: order.id })

    await chargeOrderCommission((await store.getOrder(order.id))!, adminId())
    expect(await store.listPlatformEntries({ orderId: order.id })).toHaveLength(before.length)
  })

  it('عمولة بائع تبتلع العائد: يُقبض ما بقي ولا يُقيَّد مستحقًّا', async () => {
    // عمولة ضخمة — وتحت نموذج الضمان تُخصم من العائد فلا تصير «مستحقّة»
    await store.updateCommissionSettings({
      seller: percentSide(50),
      buyer: { ...percentSide(0), enabled: false },
      vatEnabled: false,
      vatPercent: 0,
    })
    const order = await soldAuction()
    const before = (await store.getWallet(order.sellerId)).balance
    await settle(order)

    expect((await store.getOrder(order.id))!.status).toBe('completed')

    /*
     * لا فرع «مستحقّة» على البائع بعد اليوم: كان يقع لأن العمولة تُقتطع من
     * محفظته قبل أن يقبض، والآن تُخصم ممّا يقبض.
     */
    expect(await store.listPlatformEntries({ orderId: order.id, settled: false })).toHaveLength(0)

    const dues = (await store.listPlatformEntries({ orderId: order.id })).reduce(
      (sum, e) => sum + e.amount,
      0,
    )
    expect((await store.getWallet(order.sellerId)).balance - before).toBe(order.amount - dues)
  })

  it('تقرير الإيرادات يفصل المُحصَّل عن المستحقّ', async () => {
    await enableCommission()
    const order = await soldAuction()
    await settle(order)

    const revenue = await getRevenue()
    expect(revenue.rows.length).toBeGreaterThan(0)
    expect(revenue.totals.commission).toBeGreaterThan(0)
    expect(revenue.totals.vat).toBeGreaterThan(0)
    expect(revenue.totals.due).toBe(0)
    expect(revenue.totals.settled).toBe(revenue.totals.commission + revenue.totals.vat)
  })
})

/*
 * العمولة تُعرض على السعر القائم لكل طريقة بيع — والسوم كان يسقط بينها.
 *
 * `offers` لا سعر افتتاح لها ولا مزايدات، فكانت تقع في فرع المزاد فتُقرأ
 * `startingPrice` وهي صفرٌ في هذا النوع — والعمولة على صفرٍ صفر. فيقرأ من
 * يعرض لوحته على السوم أنّ لا عمولة عليه، وتُقتطع منه عند القبول.
 */
describe('العمولة المعروضة على صفحة اللوحة', () => {
  beforeEach(async () => {
    await store.updateCommissionSettings({
      ...DEFAULT_COMMISSION_SETTINGS,
      seller: percentSide(2.5),
      buyer: percentSide(1.5),
      vatEnabled: true,
      vatPercent: 15,
    })
  })

  it('لوحة على السوم: تُحسب على أقل عرض مقبول لا على صفر', async () => {
    const listing = db.listings.find(
      (row) => row.saleType === 'offers' && row.status === 'active' && row.minimumOffer > 0,
    )!
    const detail = await getListingDetail(listing.id, null)

    expect(listing.startingPrice, 'البذرة لا تضع سعر افتتاح للسوم').toBe(0)
    expect(detail.commission.seller.base).toBe(Math.round((listing.minimumOffer * 2.5) / 100))
    expect(detail.commission.buyer.base).toBe(Math.round((listing.minimumOffer * 1.5) / 100))
    expect(detail.commission.seller.total).toBeGreaterThan(0)
  })

  it('البيع المباشر على سعره، والمزاد على أعلى مزايدة قائمة', async () => {
    const fixed = db.listings.find((row) => row.saleType === 'fixed' && row.status === 'active')!
    const fixedDetail = await getListingDetail(fixed.id, null)
    expect(fixedDetail.commission.buyer.base).toBe(Math.round((fixed.price * 1.5) / 100))

    const auction = db.listings.find(
      (row) => row.saleType === 'auction' && row.status === 'active',
    )!
    const auctionDetail = await getListingDetail(auction.id, null)
    const basis = auctionDetail.highestAmount ?? auction.startingPrice
    expect(auctionDetail.commission.buyer.base).toBe(Math.round((basis * 1.5) / 100))
  })

  it('والضريبة على العمولة وحدها لا على قيمة اللوحة', async () => {
    const fixed = db.listings.find((row) => row.saleType === 'fixed' && row.status === 'active')!
    const { commission } = await getListingDetail(fixed.id, null)
    expect(commission.buyer.vat).toBe(Math.round((commission.buyer.base * 15) / 100))
    expect(commission.buyer.total).toBe(commission.buyer.base + commission.buyer.vat)
  })
})

/*
 * قاعدة عمولة المشتري تصل الواجهة كما هي.
 *
 * السوم مبلغٌ يكتبه صاحبه، فلا تصلح له حصيلةٌ محسوبةٌ على أقلّ عرضٍ مقبول —
 * والواجهة تحسبها على ما يُكتب بالدالّة نفسها. فإن لم تصل القاعدة صحيحةً
 * عُرض للمشتري رسمٌ غير ما يُقتطع منه.
 */
describe('قاعدة العمولة المرسلة إلى الواجهة', () => {
  const listingOf = () =>
    db.listings.find((row) => row.saleType === 'offers' && row.status === 'active')!

  it('تُنقل بحدودها كما ضُبطت — وتُطابق ما يحسبه الخادم على أيّ مبلغ', async () => {
    const buyer = percentSide(2, { max: riyalsToHalalas(500) })
    await store.updateCommissionSettings({
      ...DEFAULT_COMMISSION_SETTINGS,
      seller: percentSide(2.5),
      buyer,
      vatEnabled: true,
      vatPercent: 15,
    })

    const { commission } = await getListingDetail(listingOf().id, null)
    expect(commission.buyerRule).toEqual(buyer)

    // ما تحسبه الواجهة على مبلغٍ يكتبه صاحبه = ما يحسبه الخادم عليه
    const typed = riyalsToHalalas(45_000)
    const onScreen = computeCommissionSide(commission.buyerRule, typed, {
      enabled: commission.vatEnabled,
      percent: commission.vatPercent,
    })
    expect(onScreen.base, 'لم يُحترم السقف').toBe(riyalsToHalalas(500))
    expect(onScreen.vat).toBe(Math.round((onScreen.base * 15) / 100))
    expect(onScreen).toEqual(computeCommission(await store.getCommissionSettings(), typed).buyer)
  })

  it('ومعطّلةً تصل معطّلة — فلا يُعرض رسمٌ لا وجود له', async () => {
    await store.updateCommissionSettings({
      ...DEFAULT_COMMISSION_SETTINGS,
      buyer: { ...percentSide(2), enabled: false },
    })
    const { commission } = await getListingDetail(listingOf().id, null)
    expect(commission.buyerRule.enabled).toBe(false)
    expect(
      computeCommissionSide(commission.buyerRule, riyalsToHalalas(45_000), {
        enabled: commission.vatEnabled,
        percent: commission.vatPercent,
      }).total,
    ).toBe(0)
  })
})
