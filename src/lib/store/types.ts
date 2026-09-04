import type { ReferenceKind } from '@/lib/domain/reference'
import type {
  AdminAccount,
  AuctionSettings,
  CommissionSettings,
  AuditLog,
  Bid,
  Deposit,
  Disbursement,
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
  SocialHandles,
  PaymentSettings,
  PlatformEntry,
  TaxInvoice,
  TaxSettings,
  User,
  Wallet,
} from '@/lib/domain/types'
import type { NewLedgerEntry } from '@/lib/domain/wallet'
import type { Halalas } from '@/lib/domain/money'

export type UserAccount = User & { passwordHash: string }
export type AdminRecord = AdminAccount & { passwordHash: string }

export type NewListing = Omit<Listing, 'id' | 'reference' | 'createdAt' | 'updatedAt'>
export type NewOffer = Omit<Offer, 'id' | 'createdAt' | 'respondedAt'>
export type NewOrder = Omit<
  Order,
  | 'id'
  | 'reference'
  | 'createdAt'
  | 'completedAt'
  | 'remindersSent'
  | 'paidAt'
  | 'escrowAmount'
  | 'transferDueAt'
  | 'transferProofNote'
  | 'transferProofAt'
  | 'confirmDueAt'
  | 'disputedAt'
  | 'disputeReason'
  | 'disputedBy'
  | 'payoutLedgerEntryId'
  | 'releasedAt'
>
export type NewDeposit = Omit<Deposit, 'id' | 'reference' | 'createdAt' | 'resolvedAt' | 'resolvedByAdminId'>
export type NewFaqItem = Omit<FaqItem, 'id' | 'createdAt' | 'updatedAt'>
export type NewPlatformEntry = Omit<
  PlatformEntry,
  'id' | 'reference' | 'createdAt' | 'reversedAt' | 'reversalReason'
>
/**
 * الفاتورة تصل المخزَن **برقمها**.
 *
 * الرقم يدخل في التجزئة، والتجزئة تُحسب قبل الكتابة — فمنحُ الرقم داخل
 * المخزَن يجعل المحسوب على رقمٍ والمحفوظ برقمٍ آخر.
 */
export type NewTaxInvoice = Omit<TaxInvoice, 'id'>
export type NewDisbursement = Omit<
  Disbursement,
  | 'id'
  | 'reference'
  | 'status'
  | 'createdAt'
  | 'paidAt'
  | 'paidByAdminId'
  | 'paymentReference'
  | 'ledgerEntryId'
  | 'cancelledAt'
  | 'cancelledByAdminId'
  | 'cancelReason'
>
export type NewPayment = Omit<Payment, 'id' | 'reference' | 'createdAt' | 'updatedAt' | 'settledAt' | 'settledByAdminId'>
export type NewNotification = Omit<Notification, 'id' | 'createdAt' | 'readAt'>

export type PlaceBidCommand = {
  listingId: string
  bidderId: string
  amount: Halalas
  isCustomAmount: boolean
  clientRequestId: string
  nowMs: number
}

export type PlaceBidOutcome = {
  bid: Bid
  listing: Listing
  extended: boolean
  addedSeconds: number
  previousHighestAmount: Halalas | null
}

export type BuyNowCommand = {
  listingId: string
  buyerId: string
  clientRequestId: string
  nowMs: number
}

export type ListingQuery = {
  sellerId?: string
  status?: Listing['status'][]
  includeDrafts?: boolean
}

/**
 * واجهة التخزين المجرّدة. لدينا تنفيذان:
 *  - `MemoryStore`  : وضع Demo، يعمل كاملًا بدون خدمات خارجية.
 *  - `SupabaseStore`: PostgreSQL + RLS + دوال ذرّية للتداول.
 * كل الواجهات تتعامل مع هذه الواجهة وحدها.
 */
export interface AuctionStore {
  readonly kind: 'memory' | 'supabase'

  // ---- المستخدمون
  findUserByEmail(email: string): Promise<UserAccount | null>
  findUser(id: string): Promise<User | null>
  createUser(input: {
    email: string
    passwordHash: string
    displayName: string
    phone: string | null
    social?: SocialHandles
  }): Promise<User>
  updateUser(id: string, patch: Partial<User>): Promise<User>

  // ---- الإعلانات
  listListings(query?: ListingQuery): Promise<Listing[]>
  getListing(id: string): Promise<Listing | null>
  createListing(input: NewListing): Promise<Listing>
  updateListing(id: string, patch: Partial<Listing>): Promise<Listing>
  deleteListing(id: string): Promise<void>
  incrementViews(id: string): Promise<void>

  // ---- المزايدات
  listBids(listingId: string): Promise<Bid[]>
  listBidsByBidder(bidderId: string): Promise<Bid[]>
  getBid(id: string): Promise<Bid | null>
  /** عملية ذرّية: تتحقق، تسجّل، وتمدّد الوقت عند الحاجة. */
  placeBid(command: PlaceBidCommand): Promise<PlaceBidOutcome>
  cancelBid(input: { bidId: string; reason?: string; nowMs: number }): Promise<{ listing: Listing; cancelled: Bid }>

  // ---- العروض
  listOffers(query: { listingId?: string; buyerId?: string; sellerId?: string }): Promise<Offer[]>
  getOffer(id: string): Promise<Offer | null>
  createOffer(input: NewOffer): Promise<Offer>
  updateOffer(id: string, patch: Partial<Offer>): Promise<Offer>

