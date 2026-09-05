import {
  assertCanOffer,
  computeNextBidAmount,
  findHighestBid,
  isTradeError,
  maskName,
  publicReserveState,
  remainingMs,
  reserveGap,
  resolveAuctionOutcome,
} from '@/lib/domain/auction'
import { formatAmount, riyalsToHalalas } from '@/lib/domain/money'
import type {
  AccountBid,
  AccountListing,
  AccountOffer,
  AccountOrder,
  Listing,
  ListingCard,
  PublicSeller,
  ListingDetail,
  ListingEventType,
  ListingStatus,
  Offer,
  Order,
  Plate,
  SaleType,
} from '@/lib/domain/types'
import { availableBalance, computeCommission } from '@/lib/domain/types'
import { buildOrderSettlement, buildOrderTimeline } from '@/lib/domain/order-timeline'
import {
  assertDepositEligibility,
  isWalletError,
  paymentDueAt,
  requiresDeposit,
} from '@/lib/domain/wallet'
import { config } from '@/lib/config'
import { getStore } from '@/lib/store'
import type { AuctionStore } from '@/lib/store/types'
import { MARKET_TOPIC, listingTopic, publishRealtime } from './realtime'
import { notify, notifyMany } from './notification-service'
import { rateLimit } from './rate-limit'

export class ServiceError extends Error {
  /** علامة بنيوية: `instanceof` غير موثوق عبر حدود الحزم. */
  readonly isServiceError = true as const
  readonly status: number
  readonly code: string
  constructor(message: string, status = 400, code = 'BAD_REQUEST') {
    super(message)
    this.name = 'ServiceError'
    this.status = status
    this.code = code
  }
}

export function isServiceError(error: unknown): error is ServiceError {
  return typeof error === 'object' && error !== null && (error as ServiceError).isServiceError === true
}

function toPlate(listing: Listing): Plate {
  return {
    plateType: listing.plateType,
    plateFormat: listing.plateFormat,
    arabicLetters: listing.arabicLetters,
    latinLetters: listing.latinLetters,
    plateNumbers: listing.plateNumbers,
    emblem: listing.emblem,
    customEmblemUrl: listing.customEmblemUrl,
  }
}

/**
 * يسجّل الحدث ثم يدفعه لحظيًا إلى مشتركي الإعلان ومشتركي السوق معًا،
 * فتتحدّث صفحة الإعلان وشبكة السوق في اللحظة نفسها.
 */
async function publish(
  store: AuctionStore,
  listingId: string,
  eventType: ListingEventType,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await store.appendEvent({ listingId, eventType, payload })
  publishRealtime([listingTopic(listingId), MARKET_TOPIC], eventType, { ...payload, listingId })
}

/**
 * إشعارات نتيجة المزاد.
 *
 * ثلاثة أطراف تحتاج أن تعرف: الفائز ليسدّد قبل انقضاء مهلته، والخاسرون ليعرفوا
 * أن عربونهم عاد، والبائع ليعرف أن لوحته رست أو لم تبلغ احتياطيه.
 */
async function notifyAuctionOutcome(
  store: AuctionStore,
  listing: Listing,
  outcome: Listing['status'],
  winnerId: string | null,
  amount: number | null,
): Promise<void> {
  const label = `${listing.arabicLetters} ${listing.plateNumbers}`
  const bidders = new Set(
    (await store.listBids(listing.id))
      .filter((bid) => bid.status === 'accepted')
      .map((bid) => bid.bidderId),
  )

  if (outcome === 'sold' && winnerId) {
    await notify(store, {
      userId: winnerId,
      type: 'auction_won',
      title: 'رست عليك اللوحة',
      body: `فزت بـ«${label}» بـ${formatAmount(amount ?? 0)} ريال — أتمّ السداد خلال ${listing.paymentWindowHours} ساعة.`,
      href: '/account/purchases',
      listingId: listing.id,
    })
    await notify(store, {
      userId: listing.sellerId,
      type: 'listing_sold',
      title: 'رست لوحتك على مزايد',
      body: `«${label}» بـ${formatAmount(amount ?? 0)} ريال.`,
      href: '/account/sales',
      listingId: listing.id,
    })
    bidders.delete(winnerId)
    await notifyMany(store, [...bidders], () => ({
      type: 'auction_lost',
      title: 'انتهى المزاد',
      body: `رست «${label}» على مزايد آخر. يبقى عربونك محجوزًا حتى يُتمّ الفائز سداده، ثم يعود إليك تلقائيًا.`,
      href: `/market/${listing.id}`,
      listingId: listing.id,
    }))
    return
  }

  if (outcome === 'reserve_not_met') {
    await notify(store, {
      userId: listing.sellerId,
      type: 'reserve_not_met',
      title: 'لم يبلغ المزاد سعرك الاحتياطي',
      body: `انتهى مزاد «${label}» دون بلوغ الاحتياطي — يمكنك إعادة عرضها.`,
      href: '/account/listings',
      listingId: listing.id,
    })
  }

  await notifyMany(store, [...bidders], () => ({
    type: 'auction_lost',
    title: 'انتهى المزاد دون بيع',
    body: `لم تُبَع «${label}»، وعاد عربونك إلى رصيدك المتاح.`,
    href: `/market/${listing.id}`,
    listingId: listing.id,
  }))
}

// ---------------------------------------------------------------- العرابين

