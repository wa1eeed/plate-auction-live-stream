import {
  assertBidIsValid,
  assertCanBuyNow,
  computeExtension,
  findHighestBid,
  resolveAuctionOutcome,
} from '@/lib/domain/auction'
import type {
  AdminAccount,
  AuctionSettings,
  AuditLog,
  Bid,
  CommissionSettings,
  Deposit,
  Disbursement,
  TaxInvoice,
  TaxSettings,
  BrandSettings,
  FaqItem,
  LedgerEntry,
  Listing,
  Notification,
  ListingEvent,
  ListingEventType,
  Offer,
  Order,
  OrderStatus,
  Payment,
  PaymentSettings,
  PlatformEntry,
  User,
  Wallet,
} from '@/lib/domain/types'
import {
  DEFAULT_AUCTION_SETTINGS,
  DEFAULT_COMMISSION_SETTINGS,
  DEFAULT_PAYMENT_SETTINGS,
  DEFAULT_TAX_SETTINGS,
  DEFAULT_BRAND_SETTINGS,
  EMPTY_PAYOUT_ACCOUNT,
} from '@/lib/domain/types'
import { buildEntry, emptyWallet, type NewLedgerEntry } from '@/lib/domain/wallet'
import { EMPTY_SOCIAL, type SocialHandles } from '@/lib/domain/types'
import { buildReference, referenceYear, type ReferenceKind } from '@/lib/domain/reference'
import { newId } from '@/lib/server/crypto'
import { KeyedMutex } from './mutex'
import type {
  AdminRecord,
  AuctionStore,
  BuyNowCommand,
  ListingQuery,
  NewDeposit,
  NewFaqItem,
  NewListing,
  NewNotification,
  NewPayment,
  NewOffer,
  NewOrder,
  NewDisbursement,
  NewPlatformEntry,
  NewTaxInvoice,
  PlaceBidCommand,
  PlaceBidOutcome,
  UserAccount,
} from './types'

export type MemoryDatabase = {
  users: UserAccount[]
  admins: AdminRecord[]
  wallets: Map<string, Wallet>
  ledger: LedgerEntry[]
  deposits: Deposit[]
  notifications: Notification[]
  payments: Payment[]
  paymentSettings: PaymentSettings
  auctionSettings: AuctionSettings
  commissionSettings: CommissionSettings
  /** إيرادات المنصّة: عمولات وضرائب وعرابين مُصادَرة */
  platformEntries: PlatformEntry[]
  /** أوامر الصرف — التزامات المنصّة تجاه مستفيديها */
  disbursements: Disbursement[]
  /** الفواتير الضريبية — سلسلة لا تنقطع ولا يُعدَّل فيها صادر */
  invoices: TaxInvoice[]
  taxSettings: TaxSettings
  brandSettings: BrandSettings
  faq: FaqItem[]
  listings: Listing[]
  bids: Bid[]
  offers: Offer[]
  orders: Order[]
  events: ListingEvent[]
  audits: {
    id: string
    actorId: string | null
    action: string
    entityType: string
    entityId: string
    beforeData: Record<string, unknown> | null
    afterData: Record<string, unknown> | null
    createdAt: string
  }[]
  sequence: number
  /**
   * عدّادات الأرقام المرجعية، مفتاحها `نوع:سنة`.
   *
   * مستقلّة عن `sequence` الخاصّ بترتيب الأحداث — خلطهما يجعل رقم الإعلان
   * يقفز مع كل مزايدة. ومستقلّة لكل سنة: التسلسل يبدأ من جديد في يناير،
   * وهو ما يجعل السنة في الرقم ذات معنى بدل أن تكون زينة.
   */
  referenceCounters: Record<string, number>
  /** يمنع تنفيذ نفس الطلب مرتين عند الضغط السريع أو إعادة الإرسال */
  requestIds: Map<string, string>
}

export function emptyDatabase(): MemoryDatabase {
  return {
    users: [],
    admins: [],
    wallets: new Map(),
    ledger: [],
    deposits: [],
    notifications: [],
    payments: [],
    paymentSettings: {
      ...DEFAULT_PAYMENT_SETTINGS,
      updatedAt: new Date(0).toISOString(),
      updatedByAdminId: null,
    },
    auctionSettings: {
      ...DEFAULT_AUCTION_SETTINGS,
      updatedAt: new Date(0).toISOString(),
      updatedByAdminId: null,
    },
    commissionSettings: {
      ...DEFAULT_COMMISSION_SETTINGS,
      updatedAt: new Date(0).toISOString(),
      updatedByAdminId: null,
    },
    platformEntries: [],
    disbursements: [],
    invoices: [],
    taxSettings: {
      ...DEFAULT_TAX_SETTINGS,
      updatedAt: new Date(0).toISOString(),
      updatedByAdminId: null,
    },
    brandSettings: {
      ...DEFAULT_BRAND_SETTINGS,
      updatedAt: new Date(0).toISOString(),
      updatedByAdminId: null,
    },
    faq: [],
    listings: [],
    bids: [],
    offers: [],
    orders: [],
    events: [],
    audits: [],
    sequence: 0,
    referenceCounters: {},
    requestIds: new Map(),
  }
}

