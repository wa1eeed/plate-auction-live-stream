/**
 * قواعد التداول النقية — بلا أي اعتماد على قاعدة البيانات أو الواجهة.
 * كل قاعدة حرجة تعيش هنا وتُستدعى من الخادم فقط.
 */
import type { Halalas } from './money'
import type { Bid, Listing, ListingStatus, PublicReserveState } from './types'

export const TRADE_ERROR_CODES = [
  'LISTING_NOT_ACTIVE',
  'AUCTION_ENDED',
  'AUCTION_NOT_STARTED',
  'NOT_AN_AUCTION',
  'NOT_FOR_SALE',
  'NOT_ACCEPTING_OFFERS',
  'AMOUNT_TOO_LOW',
  'CUSTOM_BID_NOT_ALLOWED',
  'INVALID_AMOUNT',
  'ALREADY_HIGHEST',
  'OWN_LISTING',
  'RATE_LIMITED',
] as const

export type TradeErrorCode = (typeof TRADE_ERROR_CODES)[number]

export const TRADE_ERROR_MESSAGES: Record<TradeErrorCode, string> = {
  LISTING_NOT_ACTIVE: 'هذا الإعلان غير متاح للتداول حاليًا.',
  AUCTION_ENDED: 'انتهى وقت المزاد.',
  AUCTION_NOT_STARTED: 'لم يبدأ المزاد بعد.',
  NOT_AN_AUCTION: 'هذا الإعلان ليس مزادًا.',
  NOT_FOR_SALE: 'هذا الإعلان ليس بيعًا مباشرًا.',
  NOT_ACCEPTING_OFFERS: 'هذا الإعلان لا يستقبل عروضًا.',
  AMOUNT_TOO_LOW: 'المبلغ أقل من الحد المطلوب.',
  CUSTOM_BID_NOT_ALLOWED: 'إدخال مبلغ مخصص غير مسموح في هذا المزاد.',
  INVALID_AMOUNT: 'المبلغ غير صالح.',
  ALREADY_HIGHEST: 'أنت بالفعل صاحب أعلى مزايدة.',
  OWN_LISTING: 'لا يمكنك التداول على إعلانك.',
  RATE_LIMITED: 'محاولات كثيرة بوقت قصير، انتظر لحظة.',
}

export class TradeError extends Error {
  /** علامة بنيوية: `instanceof` غير موثوق عبر حدود الحزم. */
  readonly isTradeError = true as const
  readonly code: TradeErrorCode
  constructor(code: TradeErrorCode) {
    super(TRADE_ERROR_MESSAGES[code])
    this.name = 'TradeError'
    this.code = code
  }
}

export function isTradeError(error: unknown): error is TradeError {
  return typeof error === 'object' && error !== null && (error as TradeError).isTradeError === true
}

// ---------------------------------------------------------------- المزايدة

/**
 * المزايدة التالية المطلوبة:
 * لا توجد مزايدة ⇒ السعر الافتتاحي، وإلا أعلى مزايدة + الحد الأدنى للزيادة.
 */
export function computeNextBidAmount(
  listing: Pick<Listing, 'startingPrice' | 'minimumIncrement'>,
  highestAmount: Halalas | null,
): Halalas {
  if (highestAmount === null || highestAmount <= 0) return listing.startingPrice
  return highestAmount + listing.minimumIncrement
}

export type BidValidationInput = {
  listing: Listing
  nowMs: number
  amount: Halalas
  highestAmount: Halalas | null
  highestBidderId: string | null
  bidderId: string
  isCustomAmount: boolean
}

/** التحقق الكامل من المزايدة. يُنفَّذ على الخادم فقط ويرمي `TradeError`. */
export function assertBidIsValid(input: BidValidationInput): void {
  const { listing, nowMs, amount, highestAmount, highestBidderId, bidderId } = input

  if (listing.saleType !== 'auction') throw new TradeError('NOT_AN_AUCTION')
  if (listing.sellerId === bidderId) throw new TradeError('OWN_LISTING')
  if (listing.status === 'scheduled') throw new TradeError('AUCTION_NOT_STARTED')
  if (listing.status !== 'active') throw new TradeError('LISTING_NOT_ACTIVE')
  if (!listing.endsAt || new Date(listing.endsAt).getTime() <= nowMs) throw new TradeError('AUCTION_ENDED')
  if (!Number.isInteger(amount) || amount <= 0) throw new TradeError('INVALID_AMOUNT')
  if (input.isCustomAmount && !listing.allowCustomBid) throw new TradeError('CUSTOM_BID_NOT_ALLOWED')
  if (highestBidderId && highestBidderId === bidderId) throw new TradeError('ALREADY_HIGHEST')

  const required = computeNextBidAmount(listing, highestAmount)
  if (amount < required) throw new TradeError('AMOUNT_TOO_LOW')

  if (input.isCustomAmount && listing.minimumIncrement > 0) {
    const excess = amount - required
    if (excess % listing.minimumIncrement !== 0) throw new TradeError('INVALID_AMOUNT')
  }
}

/** التحقق من الشراء المباشر. */
export function assertCanBuyNow(listing: Listing, buyerId: string): void {
  if (listing.saleType !== 'fixed') throw new TradeError('NOT_FOR_SALE')
  if (listing.sellerId === buyerId) throw new TradeError('OWN_LISTING')
  if (listing.status !== 'active') throw new TradeError('LISTING_NOT_ACTIVE')
  if (listing.price <= 0) throw new TradeError('INVALID_AMOUNT')
}