/**
 * يفكّ حجز عرابين كل من لم يفز في المزاد.
 *
 * يُستدعى فور إنهاء المزاد لا عند فتح صفحة: حجز مال المزايدين الخاسرين بعد
 * انتهاء المزاد ظلم لا مبرّر له، ويمنعهم من دخول مزادات أخرى.
 */
export async function releaseLosingDeposits(
  store: AuctionStore,
  listingId: string,
  keepHeldForUserId: string | null,
  reason: string,
): Promise<number> {
  const held = await store.listDeposits({ listingId, status: ['held'] })
  const at = new Date().toISOString()
  let released = 0

  for (const deposit of held) {
    if (keepHeldForUserId && deposit.userId === keepHeldForUserId) continue
    await store.postLedgerEntry({
      userId: deposit.userId,
      type: 'deposit_release',
      amount: deposit.amount,
      listingId,
      depositId: deposit.id,
      orderId: null,
      note: reason,
      actorAdminId: null,
    })
    await store.updateDeposit(deposit.id, { status: 'released', resolvedAt: at, reason })
    await notify(store, {
      userId: deposit.userId,
      type: 'deposit_released',
      title: 'عاد عربونك إلى رصيدك',
      body: `${reason} — عاد ${formatAmount(deposit.amount)} ريال إلى رصيدك المتاح.`,
      href: '/account/wallet',
      listingId,
    })
    released += 1
  }
  return released
}

/**
 * إغلاق إعلان قبل أوانه — إلغاءً من البائع أو إيقافًا من الإدارة.
 *
 * **يفكّ العرابين دائمًا.** كانت `releaseLosingDeposits` تُستدعى من موضعين فقط
 * — إتمام صفقة وانتهاء مزاد — والإعلان المُغلَق قبل أوانه لا يمرّ بأيّهما، فكان
 * مال المزايدين يبقى مجمّدًا بلا مزاد خلفه ولا شيء يفكّه. لا وجه لحجز ضمانٍ
 * لمزاد لم يعد قائمًا.
 *
 * والمزايدات تبقى `accepted` كما هي: هي سجلّ ما جرى قبل الإغلاق، وإلغاؤها هنا
 * يمحو تاريخ الجولة. إلغاؤها موضعه إعادة العرض حيث تبدأ جولة جديدة فعلًا.
 */
export async function closeListing(
  store: AuctionStore,
  listingId: string,
  status: Extract<ListingStatus, 'cancelled' | 'suspended'>,
  reason: string,
): Promise<Listing> {
  const updated = await store.updateListing(listingId, {
    status,
    endedAt: new Date().toISOString(),
  })
  await releaseLosingDeposits(store, listingId, null, reason)
  await store.appendEvent({
    listingId,
    eventType: 'listing_cancelled',
    payload: { status, reason },
  })
  return updated
}

/**
 * إعادة عرض إعلان مُغلَق — **جولة جديدة لا استئناف**.
 *
 * مزايدات الجولة السابقة تُوسَم ملغاة ولا تُحذف: المزايد قدّم عرضه في مزادٍ
 * أُغلق، فإبقاؤه ملزِمًا في مزاد جديد يُلزمه بما لم يعد يريده — وقد مضت عليه
 * أسابيع. ويصله إشعار دعوة برابط اللوحة، فيعود إلى المنافسة باختياره.
 */
export async function relistListing(
  store: AuctionStore,
  listing: Listing,
): Promise<{ listing: Listing; invited: number }> {
  const standing = (await store.listBids(listing.id)).filter((bid) => bid.status === 'accepted')
  const plateLabel = `${listing.arabicLetters} ${listing.plateNumbers}`

  for (const bid of standing) {
    await store.cancelBid({
      bidId: bid.id,
      reason: 'أُعيد عرض اللوحة — بدأت جولة جديدة',
      nowMs: Date.now(),
    })
  }

  // ما بقي محجوزًا (إن أُعيد العرض دون مرور بإغلاق يفكّ) يعود الآن
  await releaseLosingDeposits(store, listing.id, null, 'أُعيد عرض اللوحة في جولة جديدة')

  const invitees = [...new Set(standing.map((bid) => bid.bidderId))]
  for (const userId of invitees) {
    await notify(store, {
      userId,
      type: 'listing_relisted',
      title: 'أُعيد عرض لوحة زايدت عليها',
      body: `«${plateLabel}» عادت إلى السوق في جولة جديدة — مزايدتك السابقة أُلغيت وعاد عربونك.`,
      href: `/market/${listing.id}`,
      listingId: listing.id,
    })
  }

  const updated = await store.updateListing(listing.id, {
    status: 'draft',
    endsAt: null,
    endedAt: null,
    startsAt: null,
    highestBidId: null,
    soldToUserId: null,
    soldAmount: 0,
  })
  return { listing: updated, invited: invitees.length }
}

/**
 * يحجز عربون المزايد إن كان المزاد يشترطه ولم يُحجز له عربون بعد.
 * يُنفَّذ قبل تسجيل المزايدة: لا تُسجَّل مزايدة بلا عربون مضمون.
 */