const clone = <T>(value: T): T =>
  value === null || value === undefined ? value : structuredClone(value)

export class MemoryStore implements AuctionStore {
  readonly kind = 'memory' as const
  private readonly mutex = new KeyedMutex()

  constructor(readonly db: MemoryDatabase = emptyDatabase()) {}

  /**
   * الرقم المرجعي التالي لنوع في سنة.
   *
   * متزامن بلا `await` بينه وبين الكتابة، فلا يقع تداخل بين طلبين متزامنين على
   * حلقة أحداث واحدة — وهذا ما يضمن ألّا يتشارك مستخدمان رقمًا في منصّة
   * متعدّدة المستخدمين.
   *
   * و`at` وقت الإنشاء لا وقت الاستدعاء: بيانات مبذورة بتواريخ ماضية تأخذ
   * أرقام سنواتها.
   */
  nextReference(kind: ReferenceKind, at: number | string = Date.now()): string {
    const year = referenceYear(at)
    const key = `${kind}:${year}`
    const next = (this.db.referenceCounters[key] ?? 0) + 1
    this.db.referenceCounters[key] = next
    return buildReference(kind, year, next)
  }

  // ------------------------------------------------------------- المستخدمون

  /** بالمعرّف العلنيّ — يُطبَّع كما يُطبَّع عند الحفظ فيُقبل كيفما كُتب. */
  async findUserByHandle(handle: string): Promise<User | null> {
    const normalized = handle.trim().toLowerCase()
    if (!normalized) return null
    return clone(this.db.users.find((u) => u.handle === normalized) ?? null)
  }

  async findUserByEmail(email: string): Promise<UserAccount | null> {
    const normalized = email.trim().toLowerCase()
    return clone(this.db.users.find((u) => u.email === normalized) ?? null)
  }

  async findUser(id: string): Promise<User | null> {
    const account = this.db.users.find((u) => u.id === id)
    if (!account) return null
    const { passwordHash: _hash, ...user } = account
    return clone(user)
  }

  async createUser(input: {
    email: string
    passwordHash: string
    displayName: string
    phone: string | null
    social?: SocialHandles
  }): Promise<User> {
    const email = input.email.trim().toLowerCase()
    if (this.db.users.some((u) => u.email === email)) {
      throw new Error('البريد الإلكتروني مستخدم مسبقًا')
    }
    const account: UserAccount = {
      id: newId('usr'),
      reference: this.nextReference('user'),
      email,
      displayName: input.displayName,
      phone: input.phone,
      // بلا معرّف علنيّ حتى يختاره: رابطه بمعرّفه الداخليّ إلى أن يفعل
      handle: null,
      showcaseUsesHandle: false,
      city: null,
      avatarUrl: null,
      social: { ...EMPTY_SOCIAL, ...input.social },
      payout: { ...EMPTY_PAYOUT_ACCOUNT },
      createdAt: new Date().toISOString(),
      passwordHash: input.passwordHash,
    }
    this.db.users.push(account)
    const { passwordHash: _hash, ...user } = account
    return clone(user)
  }

  async updateUser(id: string, patch: Partial<User>): Promise<User> {
    const account = this.db.users.find((u) => u.id === id)
    if (!account) throw new Error('المستخدم غير موجود')
    Object.assign(account, patch)
    const { passwordHash: _hash, ...user } = account
    return clone(user)
  }

  // ------------------------------------------------------------- الإعلانات