/** التحقق من إرسال عرض. */
export function assertCanOffer(listing: Listing, buyerId: string, amount: Halalas): void {
  if (listing.saleType !== 'offers') throw new TradeError('NOT_ACCEPTING_OFFERS')
  if (listing.sellerId === buyerId) throw new TradeError('OWN_LISTING')
  if (listing.status !== 'active') throw new TradeError('LISTING_NOT_ACTIVE')
  if (!Number.isInteger(amount) || amount <= 0) throw new TradeError('INVALID_AMOUNT')
  if (listing.minimumOffer > 0 && amount < listing.minimumOffer) throw new TradeError('AMOUNT_TOO_LOW')
}

// ---------------------------------------------------------------- الوقت

export type ExtensionResult = { extended: boolean; endsAt: string; addedSeconds: number }

/**
 * التمديد التلقائي: مزايدة صحيحة في آخر `extensionTriggerSeconds` تمدّد المزاد،
 * إما بإعادة ضبط المؤقت أو بإضافة المدة، حسب إعداد البائع.
 */
export function computeExtension(listing: Listing, nowMs: number): ExtensionResult {
  const currentEnd = listing.endsAt ? new Date(listing.endsAt).getTime() : nowMs
  const left = Math.max(0, currentEnd - nowMs)
  const triggerMs = listing.extensionTriggerSeconds * 1000
  const extensionMs = listing.extensionDurationSeconds * 1000

  if (triggerMs <= 0 || extensionMs <= 0 || left > triggerMs) {
    return { extended: false, endsAt: new Date(currentEnd).toISOString(), addedSeconds: 0 }
  }

  const nextEnd = listing.extensionResetsTimer ? nowMs + extensionMs : currentEnd + extensionMs
  return {
    extended: true,
    endsAt: new Date(nextEnd).toISOString(),
    addedSeconds: Math.round((nextEnd - currentEnd) / 1000),
  }
}

/** الوقت المتبقي بالمللي ثانية. */
export function remainingMs(listing: Pick<Listing, 'endsAt'>, nowMs: number): number {
  if (!listing.endsAt) return 0
  return Math.max(0, new Date(listing.endsAt).getTime() - nowMs)
}

// ---------------------------------------------------------------- النتائج

/** نتيجة المزاد عند انتهاء الوقت. */
export function resolveAuctionOutcome(
  listing: Pick<Listing, 'reservePrice'>,
  highestAmount: Halalas | null,
): Extract<ListingStatus, 'sold' | 'reserve_not_met' | 'no_bids'> {
  if (highestAmount === null) return 'no_bids'
  return highestAmount >= listing.reservePrice ? 'sold' : 'reserve_not_met'
}

/** الفارق المتبقّي للوصول إلى السعر الاحتياطي — للبائع فقط. */
export function reserveGap(
  listing: Pick<Listing, 'reservePrice'>,
  highestAmount: Halalas | null,
): Halalas {
  return Math.max(0, listing.reservePrice - (highestAmount ?? 0))
}

/** حالة السعر الاحتياطي كما تُعرض للجمهور — بلا أي رقم. */
export function publicReserveState(
  listing: Pick<Listing, 'reservePrice' | 'status' | 'saleType'>,
  highestAmount: Halalas | null,
): PublicReserveState {
  if (listing.saleType !== 'auction' || listing.reservePrice <= 0) return 'unknown'
  const met = highestAmount !== null && highestAmount >= listing.reservePrice
  const finished = ['sold', 'reserve_not_met', 'no_bids'].includes(listing.status)
  if (finished) return met ? 'met' : 'not_met'
  return met ? 'met' : 'not_met'
}

/** أعلى مزايدة مقبولة (الأسبق تسلسلًا عند التساوي). */
export function findHighestBid(bids: Bid[]): Bid | null {
  let best: Bid | null = null
  for (const bid of bids) {
    if (bid.status !== 'accepted') continue
    if (
      !best ||
      bid.amount > best.amount ||
      (bid.amount === best.amount && bid.serverSequence < best.serverSequence)
    ) {
      best = bid
    }
  }
  return best
}

/** إخفاء جزء من اسم المزايد — لا تُعرض الأسماء كاملة للعامة. */
export function maskName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'مستخدم'
  return parts
    .map((part, index) => {
      if (index === 0) return part
      const chars = Array.from(part)
      return `${chars[0] ?? ''}${'*'.repeat(Math.max(1, chars.length - 1))}`
    })
    .join(' ')
}

/** أزرار المبالغ السريعة المقترحة. */
export function quickBidSteps(minimumIncrement: Halalas, nextAmount: Halalas): Halalas[] {
  const base = minimumIncrement
  const candidates = new Set<Halalas>([base, base * 2, base * 5, base * 10])
  const HIGH_VALUE_THRESHOLD = 50_000 * 100
  if (nextAmount >= HIGH_VALUE_THRESHOLD) candidates.add(base * 20)
  return Array.from(candidates)
    .filter((value) => value > 0)
    .sort((a, b) => a - b)
    .slice(0, 4)
}