async function ensureDepositHeld(
  store: AuctionStore,
  listing: Listing,
  bidderId: string,
): Promise<void> {
  if (!requiresDeposit(listing)) return

  const existing = (await store.listDeposits({ listingId: listing.id, userId: bidderId }))
    .find((d) => d.status === 'held')
  const wallet = await store.getWallet(bidderId)

  let decision: { needsHold: boolean; amount: number }
  try {
    decision = assertDepositEligibility(listing, wallet, existing ?? null)
  } catch (error) {
    if (isWalletError(error)) throw new ServiceError(error.message, 409, error.code)
    throw error
  }
  if (!decision.needsHold) return

  const deposit = await store.createDeposit({
    listingId: listing.id,
    userId: bidderId,
    amount: decision.amount,
    status: 'held',
    forfeitedAmount: 0,
    reason: null,
  })
  try {
    await store.postLedgerEntry({
      userId: bidderId,
      type: 'deposit_hold',
      amount: decision.amount,
      listingId: listing.id,
      depositId: deposit.id,
      orderId: null,
      note: 'حجز عربون لدخول المزاد',
      actorAdminId: null,
    })
  } catch (error) {
    // فشل الحجز بعد إنشاء السجلّ: نُلغيه فلا يبقى عربون بلا مقابل
    await store.updateDeposit(deposit.id, {
      status: 'released',
      resolvedAt: new Date().toISOString(),
      reason: 'تعذّر حجز المبلغ',
    })
    if (isWalletError(error)) throw new ServiceError(error.message, 409, error.code)
    throw error
  }
}

// ---------------------------------------------------------------- الإنهاء التلقائي

/**
 * ينهي كل مزاد بلغ وقت نهايته ويحوّل الفائز إلى طلب شراء.
 * يُستدعى عند أي قراءة، فينتهي المزاد في وقته حتى لو لم يفتح أحد الصفحة.
 */
export async function finalizeDueAuctions(store: AuctionStore): Promise<number> {
  const listings = await store.listListings({ status: ['active', 'scheduled'] })
  const now = Date.now()
  let changed = 0

  for (const listing of listings) {
    if (listing.saleType !== 'auction') continue

    // مزاد مجدول بلغ وقت بدايته
    if (listing.status === 'scheduled') {
      if (listing.startsAt && new Date(listing.startsAt).getTime() <= now) {
        await store.updateListing(listing.id, { status: 'active' })
        changed += 1
      }
      continue
    }

    if (!listing.endsAt || new Date(listing.endsAt).getTime() > now) continue

    const bids = await store.listBids(listing.id)
    const highest = findHighestBid(bids)
    const outcome = resolveAuctionOutcome(listing, highest?.amount ?? null)

    await store.updateListing(listing.id, {
      status: outcome,
      endedAt: listing.endsAt,
      highestBidId: highest?.id ?? null,
      soldToUserId: outcome === 'sold' ? (highest?.bidderId ?? null) : null,
      soldAmount: outcome === 'sold' ? (highest?.amount ?? 0) : 0,
    })

    if (outcome === 'sold' && highest) {
      const existing = await store.listOrders({ listingId: listing.id })
      if (existing.length === 0) {
        // عربون الفائز يبقى محجوزًا حتى يسدّد أو تنقضي المهلة
        const winnerDeposit = (
          await store.listDeposits({ listingId: listing.id, userId: highest.bidderId, status: ['held'] })
        )[0]
        await store.createOrder({
          listingId: listing.id,
          buyerId: highest.bidderId,
          sellerId: listing.sellerId,
          amount: highest.amount,
          source: 'auction',
          status: 'awaiting_settlement',
          paymentDueAt: paymentDueAt(listing, now),
          depositId: winnerDeposit?.id ?? null,
        })
      }
    }

    /*
     * العرابين تبقى محجوزة ما دام المزاد قد رسا على فائز.
     *
     * السبب: الفائز قد يتخلّف عن السداد، وعندها تُعاد اللوحة على المزايد الذي
     * يليه — ولو كنّا فككنا عربونه لَما بقي ضمانٌ لجدّيته. الاسترداد يقع بعد
     * **اكتمال الصفقة** فعلًا، أو فورًا إن انتهى المزاد بلا بيع.
     */
    if (outcome !== 'sold') {
      await releaseLosingDeposits(store, listing.id, null, 'انتهى المزاد دون بيع')
    }

    await publish(store, listing.id, 'auction_ended', {
      status: outcome,
      amount: highest?.amount ?? null,
    })
    await notifyAuctionOutcome(store, listing, outcome, highest?.bidderId ?? null, highest?.amount ?? null)
    changed += 1
  }
  return changed
}

// ---------------------------------------------------------------- السوق

function priceLabelFor(saleType: SaleType, hasBids: boolean): string {
  if (saleType === 'fixed') return 'سعر البيع'
  if (saleType === 'offers') return 'أقل عرض مقبول'
  return hasBids ? 'أعلى مزايدة' : 'السعر الافتتاحي'
}

/** كل الإعلانات المعروضة في السوق. */
/**
 * بطاقات السوق.
 *
 * `sellerId` يُصفّي، و`viewerId` يَسِم: الأولى تحدّد ما يُعرض، والثانية تُعلّم
 * ما هو لصاحب الجلسة من بينه. ولا يخرج معرّف البائع في الحمولة — يُقارَن هنا
 * وتخرج رايةٌ واحدة، فلا تُبنى من البطاقات خريطةُ من يملك ماذا.
 */