  async listListings(query: ListingQuery = {}): Promise<Listing[]> {
    let rows = this.db.listings
    if (query.sellerId) rows = rows.filter((l) => l.sellerId === query.sellerId)
    if (query.status) rows = rows.filter((l) => query.status!.includes(l.status))
    else if (!query.includeDrafts) rows = rows.filter((l) => l.status !== 'draft')
    return clone(rows.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
  }

  async getListing(id: string): Promise<Listing | null> {
    return clone(this.db.listings.find((l) => l.id === id) ?? null)
  }

  async createListing(input: NewListing): Promise<Listing> {
    const now = new Date().toISOString()
    const listing: Listing = {
      ...input,
      id: newId('lst'),
      reference: this.nextReference('listing'),
      createdAt: now,
      updatedAt: now,
    }
    this.db.listings.push(listing)
    return clone(listing)
  }

  async updateListing(id: string, patch: Partial<Listing>): Promise<Listing> {
    const listing = this.db.listings.find((l) => l.id === id)
    if (!listing) throw new Error('الإعلان غير موجود')
    Object.assign(listing, patch, { updatedAt: new Date().toISOString() })
    return clone(listing)
  }

  async deleteListing(id: string): Promise<void> {
    this.db.listings = this.db.listings.filter((l) => l.id !== id)
    this.db.bids = this.db.bids.filter((b) => b.listingId !== id)
    this.db.offers = this.db.offers.filter((o) => o.listingId !== id)
  }

  async incrementViews(id: string): Promise<void> {
    const listing = this.db.listings.find((l) => l.id === id)
    if (listing) listing.viewCount += 1
  }

  // ------------------------------------------------------------- المزايدات

  async listBids(listingId: string): Promise<Bid[]> {
    return clone(
      this.db.bids
        .filter((b) => b.listingId === listingId)
        .sort((a, b) => b.serverSequence - a.serverSequence),
    )
  }

  async listBidsByBidder(bidderId: string): Promise<Bid[]> {
    return clone(
      this.db.bids
        .filter((b) => b.bidderId === bidderId)
        .sort((a, b) => b.serverSequence - a.serverSequence),
    )
  }

  async getBid(id: string): Promise<Bid | null> {
    return clone(this.db.bids.find((b) => b.id === id) ?? null)
  }

  /**
   * ذرّية عبر قفل على مستوى الإعلان: مزايدتان متزامنتان تُنفَّذان تسلسليًا،
   * والثانية تُقيَّم مقابل الحالة بعد الأولى — فلا ينشأ ترتيب خاطئ أبدًا.
   */
  async placeBid(command: PlaceBidCommand): Promise<PlaceBidOutcome> {
    return this.mutex.run(`listing:${command.listingId}`, () => this.placeBidUnsafe(command))
  }

  private placeBidUnsafe(command: PlaceBidCommand): PlaceBidOutcome {
    const dedupeKey = `bid:${command.bidderId}:${command.clientRequestId}`
    const existingId = this.db.requestIds.get(dedupeKey)
    if (existingId) {
      const existing = this.db.bids.find((b) => b.id === existingId)
      const current = this.db.listings.find((l) => l.id === command.listingId)
      if (existing && current) {
        return {
          bid: clone(existing),
          listing: clone(current),
          extended: false,
          addedSeconds: 0,
          previousHighestAmount: null,
        }
      }
    }

    const listing = this.db.listings.find((l) => l.id === command.listingId)
    if (!listing) throw new Error('الإعلان غير موجود')

    const listingBids = this.db.bids.filter((b) => b.listingId === listing.id)
    const highest = findHighestBid(listingBids)

    assertBidIsValid({
      listing,
      nowMs: command.nowMs,
      amount: command.amount,
      highestAmount: highest?.amount ?? null,
      highestBidderId: highest?.bidderId ?? null,
      bidderId: command.bidderId,
      isCustomAmount: command.isCustomAmount,
    })

    this.db.sequence += 1
    const bid: Bid = {
      id: newId('bid'),
      listingId: listing.id,
      bidderId: command.bidderId,
      amount: command.amount,
      status: 'accepted',
      serverSequence: this.db.sequence,
      createdAt: new Date(command.nowMs).toISOString(),
      cancelledAt: null,
      cancellationReason: null,
    }
    this.db.bids.push(bid)
    this.db.requestIds.set(dedupeKey, bid.id)

    const extension = computeExtension(listing, command.nowMs)
    listing.highestBidId = bid.id
    listing.endsAt = extension.endsAt
    listing.updatedAt = new Date(command.nowMs).toISOString()

    return {
      bid: clone(bid),
      listing: clone(listing),
      extended: extension.extended,
      addedSeconds: extension.addedSeconds,
      previousHighestAmount: highest?.amount ?? null,
    }
  }

  async cancelBid(input: { bidId: string; reason?: string; nowMs: number }) {
    const bid = this.db.bids.find((b) => b.id === input.bidId)
    if (!bid) throw new Error('المزايدة غير موجودة')
    return this.mutex.run(`listing:${bid.listingId}`, () => {
      if (bid.status === 'cancelled') throw new Error('المزايدة ملغاة مسبقًا')
      bid.status = 'cancelled'
      bid.cancelledAt = new Date(input.nowMs).toISOString()
      bid.cancellationReason = input.reason ?? null

      const listing = this.db.listings.find((l) => l.id === bid.listingId)
      if (!listing) throw new Error('الإعلان غير موجود')

      const highest = findHighestBid(this.db.bids.filter((b) => b.listingId === listing.id))
      listing.highestBidId = highest?.id ?? null
      listing.updatedAt = new Date(input.nowMs).toISOString()

      if (['sold', 'reserve_not_met', 'no_bids'].includes(listing.status)) {
        listing.status = resolveAuctionOutcome(listing, highest?.amount ?? null)
      }
      return { listing: clone(listing), cancelled: clone(bid) }
    })
  }

  // ------------------------------------------------------------- العروض

  async listOffers(query: { listingId?: string; buyerId?: string; sellerId?: string }): Promise<Offer[]> {
    let rows = this.db.offers
    if (query.listingId) rows = rows.filter((o) => o.listingId === query.listingId)
    if (query.buyerId) rows = rows.filter((o) => o.buyerId === query.buyerId)
    if (query.sellerId) {
      const mine = new Set(
        this.db.listings.filter((l) => l.sellerId === query.sellerId).map((l) => l.id),
      )
      rows = rows.filter((o) => mine.has(o.listingId))
    }
    return clone(rows.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
  }

  async getOffer(id: string): Promise<Offer | null> {
    return clone(this.db.offers.find((o) => o.id === id) ?? null)
  }

  async createOffer(input: NewOffer): Promise<Offer> {
    const offer: Offer = {
      ...input,
      id: newId('ofr'),
      createdAt: new Date().toISOString(),
      respondedAt: null,
    }
    this.db.offers.push(offer)
    return clone(offer)
  }

  async updateOffer(id: string, patch: Partial<Offer>): Promise<Offer> {
    const offer = this.db.offers.find((o) => o.id === id)
    if (!offer) throw new Error('العرض غير موجود')
    Object.assign(offer, patch)
    return clone(offer)
  }

  // ------------------------------------------------------------- الطلبات

  async listOrders(query: { buyerId?: string; sellerId?: string; listingId?: string }): Promise<Order[]> {
    let rows = this.db.orders
    if (query.buyerId) rows = rows.filter((o) => o.buyerId === query.buyerId)
    if (query.sellerId) rows = rows.filter((o) => o.sellerId === query.sellerId)
    if (query.listingId) rows = rows.filter((o) => o.listingId === query.listingId)
    return clone(rows.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
  }

  async getOrder(id: string): Promise<Order | null> {
    return clone(this.db.orders.find((o) => o.id === id) ?? null)
  }

  async createOrder(input: NewOrder): Promise<Order> {
    const order: Order = {
      ...input,
      id: newId('ord'),
      reference: this.nextReference('order'),
      remindersSent: [],
      paidAt: null,
      escrowAmount: 0,
      transferDueAt: null,
      transferProofNote: null,
      transferProofAt: null,
      confirmDueAt: null,
      disputedAt: null,
      disputeReason: null,
      disputedBy: null,
      payoutLedgerEntryId: null,
      releasedAt: null,
      createdAt: new Date().toISOString(),
      completedAt: null,
    }
    this.db.orders.push(order)
    return clone(order)
  }

  async updateOrderStatus(id: string, status: OrderStatus, nowMs: number): Promise<Order> {
    const order = this.db.orders.find((o) => o.id === id)
    if (!order) throw new Error('الطلب غير موجود')
    order.status = status
    order.completedAt = status === 'completed' ? new Date(nowMs).toISOString() : null
    return clone(order)
  }

  async markOrderReminded(id: string, marker: string): Promise<void> {
    const order = this.db.orders.find((o) => o.id === id)
    if (!order || order.remindersSent.includes(marker)) return
    order.remindersSent = [...order.remindersSent, marker]
  }

  async updateOrder(id: string, patch: Partial<Order>): Promise<Order> {
    const order = this.db.orders.find((row) => row.id === id)
    if (!order) throw new Error('الصفقة غير موجودة')
    Object.assign(order, patch)
    return clone(order)
  }

  /** ذرّي: يمنع بيع اللوحة نفسها لمشتريين متزامنين. */
  async buyNow(command: BuyNowCommand): Promise<{ listing: Listing; order: Order }> {
    return this.mutex.run(`listing:${command.listingId}`, () => {
      const dedupeKey = `buy:${command.buyerId}:${command.clientRequestId}`
      const existingId = this.db.requestIds.get(dedupeKey)
      if (existingId) {
        const order = this.db.orders.find((o) => o.id === existingId)
        const listing = this.db.listings.find((l) => l.id === command.listingId)
        if (order && listing) return { listing: clone(listing), order: clone(order) }
      }

      const listing = this.db.listings.find((l) => l.id === command.listingId)
      if (!listing) throw new Error('الإعلان غير موجود')
      assertCanBuyNow(listing, command.buyerId)

      const order: Order = {
        id: newId('ord'),
        reference: this.nextReference('order'),
        paidAt: null,
        escrowAmount: 0,
        transferDueAt: null,
        transferProofNote: null,
        transferProofAt: null,
        confirmDueAt: null,
        disputedAt: null,
        disputeReason: null,
        disputedBy: null,
        payoutLedgerEntryId: null,
        releasedAt: null,
        listingId: listing.id,
        buyerId: command.buyerId,
        sellerId: listing.sellerId,
        amount: listing.price,
        source: 'fixed',
        status: 'awaiting_settlement',
        remindersSent: [],
        paymentDueAt: new Date(
          command.nowMs + Math.max(1, listing.paymentWindowHours) * 3_600_000,
        ).toISOString(),
        depositId: null,
        createdAt: new Date(command.nowMs).toISOString(),
        completedAt: null,
      }
      this.db.orders.push(order)
      this.db.requestIds.set(dedupeKey, order.id)

      listing.status = 'sold'
      listing.soldToUserId = command.buyerId
      listing.soldAmount = listing.price
      listing.endedAt = new Date(command.nowMs).toISOString()
      listing.updatedAt = listing.endedAt

      return { listing: clone(listing), order: clone(order) }
    })
  }

  // ------------------------------------------------------------- المحفظة

  async getWallet(userId: string): Promise<Wallet> {
    return clone(this.walletRef(userId))
  }

  private walletRef(userId: string): Wallet {
    let wallet = this.db.wallets.get(userId)
    if (!wallet) {
      wallet = emptyWallet(userId, new Date().toISOString())
      this.db.wallets.set(userId, wallet)
    }
    return wallet
  }

  async listWallets(): Promise<Wallet[]> {
    return clone([...this.db.wallets.values()])
  }

  async listLedger(query: { userId?: string; limit?: number } = {}): Promise<LedgerEntry[]> {
    let rows = this.db.ledger
    if (query.userId) rows = rows.filter((e) => e.userId === query.userId)
    const sorted = rows
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
    return clone(query.limit ? sorted.slice(0, query.limit) : sorted)
  }

  /**
   * ذرّية عبر قفل على المستخدم: شحن وحجز متزامنان لا ينتجان رصيدًا خاطئًا،
   * ولا يُكتب قيد إلا بعد نجاح التحقّق كاملًا.
   */
  async postLedgerEntry(input: NewLedgerEntry): Promise<{ wallet: Wallet; entry: LedgerEntry }> {
    return this.mutex.run(`wallet:${input.userId}`, () => {
      const at = new Date().toISOString()
      const built = buildEntry(this.walletRef(input.userId), input, at)
      const entry: LedgerEntry = {
        ...built.entry,
        id: newId('led'),
        reference: this.nextReference('wallet'),
      }
      this.db.wallets.set(input.userId, built.wallet)
      this.db.ledger.push(entry)
      return { wallet: clone(built.wallet), entry: clone(entry) }
    })
  }

  // ------------------------------------------------------------- العرابين

  async listDeposits(
    query: { listingId?: string; userId?: string; status?: Deposit['status'][] } = {},
  ): Promise<Deposit[]> {
    let rows = this.db.deposits
    if (query.listingId) rows = rows.filter((d) => d.listingId === query.listingId)
    if (query.userId) rows = rows.filter((d) => d.userId === query.userId)
    if (query.status) rows = rows.filter((d) => query.status!.includes(d.status))
    return clone(rows.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
  }

  async getDeposit(id: string): Promise<Deposit | null> {
    return clone(this.db.deposits.find((d) => d.id === id) ?? null)
  }

  async createDeposit(input: NewDeposit): Promise<Deposit> {
    const deposit: Deposit = {
      ...input,
      id: newId('dep'),
      reference: this.nextReference('deposit'),
      createdAt: new Date().toISOString(),
      resolvedAt: null,
      resolvedByAdminId: null,
    }
    this.db.deposits.push(deposit)
    return clone(deposit)
  }

  async updateDeposit(id: string, patch: Partial<Deposit>): Promise<Deposit> {
    const deposit = this.db.deposits.find((d) => d.id === id)
    if (!deposit) throw new Error('العربون غير موجود')
    Object.assign(deposit, patch)
    return clone(deposit)
  }

  // ------------------------------------------------------------- الإشعارات

  async listNotifications(userId: string, limit = 30): Promise<Notification[]> {
    return clone(
      this.db.notifications
        .filter((n) => n.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
        .slice(0, limit),
    )
  }

  async countUnreadNotifications(userId: string): Promise<number> {
    return this.db.notifications.filter((n) => n.userId === userId && n.readAt === null).length
  }

  async createNotification(input: NewNotification): Promise<Notification> {
    const notification: Notification = {
      ...input,
      id: newId('ntf'),
      readAt: null,
      createdAt: new Date().toISOString(),
    }
    this.db.notifications.push(notification)
    // سقف لكل مستخدم: السجلّ الطويل بلا فائدة، والأحدث هو ما يُتصرَّف عليه
    const mine = this.db.notifications.filter((n) => n.userId === input.userId)
    if (mine.length > 200) {
      const drop = new Set(mine.slice(0, mine.length - 200).map((n) => n.id))
      this.db.notifications = this.db.notifications.filter((n) => !drop.has(n.id))
    }
    return clone(notification)
  }

  async markNotificationsRead(userId: string, ids?: string[]): Promise<number> {
    const at = new Date().toISOString()
    let changed = 0
    for (const notification of this.db.notifications) {
      if (notification.userId !== userId || notification.readAt !== null) continue
      if (ids && !ids.includes(notification.id)) continue
      notification.readAt = at
      changed += 1
    }
    return changed
  }

  // ------------------------------------------------------------- المدفوعات

  async listPayments(
    query: { userId?: string; status?: Payment['status'][] } = {},
  ): Promise<Payment[]> {
    let rows = this.db.payments
    if (query.userId) rows = rows.filter((p) => p.userId === query.userId)
    if (query.status) rows = rows.filter((p) => query.status!.includes(p.status))
    return clone(rows.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
  }

  async getPayment(id: string): Promise<Payment | null> {
    return clone(this.db.payments.find((p) => p.id === id) ?? null)
  }

  async findPaymentByCharge(chargeId: string): Promise<Payment | null> {
    return clone(this.db.payments.find((p) => p.tapChargeId === chargeId) ?? null)
  }

  async findPaymentByReference(reference: string): Promise<Payment | null> {
    return clone(this.db.payments.find((p) => p.reference === reference) ?? null)
  }

  async createPayment(input: NewPayment): Promise<Payment> {
    const now = new Date().toISOString()
    const payment: Payment = {
      ...input,
      id: newId('pay'),
      reference: this.nextReference('payment'),
      createdAt: now,
      updatedAt: now,
      settledAt: null,
      settledByAdminId: null,
    }
    this.db.payments.push(payment)
    return clone(payment)
  }

  async updatePayment(id: string, patch: Partial<Payment>): Promise<Payment> {
    const payment = this.db.payments.find((p) => p.id === id)
    if (!payment) throw new Error('عملية الدفع غير موجودة')
    Object.assign(payment, patch, { updatedAt: new Date().toISOString() })
    return clone(payment)
  }

  // ------------------------------------------------------------- إعدادات المزاد

  async getAuctionSettings(): Promise<AuctionSettings> {
    return clone(this.db.auctionSettings)
  }

  async updateAuctionSettings(patch: Partial<AuctionSettings>): Promise<AuctionSettings> {
    this.db.auctionSettings = {
      ...this.db.auctionSettings,
      ...patch,
      updatedAt: new Date().toISOString(),
    }
    return clone(this.db.auctionSettings)
  }

  // --------------------------------------------------------- إعدادات العمولة

  async getCommissionSettings(): Promise<CommissionSettings> {
    return clone(this.db.commissionSettings)
  }

  async updateCommissionSettings(patch: Partial<CommissionSettings>): Promise<CommissionSettings> {
    this.db.commissionSettings = {
      ...this.db.commissionSettings,
      ...patch,
      updatedAt: new Date().toISOString(),
    }
    return clone(this.db.commissionSettings)
  }

  // ---------------------------------------------------- الضريبة وأوامر الصرف

  async getBrandSettings(): Promise<BrandSettings> {
    return clone(this.db.brandSettings)
  }

  async updateBrandSettings(patch: Partial<BrandSettings>): Promise<BrandSettings> {
    this.db.brandSettings = {
      ...this.db.brandSettings,
      ...patch,
      updatedAt: new Date().toISOString(),
    }
    return clone(this.db.brandSettings)
  }

  async getTaxSettings(): Promise<TaxSettings> {
    return clone(this.db.taxSettings)
  }

  async updateTaxSettings(patch: Partial<TaxSettings>): Promise<TaxSettings> {
    this.db.taxSettings = {
      ...this.db.taxSettings,
      ...patch,
      updatedAt: new Date().toISOString(),
    }
    return clone(this.db.taxSettings)
  }

  /*
   * بالزمن لا بعكس ترتيب الإدخال.
   *
   * `reverse()` يقلب تسلسل الإضافة، وهو يوافق الزمن ما دامت الصفوف تُضاف
   * لحظةَ وقوعها. لكنّ البذرة تُنشئ صفقاتٍ مؤرَّخةً في الماضي بترتيبٍ غير
   * ترتيب تواريخها، فيخرج الجدول من الأقدم إلى الأحدث — وهو ما يقع أيضًا في
   * أي استيراد أو ترحيل بيانات. والفرز بالحقل نفسه يصحّ في الحالتين.
   *
   * وسلسلة التجزئة لا يمسّها هذا: `lastInvoiceHash` يقرأ آخر المُدخَل من
   * `db.invoices` مباشرةً، لا من هنا.
   */
  async listInvoices(query: { userId?: string; orderId?: string } = {}): Promise<TaxInvoice[]> {
    return clone(
      this.db.invoices
        .filter((row) => !query.userId || row.customerId === query.userId)
        .filter((row) => !query.orderId || row.orderId === query.orderId)
        .slice()
        .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)),
    )
  }

  async getInvoice(idOrReference: string): Promise<TaxInvoice | null> {
    return clone(
      this.db.invoices.find((row) => row.id === idOrReference || row.reference === idOrReference) ??
        null,
    )
  }

  /**
   * آخر تجزئة في السلسلة.
   *
   * تُقرأ من ذيل المصفوفة لا بالبحث عن الأحدث زمنًا: الترتيب هنا ترتيب
   * الإصدار، وفاتورتان في المليّ ثانية نفسها لهما ترتيبٌ واحد لا ترتيبان.
   */
  async lastInvoiceHash(): Promise<string | null> {
    return this.db.invoices.at(-1)?.hash ?? null
  }

  async createInvoice(input: NewTaxInvoice): Promise<TaxInvoice> {
    const row: TaxInvoice = { ...input, id: newId('inv') }
    this.db.invoices.push(row)
    return clone(row)
  }

  async listDisbursements(
    query: { status?: Disbursement['status'][]; beneficiaryId?: string; orderId?: string } = {},
  ): Promise<Disbursement[]> {
    return clone(
      this.db.disbursements
        .filter((row) => !query.status || query.status.includes(row.status))
        .filter((row) => !query.beneficiaryId || row.beneficiaryId === query.beneficiaryId)
        .filter((row) => !query.orderId || row.orderId === query.orderId)
        .slice()
        // بالزمن لا بعكس ترتيب الإدخال — انظر `listInvoices`
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    )
  }

  async getDisbursement(idOrReference: string): Promise<Disbursement | null> {
    return clone(
      this.db.disbursements.find(
        (row) => row.id === idOrReference || row.reference === idOrReference,
      ) ?? null,
    )
  }

  async createDisbursement(input: NewDisbursement): Promise<Disbursement> {
    const row: Disbursement = {
      ...input,
      id: newId('dsb'),
      reference: this.nextReference('disbursement'),
      status: 'pending',
      createdAt: new Date().toISOString(),
      paidAt: null,
      paidByAdminId: null,
      paymentReference: null,
      ledgerEntryId: null,
      cancelledAt: null,
      cancelledByAdminId: null,
      cancelReason: null,
    }
    this.db.disbursements.push(row)
    return clone(row)
  }

  async updateDisbursement(id: string, patch: Partial<Disbursement>): Promise<Disbursement> {
    const index = this.db.disbursements.findIndex((row) => row.id === id)
    if (index < 0) throw new Error('أمر الصرف غير موجود')
    this.db.disbursements[index] = { ...this.db.disbursements[index], ...patch }
    return clone(this.db.disbursements[index])
  }

  // ------------------------------------------------------------ حساب المنصّة

  async appendPlatformEntry(entry: NewPlatformEntry): Promise<PlatformEntry> {
    const row: PlatformEntry = {
      ...entry,
      id: newId('rev'),
      reference: this.nextReference('revenue'),
      createdAt: new Date().toISOString(),
      reversedAt: null,
      reversalReason: null,
    }
    this.db.platformEntries.push(row)
    return clone(row)
  }

  async listPlatformEntries(
    query: { orderId?: string; depositId?: string; userId?: string; settled?: boolean } = {},
  ): Promise<PlatformEntry[]> {
    let rows = this.db.platformEntries
    if (query.orderId) rows = rows.filter((r) => r.orderId === query.orderId)
    if (query.depositId) rows = rows.filter((r) => r.depositId === query.depositId)
    if (query.userId) rows = rows.filter((r) => r.userId === query.userId)
    if (query.settled !== undefined) rows = rows.filter((r) => r.settled === query.settled)
    return clone([...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
  }

  async updatePlatformEntry(id: string, patch: Partial<PlatformEntry>): Promise<PlatformEntry> {
    const row = this.db.platformEntries.find((r) => r.id === id)
    if (!row) throw new Error('قيد الإيراد غير موجود')
    Object.assign(row, patch)
    return clone(row)
  }

  // ------------------------------------------------------------- إعدادات الدفع

  async getPaymentSettings(): Promise<PaymentSettings> {
    return clone(this.db.paymentSettings)
  }

  async updatePaymentSettings(patch: Partial<PaymentSettings>): Promise<PaymentSettings> {
    this.db.paymentSettings = {
      ...this.db.paymentSettings,
      ...patch,
      updatedAt: new Date().toISOString(),
    }
    return clone(this.db.paymentSettings)
  }

  // ------------------------------------------------------------- الأسئلة الشائعة

  async listFaq(query: { publishedOnly?: boolean; onListingOnly?: boolean } = {}): Promise<FaqItem[]> {
    let rows = this.db.faq
    if (query.publishedOnly) rows = rows.filter((f) => f.published)
    if (query.onListingOnly) rows = rows.filter((f) => f.showOnListing)
    return clone(
      rows.slice().sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt)),
    )
  }

  async getFaq(id: string): Promise<FaqItem | null> {
    return clone(this.db.faq.find((f) => f.id === id) ?? null)
  }

  async createFaq(input: NewFaqItem): Promise<FaqItem> {
    const now = new Date().toISOString()
    const item: FaqItem = { ...input, id: newId('faq'), createdAt: now, updatedAt: now }
    this.db.faq.push(item)
    return clone(item)
  }

  async updateFaq(id: string, patch: Partial<FaqItem>): Promise<FaqItem> {
    const item = this.db.faq.find((f) => f.id === id)
    if (!item) throw new Error('السؤال غير موجود')
    Object.assign(item, patch, { updatedAt: new Date().toISOString() })
    return clone(item)
  }

  async deleteFaq(id: string): Promise<void> {
    this.db.faq = this.db.faq.filter((f) => f.id !== id)
  }

  // ------------------------------------------------------------- الإدارة

  async findAdminByEmail(email: string): Promise<AdminRecord | null> {
    const normalized = email.trim().toLowerCase()
    return clone(this.db.admins.find((a) => a.email === normalized) ?? null)
  }

  async findAdmin(id: string): Promise<AdminAccount | null> {
    const record = this.db.admins.find((a) => a.id === id)
    if (!record) return null
    const { passwordHash: _hash, ...admin } = record
    return clone(admin)
  }

  async touchAdminLogin(id: string, at: string): Promise<void> {
    const record = this.db.admins.find((a) => a.id === id)
    if (record) record.lastLoginAt = at
  }

  async listUsers(): Promise<User[]> {
    return clone(
      this.db.users
        .map(({ passwordHash: _hash, ...user }) => user)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    )
  }

  async listAllBids(): Promise<Bid[]> {
    return clone(this.db.bids.slice().sort((a, b) => b.serverSequence - a.serverSequence))
  }

  async listAllOrders(): Promise<Order[]> {
    return clone(this.db.orders.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
  }

  async listAudits(limit = 200): Promise<AuditLog[]> {
    return clone(
      this.db.audits
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
        .slice(0, limit),
    )
  }

  // ------------------------------------------------------------- الأحداث

  async appendEvent(input: {
    listingId: string
    eventType: ListingEventType
    payload: Record<string, unknown>
  }): Promise<ListingEvent> {
    const event: ListingEvent = {
      id: newId('evt'),
      listingId: input.listingId,
      eventType: input.eventType,
      payload: input.payload,
      createdAt: new Date().toISOString(),
    }
    this.db.events.push(event)
    if (this.db.events.length > 1000) this.db.events.splice(0, this.db.events.length - 1000)
    return clone(event)
  }

  async listEvents(listingId: string, limit = 50): Promise<ListingEvent[]> {
    return clone(
      this.db.events
        .filter((e) => e.listingId === listingId)
        .slice(-limit)
        .reverse(),
    )
  }

  async appendAudit(input: {
    actorId: string | null
    action: string
    entityType: string
    entityId: string
    beforeData: Record<string, unknown> | null
    afterData: Record<string, unknown> | null
  }): Promise<void> {
    this.db.audits.push({ ...input, id: newId('aud'), createdAt: new Date().toISOString() })
    if (this.db.audits.length > 2000) this.db.audits.splice(0, this.db.audits.length - 2000)
  }
}
