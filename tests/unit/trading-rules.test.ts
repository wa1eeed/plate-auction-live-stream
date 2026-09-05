import { describe, expect, it } from 'vitest'
import {
  TradeError,
  assertBidIsValid,
  assertCanBuyNow,
  assertCanOffer,
  computeExtension,
  computeNextBidAmount,
  findHighestBid,
  isTradeError,
  maskName,
  publicReserveState,
  reserveGap,
  resolveAuctionOutcome,
} from '@/lib/domain/auction'
import { riyalsToHalalas } from '@/lib/domain/money'
import type { Bid, Listing } from '@/lib/domain/types'

const NOW = Date.UTC(2026, 0, 1, 12, 0, 0)
const SELLER = 'usr_seller'
const BUYER = 'usr_buyer'

function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 'lst_1',
    reference: 'L26-00001',
    sellerId: SELLER,
    plateType: 'private',
    plateFormat: 'long',
    arabicLetters: 'أ',
    latinLetters: 'A',
    plateNumbers: '1',
    emblem: 'palm-swords-black',
    customEmblemUrl: null,
    description: null,
    saleType: 'auction',
    status: 'active',
    price: 0,
    startingPrice: riyalsToHalalas(10_000),
    minimumIncrement: riyalsToHalalas(500),
    reservePrice: riyalsToHalalas(20_000),
    minimumOffer: 0,
    durationSeconds: 3600,
    extensionTriggerSeconds: 300,
    extensionDurationSeconds: 300,
    extensionResetsTimer: true,
    allowCustomBid: true,
  depositAmount: 0,
  paymentWindowHours: 48,
  forfeitPercent: 100,
  forfeitUndoWindowHours: 24,
  escrowTransferWindowHours: 72,
  escrowReviewWindowHours: 72,
  escrowDisputeWindowHours: 168,
  escrowReleaseUndoWindowHours: 24,
  refundDepositOnLoss: true,
    startsAt: new Date(NOW - 60_000).toISOString(),
    endsAt: new Date(NOW + 3_600_000).toISOString(),
    endedAt: null,
    highestBidId: null,
    soldToUserId: null,
    soldAmount: 0,
    viewCount: 0,
    createdAt: new Date(NOW).toISOString(),
    updatedAt: new Date(NOW).toISOString(),
    ...overrides,
  }
}

const validation = (listing: Listing, overrides: Record<string, unknown> = {}) => ({
  listing,
  nowMs: NOW,
  amount: listing.startingPrice,
  highestAmount: null,
  highestBidderId: null,
  bidderId: BUYER,
  isCustomAmount: false,
  ...overrides,
})

function expectCode(fn: () => void, code: string) {
  try {
    fn()
    throw new Error(`كان يجب أن يرمي ${code}`)
  } catch (error) {
    expect(isTradeError(error)).toBe(true)
    expect((error as TradeError).code).toBe(code)
  }
}

describe('المزايدة التالية المطلوبة', () => {
  it('السعر الافتتاحي عند غياب أي مزايدة', () => {
    expect(computeNextBidAmount(makeListing(), null)).toBe(riyalsToHalalas(10_000))
  })

  it('أعلى مزايدة + الحد الأدنى للزيادة', () => {
    expect(computeNextBidAmount(makeListing(), riyalsToHalalas(12_000))).toBe(riyalsToHalalas(12_500))
  })
})

describe('التحقق من المزايدة', () => {
  it('يرفض المزايدة الأقل من الحد المطلوب', () => {
    expectCode(
      () => assertBidIsValid(validation(makeListing(), { amount: riyalsToHalalas(9_999) })),
      'AMOUNT_TOO_LOW',
    )
  })

  it('يرفض المزايدة بعد انتهاء الوقت', () => {
    expectCode(
      () => assertBidIsValid(validation(makeListing({ endsAt: new Date(NOW - 1).toISOString() }))),
      'AUCTION_ENDED',
    )
  })

  it('يمنع البائع من المزايدة على إعلانه', () => {
    expectCode(() => assertBidIsValid(validation(makeListing(), { bidderId: SELLER })), 'OWN_LISTING')
  })

  it('يمنع أعلى مزايد من المزايدة على نفسه', () => {
    expectCode(
      () =>
        assertBidIsValid(
          validation(makeListing(), {
            highestAmount: riyalsToHalalas(11_000),
            highestBidderId: BUYER,
            amount: riyalsToHalalas(11_500),
          }),
        ),
      'ALREADY_HIGHEST',
    )
  })

  it('يرفض المزايدة على إعلان بيع مباشر أو غير نشط', () => {
    expectCode(() => assertBidIsValid(validation(makeListing({ saleType: 'fixed' }))), 'NOT_AN_AUCTION')
    expectCode(
      () => assertBidIsValid(validation(makeListing({ status: 'scheduled' }))),
      'AUCTION_NOT_STARTED',
    )
    expectCode(() => assertBidIsValid(validation(makeListing({ status: 'sold' }))), 'LISTING_NOT_ACTIVE')
  })

  it('يرفض المبلغ المخصص عند تعطيله', () => {
    expectCode(
      () =>
        assertBidIsValid(
          validation(makeListing({ allowCustomBid: false }), {
            isCustomAmount: true,
            amount: riyalsToHalalas(15_000),
          }),
        ),
      'CUSTOM_BID_NOT_ALLOWED',
    )
  })

  it('يقبل المزايدة الصحيحة', () => {
    expect(() => assertBidIsValid(validation(makeListing()))).not.toThrow()
  })
})