export async function getMarketListings(
  sellerId?: string,
  viewerId?: string | null,
): Promise<ListingCard[]> {
  const store = getStore()
  await finalizeDueAuctions(store)

  /*
   * التصفية بالبائع تمرّ من هنا لا من باني بطاقاتٍ ثانٍ.
   *
   * معرض البائع يعرض ما يعرضه السوق بالضبط — السعر القائم وعدد المزايدات
   * والوقت المتبقّي — وبانيان لبطاقةٍ واحدة يفترقان أوّل ما يتغيّر حقل.
   */
  const listings = (await store.listListings()).filter(
    (listing) => !sellerId || listing.sellerId === sellerId,
  )
  const now = Date.now()
  const cards: ListingCard[] = []

  for (const listing of listings) {
    if (listing.status === 'draft') continue
    const seller = await store.findUser(listing.sellerId)
    const bids = (await store.listBids(listing.id)).filter((b) => b.status === 'accepted')
    const offers = await store.listOffers({ listingId: listing.id })
    const highest = findHighestBid(bids)

    const displayPrice =
      listing.saleType === 'fixed'
        ? listing.price
        : listing.saleType === 'offers'
          ? listing.minimumOffer
          : (highest?.amount ?? listing.startingPrice)

    cards.push({
      id: listing.id,
      reference: listing.reference,
      plate: toPlate(listing),
      saleType: listing.saleType,
      status: listing.status,
      displayPrice,
      priceLabel: priceLabelFor(listing.saleType, highest !== null),
      bidCount: bids.length,
      offerCount: offers.filter((o) => o.status === 'pending').length,
      endsAt: listing.endsAt,
      remainingMs: remainingMs(listing, now),
      sellerName: seller?.displayName ?? 'مستخدم',
      isMine: Boolean(viewerId) && listing.sellerId === viewerId,
      createdAt: listing.createdAt,
    })
  }

  // المزادات الجارية أولًا، ثم المتاح، ثم المغلق
  const rank = (card: ListingCard) => {
    if (card.status !== 'active') return 3
    if (card.saleType === 'auction') return 0
    return 1
  }
  return cards.sort(
    (a, b) => rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt),
  )
}

/**
 * معرض بائع — صفحةٌ عامّة يشاركها صاحبها.
 *
 * ما يخرج منها هو ما يخرج في السوق ولا شيء غيره: الاسم والمدينة وتاريخ
 * العضوية، ولوحاته المعروضة. ولا بريد ولا جوّال ولا **رقم عضوية** — الرقم
 * يُقتبَس في المراسلة والفواتير، ونشره في صفحةٍ تُشارَك يجعله معلومًا لمن لا
 * يحتاجه.
 *
 * والمعرّف في الرابط هو `id` العشوائي لا الرقم المرجعي: لا يُخمَّن ولا يُعدّ.
 */
export async function getSellerShowcase(
  idOrHandle: string,
  /** صاحب الجلسة — يُوسم به ما هو له من بطاقات المعرض */
  viewerId?: string | null,
): Promise<{ seller: PublicSeller; cards: ListingCard[] } | null> {
  const store = getStore()
  /*
   * يُقبل المعرّف العلنيّ والداخليّ معًا.
   *
   * الروابط تُشارَك في مجموعات وتُحفظ، فمن غيّر معرّفه لا تنكسر عليه روابطٌ
   * أُرسلت — ومن لم يختر معرّفًا بعد يبقى رابطه بمعرّفه الداخليّ عاملًا.
   */
  const user = (await store.findUserByHandle(idOrHandle)) ?? (await store.findUser(idOrHandle))
  if (!user) return null

  return {
    seller: {
      // الرابط الأقصر ما دام موجودًا — هو ما يُملى ويُكتب
      id: user.handle ?? user.id,
      // ما يُعرض: اسمه أو معرّفه — والاختيار له لا للمنصّة
      displayName: user.showcaseUsesHandle && user.handle ? `@${user.handle}` : user.displayName,
      city: user.city,
      memberSince: user.createdAt,
    },
    cards: await getMarketListings(user.id, viewerId ?? null),
  }
}