  // ---- الطلبات
  listOrders(query: { buyerId?: string; sellerId?: string; listingId?: string }): Promise<Order[]>
  getOrder(id: string): Promise<Order | null>
  createOrder(input: NewOrder): Promise<Order>
  updateOrderStatus(id: string, status: OrderStatus, nowMs: number): Promise<Order>
  markOrderReminded(id: string, marker: string): Promise<void>
  /** تعديل حقول الصفقة — لمراحل الضمان وإثباتها */
  updateOrder(id: string, patch: Partial<Order>): Promise<Order>

  /** الرقم المرجعي التالي لنوع — يُستدعى داخل الإنشاء لا من خارجه */
  nextReference(kind: ReferenceKind, at?: number | string): string
  /** شراء مباشر ذرّي: يمنع بيع اللوحة مرتين. */
  buyNow(command: BuyNowCommand): Promise<{ listing: Listing; order: Order }>

  // ---- المحفظة
  getWallet(userId: string): Promise<Wallet>
  listWallets(): Promise<Wallet[]>
  listLedger(query: { userId?: string; limit?: number }): Promise<LedgerEntry[]>
  /**
   * حركة محفظة ذرّية: تقرأ الرصيد، تتحقّق، تكتب القيد، وتحدّث المحفظة —
   * كل ذلك داخل قفل على المستخدم، فلا تتضارب حركتان متزامنتان.
   */
  postLedgerEntry(input: NewLedgerEntry): Promise<{ wallet: Wallet; entry: LedgerEntry }>

  // ---- العرابين
  listDeposits(query: { listingId?: string; userId?: string; status?: Deposit['status'][] }): Promise<Deposit[]>
  getDeposit(id: string): Promise<Deposit | null>
  createDeposit(input: NewDeposit): Promise<Deposit>
  updateDeposit(id: string, patch: Partial<Deposit>): Promise<Deposit>

  // ---- الإشعارات
  listNotifications(userId: string, limit?: number): Promise<Notification[]>
  countUnreadNotifications(userId: string): Promise<number>
  createNotification(input: NewNotification): Promise<Notification>
  markNotificationsRead(userId: string, ids?: string[]): Promise<number>

  // ---- المدفوعات
  listPayments(query?: { userId?: string; status?: Payment['status'][] }): Promise<Payment[]>
  getPayment(id: string): Promise<Payment | null>
  /** البحث بمعرّف Tap — الويبهوك لا يعرف معرّفنا الداخلي */
  findPaymentByCharge(chargeId: string): Promise<Payment | null>
  findPaymentByReference(reference: string): Promise<Payment | null>
  createPayment(input: NewPayment): Promise<Payment>
  updatePayment(id: string, patch: Partial<Payment>): Promise<Payment>

  // ---- إعدادات المزاد المركزية
  getAuctionSettings(): Promise<AuctionSettings>
  updateAuctionSettings(patch: Partial<AuctionSettings>): Promise<AuctionSettings>

  // ---- إعدادات الدفع
  getCommissionSettings(): Promise<CommissionSettings>
  updateCommissionSettings(patch: Partial<CommissionSettings>): Promise<CommissionSettings>

  appendPlatformEntry(entry: NewPlatformEntry): Promise<PlatformEntry>
  listPlatformEntries(query?: {
    orderId?: string
    depositId?: string
    userId?: string
    settled?: boolean
  }): Promise<PlatformEntry[]>
  updatePlatformEntry(id: string, patch: Partial<PlatformEntry>): Promise<PlatformEntry>

  // ---------------------------------------------------- الضريبة وأوامر الصرف
  getTaxSettings(): Promise<TaxSettings>
  updateTaxSettings(patch: Partial<TaxSettings>): Promise<TaxSettings>

  listInvoices(query?: { userId?: string; orderId?: string }): Promise<TaxInvoice[]>
  getInvoice(idOrReference: string): Promise<TaxInvoice | null>
  /** آخر تجزئة في السلسلة — `null` قبل أوّل فاتورة */
  lastInvoiceHash(): Promise<string | null>
  createInvoice(input: NewTaxInvoice): Promise<TaxInvoice>

  listDisbursements(query?: {
    status?: Disbursement['status'][]
    beneficiaryId?: string
    orderId?: string
  }): Promise<Disbursement[]>
  getDisbursement(idOrReference: string): Promise<Disbursement | null>
  createDisbursement(input: NewDisbursement): Promise<Disbursement>
  updateDisbursement(id: string, patch: Partial<Disbursement>): Promise<Disbursement>

  getPaymentSettings(): Promise<PaymentSettings>
  updatePaymentSettings(patch: Partial<PaymentSettings>): Promise<PaymentSettings>

  // ---- الأسئلة الشائعة
  listFaq(query?: { publishedOnly?: boolean; onListingOnly?: boolean }): Promise<FaqItem[]>
  getFaq(id: string): Promise<FaqItem | null>
  createFaq(input: NewFaqItem): Promise<FaqItem>
  updateFaq(id: string, patch: Partial<FaqItem>): Promise<FaqItem>
  deleteFaq(id: string): Promise<void>

  // ---- الإدارة
  findAdminByEmail(email: string): Promise<AdminRecord | null>
  findAdmin(id: string): Promise<AdminAccount | null>
  touchAdminLogin(id: string, at: string): Promise<void>
  listUsers(): Promise<User[]>
  listAllBids(): Promise<Bid[]>
  listAllOrders(): Promise<Order[]>
  listAudits(limit?: number): Promise<AuditLog[]>

  // ---- الأحداث والتدقيق
  appendEvent(input: {
    listingId: string
    eventType: ListingEventType
    payload: Record<string, unknown>
  }): Promise<ListingEvent>
  listEvents(listingId: string, limit?: number): Promise<ListingEvent[]>
  appendAudit(input: {
    actorId: string | null
    action: string
    entityType: string
    entityId: string
    beforeData: Record<string, unknown> | null
    afterData: Record<string, unknown> | null
  }): Promise<void>
}