describe('الشراء المباشر', () => {
  const fixed = makeListing({ saleType: 'fixed', price: riyalsToHalalas(30_000), endsAt: null })

  it('يقبل الشراء من مشترٍ آخر', () => {
    expect(() => assertCanBuyNow(fixed, BUYER)).not.toThrow()
  })

  it('يمنع البائع من شراء إعلانه', () => {
    expectCode(() => assertCanBuyNow(fixed, SELLER), 'OWN_LISTING')
  })

  it('يرفض الشراء من إعلان مزاد أو مباع', () => {
    expectCode(() => assertCanBuyNow(makeListing(), BUYER), 'NOT_FOR_SALE')
    expectCode(() => assertCanBuyNow({ ...fixed, status: 'sold' }, BUYER), 'LISTING_NOT_ACTIVE')
  })
})

describe('العروض', () => {
  const offersListing = makeListing({
    saleType: 'offers',
    minimumOffer: riyalsToHalalas(7_000),
    endsAt: null,
  })

  it('يقبل عرضًا يبلغ الحد الأدنى', () => {
    expect(() => assertCanOffer(offersListing, BUYER, riyalsToHalalas(7_000))).not.toThrow()
  })

  it('يرفض عرضًا دون الحد الأدنى', () => {
    expectCode(() => assertCanOffer(offersListing, BUYER, riyalsToHalalas(6_999)), 'AMOUNT_TOO_LOW')
  })

  it('يرفض العروض على إعلان لا يستقبلها', () => {
    expectCode(() => assertCanOffer(makeListing(), BUYER, riyalsToHalalas(50_000)), 'NOT_ACCEPTING_OFFERS')
  })

  it('يمنع البائع من العرض على إعلانه', () => {
    expectCode(() => assertCanOffer(offersListing, SELLER, riyalsToHalalas(9_000)), 'OWN_LISTING')
  })
})

describe('التمديد التلقائي', () => {
  it('يمدّد عند المزايدة داخل نافذة التمديد', () => {
    const listing = makeListing({ endsAt: new Date(NOW + 120_000).toISOString() })
    const result = computeExtension(listing, NOW)
    expect(result.extended).toBe(true)
    expect(new Date(result.endsAt).getTime()).toBe(NOW + 300_000)
  })

  it('لا يمدّد عند بقاء وقت أطول', () => {
    const listing = makeListing({ endsAt: new Date(NOW + 900_000).toISOString() })
    expect(computeExtension(listing, NOW).extended).toBe(false)
  })

  it('يضيف المدة بدل إعادة الضبط عند تعطيل إعادة الضبط', () => {
    const listing = makeListing({
      endsAt: new Date(NOW + 60_000).toISOString(),
      extensionResetsTimer: false,
    })
    expect(new Date(computeExtension(listing, NOW).endsAt).getTime()).toBe(NOW + 360_000)
  })
})

describe('النتيجة والسعر الاحتياطي', () => {
  it('يحسم النتيجة حسب بلوغ الاحتياطي', () => {
    expect(resolveAuctionOutcome(makeListing(), riyalsToHalalas(20_000))).toBe('sold')
    expect(resolveAuctionOutcome(makeListing(), riyalsToHalalas(19_999))).toBe('reserve_not_met')
    expect(resolveAuctionOutcome(makeListing(), null)).toBe('no_bids')
  })

  it('يحسب الفارق المتبقي للبائع', () => {
    expect(reserveGap(makeListing(), riyalsToHalalas(15_000))).toBe(riyalsToHalalas(5_000))
    expect(reserveGap(makeListing(), riyalsToHalalas(21_000))).toBe(0)
  })

  it('يعرض الحالة فقط بلا رقم، ولا شيء بلا سعر احتياطي', () => {
    expect(publicReserveState(makeListing(), riyalsToHalalas(25_000))).toBe('met')
    expect(publicReserveState(makeListing(), riyalsToHalalas(5_000))).toBe('not_met')
    expect(publicReserveState(makeListing({ reservePrice: 0 }), riyalsToHalalas(5_000))).toBe('unknown')
    expect(publicReserveState(makeListing({ saleType: 'fixed' }), null)).toBe('unknown')
  })
})

describe('أعلى مزايدة وإخفاء الأسماء', () => {
  const bid = (id: string, amount: number, sequence: number, status: Bid['status'] = 'accepted'): Bid => ({
    id,
    listingId: 'lst_1',
    bidderId: `usr_${id}`,
    amount: riyalsToHalalas(amount),
    status,
    serverSequence: sequence,
    createdAt: new Date(NOW).toISOString(),
    cancelledAt: null,
    cancellationReason: null,
  })

  it('يتجاهل المزايدات الملغاة', () => {
    expect(findHighestBid([bid('a', 10_000, 1), bid('b', 15_000, 2, 'cancelled'), bid('c', 12_000, 3)])?.id).toBe('c')
  })

  it('يفضّل الأسبق تسلسلًا عند تساوي المبلغ', () => {
    expect(findHighestBid([bid('a', 12_000, 5), bid('b', 12_000, 2)])?.id).toBe('b')
  })

  it('يخفي أجزاء الاسم', () => {
    expect(maskName('خالد العتيبي')).toBe('خالد ا******')
    expect(maskName('خالد')).toBe('خالد')
  })
})