/** تفاصيل إعلان واحد كما يراها الزائر. */
export async function getListingDetail(
  listingId: string,
  viewerId: string | null = null,
): Promise<ListingDetail> {
  const store = getStore()
  await finalizeDueAuctions(store)

  const listing = await store.getListing(listingId)
  if (!listing) throw new ServiceError('الإعلان غير موجود', 404, 'LISTING_NOT_FOUND')
  if (listing.status === 'draft' && listing.sellerId !== viewerId) {
    throw new ServiceError('الإعلان غير منشور', 404, 'LISTING_NOT_PUBLISHED')
  }

  const seller = await store.findUser(listing.sellerId)
  const bids = await store.listBids(listing.id)
  const accepted = bids.filter((b) => b.status === 'accepted')
  const highest = findHighestBid(accepted)

  const bidderNames = new Map<string, string>()
  for (const bid of bids) {
    if (bidderNames.has(bid.bidderId)) continue
    const user = await store.findUser(bid.bidderId)
    bidderNames.set(bid.bidderId, user?.displayName ?? 'مستخدم')
  }

  const myOffers = viewerId
    ? (await store.listOffers({ listingId: listing.id, buyerId: viewerId }))
    : []

  // حالة العربون والرصيد تخصّ الزائر وحده — لا تُحسب لغير المسجّل
  const myDeposit = viewerId
    ? (await store.listDeposits({ listingId: listing.id, userId: viewerId }))[0]
    : undefined
  const viewerWallet = viewerId ? await store.getWallet(viewerId) : null

  /*
   * العمولة تُحسب على السعر **القائم** لا على سعر الافتتاح: المزايد يريد أن
   * يعرف ما سيدفعه لو رست عليه الآن، لا ما كان سيدفعه في أول المزاد.
   */
  const commissionSettings = await store.getCommissionSettings()
  /*
   * ولكلّ طريقةٍ سعرُها القائم — والسوم كان يسقط بينها.
   *
   * `offers` لا سعر افتتاح لها ولا مزايدات، فكانت تقع في فرع المزاد فتُقرأ
   * `startingPrice` وهي صفرٌ في هذا النوع — والعمولة على صفرٍ صفر. فيقرأ من
   * يعرض لوحته على السوم أنّ لا عمولة عليه، وتُقتطع منه عند القبول.
   * و`minimumOffer` هو السعر الوحيد الذي تُعلنه، وهو ما تعرضه به البطاقة.
   */
  const currentPrice =
    listing.saleType === 'fixed'
      ? listing.price
      : listing.saleType === 'offers'
        ? (highest?.amount ?? listing.minimumOffer)
        : (highest?.amount ?? listing.startingPrice)
  const commissionNow = computeCommission(commissionSettings, currentPrice)

  const unpaid = (await store.listOrders({ listingId: listing.id })).find(
    (row) => row.status === 'awaiting_settlement',
  )

  return {
    id: listing.id,
    reference: listing.reference,
    plate: toPlate(listing),
    description: listing.description,
    saleType: listing.saleType,
    status: listing.status,
    seller: {
      id: listing.sellerId,
      displayName: seller?.displayName ?? 'مستخدم',
      city: seller?.city ?? null,
      memberSince: seller?.createdAt ?? listing.createdAt,
    },
    isMine: viewerId === listing.sellerId,

    price: listing.price,
    startingPrice: listing.startingPrice,
    minimumIncrement: listing.minimumIncrement,
    minimumOffer: listing.minimumOffer,
    nextBidAmount: computeNextBidAmount(listing, highest?.amount ?? null),
    highestAmount: highest?.amount ?? null,
    highestBidderName: highest ? maskName(bidderNames.get(highest.bidderId) ?? 'مستخدم') : null,
    iAmHighest: Boolean(viewerId && highest?.bidderId === viewerId),
    bidCount: accepted.length,
    // السعر الاحتياطي نفسه لا يغادر الخادم — تُرسل حالته فقط.
    reserveState: publicReserveState(listing, highest?.amount ?? null),

    durationSeconds: listing.durationSeconds,
    extensionTriggerSeconds: listing.extensionTriggerSeconds,
    extensionDurationSeconds: listing.extensionDurationSeconds,
    allowCustomBid: listing.allowCustomBid,

    depositAmount: listing.depositAmount,
    paymentWindowHours: listing.paymentWindowHours,
    myDepositStatus: myDeposit?.status ?? null,
    myAvailableBalance: viewerWallet ? availableBalance(viewerWallet) : null,

    commission: {
      buyer: commissionNow.buyer,
      seller: commissionNow.seller,
      vatPercent: commissionSettings.vatPercent,
      vatEnabled: commissionSettings.vatEnabled,
    },

    startsAt: listing.startsAt,
    endsAt: listing.endsAt,
    endedAt: listing.endedAt,
    remainingMs: remainingMs(listing, Date.now()),
    viewCount: listing.viewCount,

    soldAmount: listing.soldAmount,
    soldToMe: Boolean(viewerId && listing.soldToUserId === viewerId),
    myOrder: await viewerOrder(store, listing, viewerId),

    ledger: bids.map((bid) => ({
      id: bid.id,
      bidderName: maskName(bidderNames.get(bid.bidderId) ?? 'مستخدم'),
      amount: bid.amount,
      status: bid.status,
      createdAt: bid.createdAt,
      isMine: viewerId === bid.bidderId,
      /*
       * المهلة لصاحبها وللبائع وحدهما.
       *
       * الكشف عامّ وأسماؤه مقنّعة، وحالُ سدادِ رجلٍ شأنه وشأن من يبيعه —
       * فمن لا يعنيه الأمر لا يصله الحقل أصلًا، لا يصله ويُخفى بالتنسيق.
       */
      paymentDueAt:
        unpaid && unpaid.buyerId === bid.bidderId && (viewerId === listing.sellerId || viewerId === bid.bidderId)
          ? unpaid.paymentDueAt
          : null,
    })),
    myOffers,
    serverTime: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------- التداول

function guardRate(key: string) {
  const limit = rateLimit(key, config.tradeRateLimit.max, config.tradeRateLimit.windowMs)
  if (!limit.allowed) throw new ServiceError('محاولات كثيرة بوقت قصير، انتظر لحظة.', 429, 'RATE_LIMITED')
}

export async function placeBid(input: {
  listingId: string
  bidderId: string
  amountRiyals: number
  isCustomAmount: boolean
  clientRequestId: string
}) {
  const store = getStore()
  guardRate(`bid:${input.listingId}:${input.bidderId}`)
  await finalizeDueAuctions(store)

  // العربون قبل المزايدة: لا تُسجَّل مزايدة إلا وخلفها مبلغ محجوز فعلًا
  const listing = await store.getListing(input.listingId)
  if (!listing) throw new ServiceError('الإعلان غير موجود', 404, 'LISTING_NOT_FOUND')
  if (listing.sellerId !== input.bidderId) {
    await ensureDepositHeld(store, listing, input.bidderId)
  }

  try {
    const outcome = await store.placeBid({
      listingId: input.listingId,
      bidderId: input.bidderId,
      amount: riyalsToHalalas(input.amountRiyals),
      isCustomAmount: input.isCustomAmount,
      clientRequestId: input.clientRequestId,
      nowMs: Date.now(),
    })

    const bidder = await store.findUser(input.bidderId)
    await publish(store, input.listingId, 'bid_placed', {
      amount: outcome.bid.amount,
      bidderName: maskName(bidder?.displayName ?? 'مستخدم'),
    })

    // أهمّ إشعار في المنصّة: من تجاوزه المزايد الجديد يخسر لوحته وهو لا يدري
    const plateLabel = `${listing.arabicLetters} ${listing.plateNumbers}`
    const outbid = new Set(
      (await store.listBids(listing.id))
        .filter((bid) => bid.status === 'accepted' && bid.bidderId !== input.bidderId)
        .map((bid) => bid.bidderId),
    )
    await notifyMany(store, [...outbid], () => ({
      type: 'outbid',
      title: 'تجاوزك مزايد آخر',
      body: `أعلى مزايدة على «${plateLabel}» صارت ${formatAmount(outcome.bid.amount)} ريال.`,
      href: `/market/${listing.id}`,
      listingId: listing.id,
    }))
    if (outcome.extended) {
      await publish(store, input.listingId, 'time_extended', {
        addedSeconds: outcome.addedSeconds,
        endsAt: outcome.listing.endsAt,
      })
    }
    return outcome
  } catch (error) {
    if (isTradeError(error)) throw new ServiceError(error.message, 409, error.code)
    throw error
  }
}

export async function buyNow(input: { listingId: string; buyerId: string; clientRequestId: string }) {
  const store = getStore()
  guardRate(`buy:${input.listingId}:${input.buyerId}`)

  try {
    const result = await store.buyNow({
      listingId: input.listingId,
      buyerId: input.buyerId,
      clientRequestId: input.clientRequestId,
      nowMs: Date.now(),
    })
    await publish(store, input.listingId, 'listing_sold', { amount: result.order.amount })
    await notify(store, {
      userId: result.listing.sellerId,
      type: 'listing_sold',
      title: 'بيعت لوحتك',
      body: `«${result.listing.arabicLetters} ${result.listing.plateNumbers}» بـ${formatAmount(result.order.amount)} ريال.`,
      href: '/account/sales',
      listingId: result.listing.id,
    })
    return result
  } catch (error) {
    if (isTradeError(error)) throw new ServiceError(error.message, 409, error.code)
    throw error
  }
}

export async function placeOffer(input: {
  listingId: string
  buyerId: string
  amountRiyals: number
  message?: string
}) {
  const store = getStore()
  guardRate(`offer:${input.listingId}:${input.buyerId}`)

  const listing = await store.getListing(input.listingId)
  if (!listing) throw new ServiceError('الإعلان غير موجود', 404, 'LISTING_NOT_FOUND')

  const amount = riyalsToHalalas(input.amountRiyals)
  try {
    assertCanOffer(listing, input.buyerId, amount)
  } catch (error) {
    if (isTradeError(error)) throw new ServiceError(error.message, 409, error.code)
    throw error
  }

  // عرض جديد يلغي عرض المشتري السابق المعلّق على الإعلان نفسه
  const previous = await store.listOffers({ listingId: listing.id, buyerId: input.buyerId })
  for (const offer of previous) {
    if (offer.status === 'pending') await store.updateOffer(offer.id, { status: 'withdrawn' })
  }

  const offer = await store.createOffer({
    listingId: listing.id,
    buyerId: input.buyerId,
    amount,
    message: input.message?.trim() || null,
    status: 'pending',
  })
  await publish(store, listing.id, 'offer_placed', { amount })
  await notify(store, {
    userId: listing.sellerId,
    type: 'offer_received',
    title: 'عرض جديد على لوحتك',
    body: `${formatAmount(amount)} ريال على «${listing.arabicLetters} ${listing.plateNumbers}».`,
    href: '/account/offers',
    listingId: listing.id,
  })
  /*
   * والمشتري يُشعَر بما أرسل.
   *
   * إشعارٌ بفعلِ صاحبه يبدو زائدًا حتى يُنتظر الردّ: العرض يُرسل ثمّ يُغلق
   * اللسان، ولا يبقى منه أثرٌ إلّا في صفحةٍ يُبحث عنها. وسطرٌ في الجرس يقول
   * ما أُرسل وعلى أيّ لوحة، ويقود إلى موضع الردّ حين يأتي.
   */
  await notify(store, {
    userId: input.buyerId,
    type: 'offer_sent',
    title: 'أُرسل عرضك',
    body: `${formatAmount(amount)} ريال على «${listing.arabicLetters} ${listing.plateNumbers}» — بانتظار ردّ البائع.`,
    href: '/account/offers',
    listingId: listing.id,
  })
  return offer
}

export async function respondToOffer(input: {
  offerId: string
  sellerId: string
  decision: 'accept' | 'decline'
}): Promise<{ offer: Offer; order: Order | null }> {
  const store = getStore()
  const offer = await store.getOffer(input.offerId)
  if (!offer) throw new ServiceError('العرض غير موجود', 404, 'OFFER_NOT_FOUND')

  const listing = await store.getListing(offer.listingId)
  if (!listing) throw new ServiceError('الإعلان غير موجود', 404, 'LISTING_NOT_FOUND')
  if (listing.sellerId !== input.sellerId) {
    throw new ServiceError('لا تملك صلاحية على هذا العرض', 403, 'FORBIDDEN')
  }
  if (offer.status !== 'pending') {
    throw new ServiceError('تمّت الاستجابة لهذا العرض مسبقًا', 409, 'OFFER_CLOSED')
  }

  const now = new Date().toISOString()

  if (input.decision === 'decline') {
    const updated = await store.updateOffer(offer.id, { status: 'declined', respondedAt: now })
    await publish(store, listing.id, 'offer_declined', { offerId: offer.id })
    await notify(store, {
      userId: offer.buyerId,
      type: 'offer_declined',
      title: 'رُفض عرضك',
      body: `لم يقبل البائع عرضك على «${listing.arabicLetters} ${listing.plateNumbers}».`,
      href: `/market/${listing.id}`,
      listingId: listing.id,
    })
    return { offer: updated, order: null }
  }

  if (listing.status !== 'active') {
    throw new ServiceError('الإعلان لم يعد متاحًا', 409, 'LISTING_NOT_ACTIVE')
  }

  /*
   * قبولٌ واحدٌ قائم في كل وقت.
   *
   * اللوحة تبقى معروضةً حتى يصل المال، فلا شيء في حالتها يمنع البائع من قبول
   * عرضٍ ثانٍ وهو ينتظر سداد الأوّل — فتُنشأ صفقتان على لوحةٍ واحدة، ويسدّد
   * اثنان ثمنَ ما يملكه أحدهما. والحارس هنا لا هناك: الحالة لم تعد تحرسه.
   *
   * وإذا تخلّف الأوّل صارت صفقته `defaulted` فيُرفع الحظر من نفسه، ويقبل
   * البائع غيره بلا تدخّل.
   */
  const standing = (await store.listOrders({ listingId: listing.id })).find(
    (row) => row.status === 'awaiting_settlement',
  )
  if (standing) {
    throw new ServiceError(
      'على هذه اللوحة عرضٌ مقبولٌ ينتظر سداده — لا يُقبل غيره حتى يُسدَّد أو تنقضي مهلته',
      409,
      'AWAITING_SETTLEMENT',
    )
  }

  const updated = await store.updateOffer(offer.id, { status: 'accepted', respondedAt: now })

  /*
   * ولا تُعدّ مباعةً بالقبول — تُعدّ مباعةً بالسداد.
   *
   * السوم بلا عربون، فقبولُه وعدٌ لا يضمنه مال. وكانت اللوحة تُرفع من السوق
   * لحظة القبول وتسقط بقيّةُ السوم معها، فإن لم يسدّد صاحبُ الوعد بقيت
   * محجوبةً حتى تنقضي مهلته — يخسر البائع أيّامًا ومشترين كانوا قائمين.
   *
   * فتبقى معروضةً، ويبقى غيرُه يعرض عليها، ولا تُغلق إلّا حين يصل المال
   * (`captureOrderEscrow`) — وهناك تُرفض بقيّةُ السوم ويُشعَر أصحابها.
   */

  const order = await store.createOrder({
    listingId: listing.id,
    buyerId: offer.buyerId,
    sellerId: listing.sellerId,
    amount: offer.amount,
    source: 'offer',
    status: 'awaiting_settlement',
    paymentDueAt: paymentDueAt(listing, Date.now()),
    depositId: null,
  })
  await publish(store, listing.id, 'offer_accepted', { offerId: offer.id, amount: offer.amount })
  await notify(store, {
    userId: offer.buyerId,
    type: 'offer_accepted',
    title: 'قُبل عرضك',
    body: `رست عليك «${listing.arabicLetters} ${listing.plateNumbers}» بـ${formatAmount(offer.amount)} ريال.`,
    href: '/account/purchases',
    listingId: listing.id,
  })
  return { offer: updated, order }
}

export async function withdrawOffer(offerId: string, buyerId: string): Promise<Offer> {
  const store = getStore()
  const offer = await store.getOffer(offerId)
  if (!offer) throw new ServiceError('العرض غير موجود', 404, 'OFFER_NOT_FOUND')
  if (offer.buyerId !== buyerId) throw new ServiceError('لا تملك هذا العرض', 403, 'FORBIDDEN')
  if (offer.status !== 'pending') throw new ServiceError('لا يمكن سحب هذا العرض', 409, 'OFFER_CLOSED')
  return store.updateOffer(offerId, { status: 'withdrawn', respondedAt: new Date().toISOString() })
}

// ---------------------------------------------------------------- صفحات الحساب

export async function getAccountListings(userId: string): Promise<AccountListing[]> {
  const store = getStore()
  await finalizeDueAuctions(store)

  /*
   * المباعة تغادر الإدارة إلى «مبيعاتي».
   *
   * هذه الصفحة لما يُدار: تُنشَر وتُسعَّر وتُلغى وتُعاد. واللوحة إذا بيعت لم
   * يبقَ فيها ما يُدار — بقي ما يُتابَع: نقل الملكية والسداد وإفراج المبلغ،
   * وذاك كلّه في «مبيعاتي» بأدواته. فبقاؤها هنا يُطيل القائمة بما لا يُفعل
   * فيه شيء، ويُخفي المسوّدة الجديدة خلف صفقاتٍ انتهت.
   *
   * ولا تُحذف من مكانٍ آخر: `getSales` يقرأ الإعلانات نفسها، فهي محفوظة
   * كاملةً وإنّما تُعرض حيث يُتصرَّف فيها.
   */
  const listings = (await store.listListings({ sellerId: userId, includeDrafts: true })).filter(
    (listing) => listing.status !== 'sold',
  )
  const result: AccountListing[] = []

  for (const listing of listings) {
    const bids = (await store.listBids(listing.id)).filter((b) => b.status === 'accepted')
    const offers = await store.listOffers({ listingId: listing.id })
    const highest = findHighestBid(bids)
    const highestUser = highest ? await store.findUser(highest.bidderId) : null

    result.push({
      ...listing,
      bidCount: bids.length,
      offerCount: offers.length,
      pendingOfferCount: offers.filter((o) => o.status === 'pending').length,
      highestAmount: highest?.amount ?? null,
      highestBidderName: highestUser ? maskName(highestUser.displayName) : null,
      reserveGap: reserveGap(listing, highest?.amount ?? null),
      reserveMet: highest !== null && highest.amount >= listing.reservePrice,
    })
  }
  return result
}

export async function getAccountBids(userId: string): Promise<AccountBid[]> {
  const store = getStore()
  await finalizeDueAuctions(store)

  const myBids = (await store.listBidsByBidder(userId)).filter((b) => b.status === 'accepted')
  const byListing = new Map<string, number>()
  for (const bid of myBids) {
    byListing.set(bid.listingId, Math.max(byListing.get(bid.listingId) ?? 0, bid.amount))
  }

  const now = Date.now()
  const result: AccountBid[] = []
  for (const [listingId, myHighest] of byListing) {
    const listing = await store.getListing(listingId)
    if (!listing) continue
    const highest = findHighestBid(await store.listBids(listingId))
    result.push({
      listingId,
      plate: toPlate(listing),
      saleType: listing.saleType,
      listingStatus: listing.status,
      myHighest,
      currentHighest: highest?.amount ?? null,
      isHighest: highest?.bidderId === userId,
      endsAt: listing.endsAt,
      remainingMs: remainingMs(listing, now),
    })
  }
  return result.sort((a, b) => Number(b.isHighest) - Number(a.isHighest))
}

async function decorateOffers(
  store: AuctionStore,
  offers: Offer[],
  counterpart: 'buyer' | 'seller',
): Promise<AccountOffer[]> {
  const result: AccountOffer[] = []
  for (const offer of offers) {
    const listing = await store.getListing(offer.listingId)
    if (!listing) continue
    const otherId = counterpart === 'buyer' ? offer.buyerId : listing.sellerId
    const other = await store.findUser(otherId)
    result.push({
      ...offer,
      plate: toPlate(listing),
      listingStatus: listing.status,
      counterpartName: other?.displayName ?? 'مستخدم',
    })
  }
  return result
}

export async function getOffersMadeByUser(userId: string): Promise<AccountOffer[]> {
  const store = getStore()
  return decorateOffers(store, await store.listOffers({ buyerId: userId }), 'seller')
}

export async function getOffersReceivedByUser(userId: string): Promise<AccountOffer[]> {
  const store = getStore()
  return decorateOffers(store, await store.listOffers({ sellerId: userId }), 'buyer')
}

async function decorateOrders(
  store: AuctionStore,
  orders: Order[],
  side: 'buyer' | 'seller',
): Promise<AccountOrder[]> {
  const result: AccountOrder[] = []
  const commissionSettings = await store.getCommissionSettings()
  const now = Date.now()

  for (const order of orders) {
    const listing = await store.getListing(order.listingId)
    if (!listing) continue
    const otherId = side === 'buyer' ? order.sellerId : order.buyerId
    const other = await store.findUser(otherId)

    const deposit = order.depositId ? await store.getDeposit(order.depositId) : null
    const commission = computeCommission(commissionSettings, order.amount)
    const settlement = buildOrderSettlement(
      order,
      deposit ? { amount: deposit.amount, status: deposit.status } : null,
      // كلٌّ يرى ما يخصّه: عمولة المشتري للمشتري وعمولة البائع للبائع
      side === 'buyer' ? commission.buyer : commission.seller,
      side,
    )

    result.push({
      ...order,
      plate: toPlate(listing),
      counterpartName: other?.displayName ?? 'مستخدم',
      settlement,
      timeline: buildOrderTimeline(order, settlement, now, side),
    })
  }
  return result
}

export async function listAccountOrders(
  userId: string,
  role: 'buyer' | 'seller',
): Promise<AccountOrder[]> {
  const store = getStore()
  await finalizeDueAuctions(store)
  const query = role === 'buyer' ? { buyerId: userId } : { sellerId: userId }
  return decorateOrders(store, await store.listOrders(query), role)
}

export async function requireOwnedListing(
  store: AuctionStore,
  listingId: string,
  userId: string,
): Promise<Listing> {
  const listing = await store.getListing(listingId)
  if (!listing) throw new ServiceError('الإعلان غير موجود', 404, 'LISTING_NOT_FOUND')
  if (listing.sellerId !== userId) throw new ServiceError('لا تملك هذا الإعلان', 403, 'FORBIDDEN')
  return listing
}


/**
 * صفقة الزائر على هذه اللوحة إن وُجدت.
 *
 * مقصورة على طرفيها: من ليس مشتريًا ولا بائعًا لا يرى مبالغ صفقة غيره ولا
 * مراحلها.
 */
async function viewerOrder(
  store: AuctionStore,
  listing: Listing,
  viewerId: string | null,
): Promise<{ order: AccountOrder; side: 'buyer' | 'seller' } | null> {
  if (!viewerId) return null
  const orders = await store.listOrders({ listingId: listing.id })
  const mine = orders.find((row) => row.buyerId === viewerId || row.sellerId === viewerId)
  if (!mine) return null

  const side: 'buyer' | 'seller' = mine.buyerId === viewerId ? 'buyer' : 'seller'
  const [decorated] = await decorateOrders(store, [mine], side)
  return decorated ? { order: decorated, side } : null
}
