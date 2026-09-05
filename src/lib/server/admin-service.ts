/**
 * خدمات لوحة الإدارة: مؤشرات المنصّة، وقوائم المستخدمين والإعلانات والصفقات
 * والعرابين، وإدارة الأسئلة الشائعة.
 *
 * كل ما هنا يفترض أن المستدعي أدمن موثّق — الحراسة في `require-admin`.
 */
import {
  availableBalance,
  type AdminMetrics,
  type AuditLog,
  type AdminUserRow,
  type Bid,
  EMPTY_SOCIAL,
  ORDER_STATUS_LABELS,
  isEscrowHeld,
  type SocialHandles,
  type DepositStatus,
  type Offer,
  type Deposit,
  type Disbursement,
  type FaqItem,
  type SaleType,
  type TaxInvoice,
  type LedgerEntry,
  type Listing,
  type Notification,
  type Order,
  type Payment,
  type PlatformEntry,
  type Plate,
  type User,
} from '@/lib/domain/types'
import { isOverdue, paymentDueAt } from '@/lib/domain/wallet'
import { parseReference } from '@/lib/domain/reference'
import { formatAmount, type Halalas } from '@/lib/domain/money'
import { findHighestBid } from '@/lib/domain/auction'
import { getStore } from '@/lib/store'
import type { AuctionStore, NewFaqItem } from '@/lib/store/types'
import {
  ServiceError,
  closeListing,
  relistListing,
  releaseLosingDeposits,
} from './market-service'
import { forfeitDeposit } from './wallet-service'
import { sendPaymentReminders } from './order-service'
import { releaseOrderEscrow, refundOrderEscrow } from './escrow-service'
import { notify } from './notification-service'
import { isPayable } from './disbursement-service'
import { verifyInvoiceChain } from './invoice-service'

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

// ---------------------------------------------------------------- المؤشرات

/** لوحة المؤشرات: صورة واحدة عن حال المنصّة. */
export async function getMetrics(): Promise<AdminMetrics> {
  const store = getStore()
  const now = Date.now()
  const [users, listings, bids, orders, wallets, deposits, review] = await Promise.all([
    store.listUsers(),
    store.listListings({ includeDrafts: true }),
    store.listAllBids(),
    store.listAllOrders(),
    store.listWallets(),
    store.listDeposits({}),
    store.listPayments({ status: ['under_review'] }),
  ])
  const platform = await store.listPlatformEntries({})

  return {
    users: users.length,
    listings: listings.length,
    activeListings: listings.filter((l) => l.status === 'active').length,
    liveAuctions: listings.filter((l) => l.status === 'active' && l.saleType === 'auction').length,
    bids: bids.filter((b) => b.status === 'accepted').length,
    orders: orders.length,
    openOrders: orders.filter((o) => o.status === 'awaiting_settlement').length,
    overdueOrders: orders.filter((o) => isOverdue(o, now)).length,
    defaultedOrders: orders.filter((o) => o.status === 'defaulted').length,
    grossSales: orders
      .filter((o) => o.status === 'completed')
      .reduce((sum, o) => sum + o.amount, 0),
    walletBalance: wallets.reduce((sum, w) => sum + w.balance, 0),
    heldDeposits: deposits.filter((d) => d.status === 'held').reduce((s, d) => s + d.amount, 0),
    forfeitedDeposits: deposits
      .filter((d) => d.status === 'forfeited')
      .reduce((s, d) => s + d.amount, 0),
    paymentsUnderReview: review.length,
    paymentsUnderReviewAmount: review.reduce((sum, p) => sum + p.amount, 0),
    /*
     * ما تحمله المنصّة أمانةً الآن — وهو أهمّ رقم في اللوحة.
     *
     * ليس مالها: عرابين محجوزة لمزايدين، ومبالغ صفقات محبوسة حتى نقل الملكية.
     * وكان مبعثرًا بين ثلاث صفحات، فلا يعرف المشغّل قدر ما بين يديه.
     */
    escrowHeld: orders
      .filter((order) => isEscrowHeld(order.status))
      .reduce((sum, order) => sum + order.escrowAmount, 0),
    escrowOrders: orders.filter((order) => isEscrowHeld(order.status)).length,
    revenueByDay: revenueSeries(platform, now),
  }
}

/**
 * إيراد سبعة أيام — سلسلة تُقرأ منحنى لا جدولًا.
 *
 * تُحسب على الخادم من قيود الإيراد المحصَّلة، فلا مكتبة رسم ولا طلب ثانٍ:
 * سبع قيم يرسمها SVG صغير.
 */
function revenueSeries(entries: PlatformEntry[], nowMs: number): { day: string; amount: number }[] {
  const DAY = 86_400_000
  const start = new Date(nowMs).setHours(0, 0, 0, 0)
  const buckets: { day: string; amount: number }[] = []

  for (let index = 6; index >= 0; index--) {
    const from = start - index * DAY
    const to = from + DAY
    const amount = entries
      .filter((entry) => {
        if (!entry.settled) return false
        const at = Date.parse(entry.settledAt ?? entry.createdAt)
        return at >= from && at < to
      })
      .reduce((sum, entry) => sum + entry.amount, 0)
    buckets.push({ day: new Date(from).toISOString(), amount })
  }
  return buckets
}

// ---------------------------------------------------------------- المستخدمون

/** قائمة المستخدمين مع أرصدتهم ونشاطهم — أساس صفحة المستخدمين. */
export async function listUserRows(): Promise<AdminUserRow[]> {
  const store = getStore()
  const now = Date.now()
  const [users, listings, bids, orders] = await Promise.all([
    store.listUsers(),
    store.listListings({ includeDrafts: true }),
    store.listAllBids(),
    store.listAllOrders(),
  ])

  const rows: AdminUserRow[] = []
  for (const user of users) {
    const wallet = await store.getWallet(user.id)
    const mine = listings.filter((l) => l.sellerId === user.id)
    const purchases = orders.filter((o) => o.buyerId === user.id)
    rows.push({
      id: user.id,
      reference: user.reference,
      displayName: user.displayName,
      handle: user.handle,
      email: user.email,
      phone: user.phone,
      city: user.city,
      createdAt: user.createdAt,
      balance: wallet.balance,
      held: wallet.held,
      available: availableBalance(wallet),
      listingCount: mine.length,
      activeListingCount: mine.filter((l) => l.status === 'active').length,
      bidCount: bids.filter((b) => b.bidderId === user.id && b.status === 'accepted').length,
      purchaseCount: purchases.length,
      saleCount: orders.filter((o) => o.sellerId === user.id).length,
      overdueCount: purchases.filter((o) => isOverdue(o, now)).length,
    })
  }
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export type AdminUserDetail = {
  user: User
  wallet: { balance: number; held: number; available: number }
  ledger: LedgerEntry[]
  deposits: (Deposit & { plateLabel: string })[]
  listings: (Listing & { plate: Plate; bidCount: number; highestAmount: number | null })[]
  purchases: (Order & { plate: Plate; counterpartName: string; overdue: boolean })[]
  sales: (Order & { plate: Plate; counterpartName: string; overdue: boolean })[]
  /** مزايداته على لوحات غيره — لم تكن معروضة للأدمن من قبل */
  bids: {
    listingId: string
    plate: Plate
    plateLabel: string
    myHighest: Halalas
    currentHighest: Halalas | null
    isHighest: boolean
    listingStatus: Listing['status']
    endsAt: string | null
  }[]
  payments: Payment[]
  notifications: Notification[]
  /** مؤشّرات موجزة تُقرأ قبل الجداول */
  summary: {
    totalSpent: Halalas
    totalEarned: Halalas
    topupTotal: Halalas
    forfeitedTotal: Halalas
    activeBids: number
    leadingBids: number
    overdueOrders: number
    defaultedOrders: number
    heldDeposits: number
  }
}

/** ملفّ مستخدم كامل: بياناته ومحفظته وكشفه ومعاملاته. */
/**
 * يجد المستخدم بـ**رقم عضويته** أو بمعرّفه الداخلي.
 *
 * الرابط يحمل الرقم المرجعي (`/admin/users/U26-00003`) فيتطابق ما في شريط
 * العنوان مع ما يقرؤه الأدمن في الصفحة ويُمليه في مكالمة. والمعرّف الداخلي
 * يبقى مقبولًا كي لا تنكسر روابط محفوظة من قبل.
 */
async function resolveUser(handle: string) {
  const store = getStore()
  const parsed = parseReference(handle)
  if (parsed?.kind === 'user') {
    const users = await store.listUsers()
    return users.find((user) => user.reference === parsed.canonical) ?? null
  }
  return store.findUser(handle)
}

export async function getUserDetail(handle: string): Promise<AdminUserDetail> {
  const store = getStore()
  const user = await resolveUser(handle)
  if (!user) throw new ServiceError('المستخدم غير موجود', 404, 'USER_NOT_FOUND')
  const userId = user.id

  const now = Date.now()
  const wallet = await store.getWallet(userId)
  const ledger = await store.listLedger({ userId })
  const rawDeposits = await store.listDeposits({ userId })
  const rawListings = await store.listListings({ sellerId: userId, includeDrafts: true })

  const deposits = []
  for (const deposit of rawDeposits) {
    const listing = await store.getListing(deposit.listingId)
    deposits.push({
      ...deposit,
      plateLabel: listing ? `${listing.arabicLetters} ${listing.plateNumbers}` : '—',
    })
  }

  const listings = []
  for (const listing of rawListings) {
    const bids = (await store.listBids(listing.id)).filter((b) => b.status === 'accepted')
    const highest = findHighestBid(bids)
    listings.push({
      ...listing,
      plate: toPlate(listing),
      bidCount: bids.length,
      highestAmount: highest?.amount ?? null,
    })
  }

  const decorate = async (orders: Order[], side: 'buyer' | 'seller') => {
    const out = []
    for (const order of orders) {
      const listing = await store.getListing(order.listingId)
      if (!listing) continue
      const other = await store.findUser(side === 'buyer' ? order.sellerId : order.buyerId)
      out.push({
        ...order,
        plate: toPlate(listing),
        counterpartName: other?.displayName ?? 'مستخدم',
        overdue: isOverdue(order, now),
      })
    }
    return out
  }

  const purchases = await decorate(await store.listOrders({ buyerId: userId }), 'buyer')
  const sales = await decorate(await store.listOrders({ sellerId: userId }), 'seller')
  const payments = await store.listPayments({ userId })
  const notifications = await store.listNotifications(userId, 10)

  // مزايداته على لوحات غيره
  const myBids = (await store.listBidsByBidder(userId)).filter((bid) => bid.status === 'accepted')
  const byListing = new Map<string, Halalas>()
  for (const bid of myBids) {
    byListing.set(bid.listingId, Math.max(byListing.get(bid.listingId) ?? 0, bid.amount))
  }
  const bids: AdminUserDetail['bids'] = []
  for (const [listingId, myHighest] of byListing) {
    const target = await store.getListing(listingId)
    if (!target) continue
    const highest = findHighestBid(
      (await store.listBids(listingId)).filter((bid) => bid.status === 'accepted'),
    )
    bids.push({
      listingId,
      plate: toPlate(target),
      plateLabel: `${target.arabicLetters} ${target.plateNumbers}`,
      myHighest,
      currentHighest: highest?.amount ?? null,
      isHighest: highest?.bidderId === userId,
      listingStatus: target.status,
      endsAt: target.endsAt,
    })
  }
  bids.sort((a, b) => Number(b.isHighest) - Number(a.isHighest))

  return {
    user,
    wallet: { balance: wallet.balance, held: wallet.held, available: availableBalance(wallet) },
    ledger,
    deposits,
    listings,
    purchases,
    sales,
    bids,
    payments,
    notifications,
    summary: {
      totalSpent: purchases.filter((o) => o.status === 'completed').reduce((s, o) => s + o.amount, 0),
      totalEarned: sales.filter((o) => o.status === 'completed').reduce((s, o) => s + o.amount, 0),
      topupTotal: ledger.filter((e) => e.type === 'topup').reduce((s, e) => s + e.amount, 0),
      forfeitedTotal: deposits
        .filter((d) => d.status === 'forfeited')
        .reduce((s, d) => s + d.amount, 0),
      activeBids: bids.filter((b) => b.listingStatus === 'active').length,
      leadingBids: bids.filter((b) => b.isHighest && b.listingStatus === 'active').length,
      overdueOrders: purchases.filter((o) => o.overdue).length,
      defaultedOrders: purchases.filter((o) => o.status === 'defaulted').length,
      heldDeposits: deposits.filter((d) => d.status === 'held').length,
    },
  }
}

// ---------------------------------------------------------------- الإعلانات والصفقات

export type AdminListingRow = Listing & {
  plate: Plate
  sellerName: string
  /** رقم عضوية البائع — ليحمل الرابط رقمًا مقروءًا لا معرّفًا داخليًا */
  sellerReference: string
  bidCount: number
  highestAmount: number | null
  heldDeposits: number
}

export async function listAdminListings(): Promise<AdminListingRow[]> {
  const store = getStore()
  const listings = await store.listListings({ includeDrafts: true })
  const rows: AdminListingRow[] = []

  for (const listing of listings) {
    const seller = await store.findUser(listing.sellerId)
    const bids = (await store.listBids(listing.id)).filter((b) => b.status === 'accepted')
    const deposits = await store.listDeposits({ listingId: listing.id, status: ['held'] })
    rows.push({
      ...listing,
      plate: toPlate(listing),
      sellerReference: seller?.reference ?? listing.sellerId,
      sellerName: seller?.displayName ?? 'مستخدم',
      bidCount: bids.length,
      highestAmount: findHighestBid(bids)?.amount ?? null,
      heldDeposits: deposits.length,
    })
  }
  return rows
}

export type AdminOrderRow = Order & {
  buyerReference: string
  sellerReference: string
  plate: Plate
  buyerName: string
  sellerName: string
  overdue: boolean
  depositAmount: number
  depositStatus: Deposit['status'] | null
}

export async function listAdminOrders(): Promise<AdminOrderRow[]> {
  const store = getStore()
  await sendPaymentReminders(store)
  const now = Date.now()
  const orders = await store.listAllOrders()
  const rows: AdminOrderRow[] = []

  for (const order of orders) {
    const listing = await store.getListing(order.listingId)
    if (!listing) continue
    const [buyer, seller] = await Promise.all([
      store.findUser(order.buyerId),
      store.findUser(order.sellerId),
    ])
    const deposit = order.depositId ? await store.getDeposit(order.depositId) : null
    rows.push({
      ...order,
      plate: toPlate(listing),
      buyerName: buyer?.displayName ?? 'مستخدم',
      buyerReference: buyer?.reference ?? order.buyerId,
      sellerName: seller?.displayName ?? 'مستخدم',
      sellerReference: seller?.reference ?? order.sellerId,
      overdue: isOverdue(order, now),
      depositAmount: deposit?.amount ?? 0,
      depositStatus: deposit?.status ?? null,
    })
  }
  return rows
}

export type AdminDepositRow = Deposit & {
  plate: Plate
  plateLabel: string
  userName: string
  userReference: string
  listingStatus: Listing['status']
  /** صفقته تجاوزت مهلة السداد */
  overdue: boolean
  /** نسبة المصادرة المطبَّقة على هذا الإعلان */
  forfeitPercent: number
  /**
   * ما تُتيحه القواعد — يُحسب **هنا** لا في الصفحة.
   * الواجهة تعرض ما يسمح به الخادم فعلًا، فلا يظهر زرّ يرفضه الخادم ولا
   * يُخفى إجراء مسموح.
   */
  canForfeit: boolean
  canRefund: boolean
  canUndo: boolean
}

export async function listAdminDeposits(): Promise<AdminDepositRow[]> {
  const store = getStore()
  await sendPaymentReminders(store)
  const deposits = await store.listDeposits({})
  const now = Date.now()
  const rows: AdminDepositRow[] = []

  for (const deposit of deposits) {
    const listing = await store.getListing(deposit.listingId)
    if (!listing) continue
    const user = await store.findUser(deposit.userId)

    const orders = await store.listOrders({ listingId: deposit.listingId })
    const order = orders.find((row) => row.buyerId === deposit.userId) ?? null
    const overdue = Boolean(order) && (order!.status === 'defaulted' || isOverdue(order!, now))

    const bids = await store.listBids(deposit.listingId)
    const stillBidding =
      listing.status === 'active' &&
      bids.some((bid) => bid.bidderId === deposit.userId && bid.status === 'accepted')

    const undoUntil = deposit.resolvedAt
      ? Date.parse(deposit.resolvedAt) + listing.forfeitUndoWindowHours * 3_600_000
      : 0

    rows.push({
      ...deposit,
      plate: toPlate(listing),
      plateLabel: `${listing.arabicLetters} ${listing.plateNumbers}`,
      userName: user?.displayName ?? 'مستخدم',
      userReference: user?.reference ?? deposit.userId,
      listingStatus: listing.status,
      overdue,
      forfeitPercent: listing.forfeitPercent,
      canForfeit:
        deposit.status === 'held' &&
        overdue &&
        order?.status !== 'completed' &&
        listing.forfeitPercent > 0,
      canRefund: deposit.status === 'held' && !stillBidding,
      canUndo:
        deposit.status === 'forfeited' &&
        listing.forfeitUndoWindowHours > 0 &&
        now <= undoUntil,
    })
  }
  return rows
}

/** سطر في سجلّ التدقيق مع اسم منفّذه — المعرّف وحده لا يُقرأ. */
export type AdminAuditRow = AuditLog & { actorName: string }

/** ترجمة أفعال التدقيق إلى عربية مفهومة. */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'wallet.topup': 'شحن رصيد',
  'wallet.withdrawal': 'خصم رصيد',
  'wallet.adjustment': 'تسوية رصيد',
  'deposit.forfeit': 'مصادرة عربون',
  'deposit.refund': 'ردّ عربون',
  'order.status': 'تغيير حالة صفقة',
  'listing.suspend': 'إيقاف إعلان',
  'listing.reinstate': 'رفع إيقاف إعلان',
  'faq.create': 'إضافة سؤال',
  'faq.update': 'تعديل سؤال',
  'faq.delete': 'حذف سؤال',
  'payment.paid': 'تأكيد دفعة',
  'payment.failed': 'رفض دفعة',
  'payments.settings': 'تعديل إعدادات الدفع',
  'auction.settings': 'تعديل إعدادات المزاد',
  'order.reaward': 'إعادة إرساء مزاد',
  'order.release': 'تحويل مبلغ الصفقة للبائع',
  'order.refund': 'استرداد مبلغ الصفقة',
  'order.dispute.resolve': 'فصل اعتراض',
}

export async function listAdminAudits(limit = 200): Promise<AdminAuditRow[]> {
  const store = getStore()
  const audits = await store.listAudits(limit)
  const names = new Map<string, string>()
  const rows: AdminAuditRow[] = []

  for (const audit of audits) {
    if (!audit.actorId) {
      rows.push({ ...audit, actorName: 'النظام' })
      continue
    }
    if (!names.has(audit.actorId)) {
      const admin = await store.findAdmin(audit.actorId)
      const user = admin ? null : await store.findUser(audit.actorId)
      names.set(audit.actorId, admin?.displayName ?? user?.displayName ?? 'غير معروف')
    }
    rows.push({ ...audit, actorName: names.get(audit.actorId)! })
  }
  return rows
}

export type AdminLedgerRow = LedgerEntry & { userName: string; userReference: string }

export async function listAdminLedger(limit = 200): Promise<AdminLedgerRow[]> {
  const store = getStore()
  const entries = await store.listLedger({ limit })
  const users = new Map<string, { name: string; reference: string }>()
  const rows: AdminLedgerRow[] = []

  for (const entry of entries) {
    if (!users.has(entry.userId)) {
      const user = await store.findUser(entry.userId)
      users.set(entry.userId, {
        name: user?.displayName ?? 'مستخدم',
        reference: user?.reference ?? entry.userId,
      })
    }
    const user = users.get(entry.userId)!
    rows.push({ ...entry, userName: user.name, userReference: user.reference })
  }
  return rows
}

/** الأدمن يُغلق صفقة أو يعلّق تخلّفها — ويخصم العربون عند الإتمام. */
export async function setOrderStatusByAdmin(input: {
  orderId: string
  status: Order['status']
  adminId: string
}): Promise<Order> {
  const store = getStore()
  const order = await store.getOrder(input.orderId)
  if (!order) throw new ServiceError('الطلب غير موجود', 404, 'ORDER_NOT_FOUND')
  if (order.status === input.status) {
    throw new ServiceError('الطلب على هذه الحالة مسبقًا', 409, 'ORDER_UNCHANGED')
  }

  /*
   * `completed` نهائية: عندها خرج المال وخُصم العربون وقُيّد الإيراد.
   * إخراجها منها بضغطة يترك الدفتر يروي شيئًا والحالة تروي غيره — والتصحيح
   * موضعه قيود تسوية موثّقة لا تبديل حالة.
   */
  if (order.status === 'completed') {
    throw new ServiceError(
      'الصفقة مكتملة — صحّح بقيد تسوية لا بتغيير حالتها',
      409,
      'ORDER_COMPLETED',
    )
  }

  /*
   * ولا إتمام قبل وصول المال — القاعدة نفسها التي تحرس زرّ البائع.
   * كانت الدالّة تقبل أي حالة من أي حالة بلا فحص تمويل إطلاقًا.
   */
  /*
   * الأدمن لا يُعلّم صفقة مكتملة — يُفرج عنها.
   *
   * الإفراج فعل ماليّ له قيوده (عائد للبائع، وإيراد مقتطع)، فلا يُختصر في
   * تبديل حالة. وموضعه `resolveDispute` أو الإفراج المباشر.
   */
  if (input.status === 'completed') {
    throw new ServiceError(
      'الإتمام يقع بتحويل المبلغ لا بتبديل الحالة — استعمل قرار التحويل',
      409,
      'USE_RELEASE_FLOW',
    )
  }
  const updated = await store.updateOrderStatus(order.id, input.status, Date.now())

  if (input.status === 'defaulted') {
    await notify(store, {
      userId: order.buyerId,
      type: 'order_defaulted',
      title: 'أُعلن تخلّفك عن السداد',
      body: 'انتهت مهلة السداد ولم تكتمل الصفقة.',
      href: '/account/purchases',
      listingId: order.listingId,
    })
  }
  await store.appendAudit({
    actorId: input.adminId,
    action: 'order.status',
    entityType: 'order',
    entityId: order.id,
    beforeData: { status: order.status },
    afterData: { status: input.status },
  })
  return updated
}

// ---------------------------------------------------------------- الأسئلة الشائعة

export async function listFaqForAdmin(): Promise<FaqItem[]> {
  return getStore().listFaq()
}

/**
 * الأسئلة المنشورة للعامة.
 *
 * بلا `saleType` تُرجع كلّ المنشور — وهي صفحة الأسئلة. ومعه تُرجع ما اختير
 * لتلك الطريقة وحدها، فيقرأ المزايد ما يخصّ المزاد ولا يقرأ ما يخصّ السوم.
 */
export async function listPublicFaq(saleType?: SaleType): Promise<FaqItem[]> {
  return getStore().listFaq({ publishedOnly: true, saleType })
}

export async function createFaq(input: NewFaqItem, adminId: string): Promise<FaqItem> {
  const store = getStore()
  const item = await store.createFaq(input)
  await store.appendAudit({
    actorId: adminId,
    action: 'faq.create',
    entityType: 'faq',
    entityId: item.id,
    beforeData: null,
    afterData: { question: item.question },
  })
  return item
}

export async function updateFaq(
  id: string,
  patch: Partial<NewFaqItem>,
  adminId: string,
): Promise<FaqItem> {
  const store = getStore()
  const before = await store.getFaq(id)
  if (!before) throw new ServiceError('السؤال غير موجود', 404, 'FAQ_NOT_FOUND')
  const item = await store.updateFaq(id, patch)
  await store.appendAudit({
    actorId: adminId,
    action: 'faq.update',
    entityType: 'faq',
    entityId: id,
    beforeData: { question: before.question },
    afterData: { question: item.question },
  })
  return item
}

export async function deleteFaq(id: string, adminId: string): Promise<void> {
  const store = getStore()
  const before = await store.getFaq(id)
  if (!before) throw new ServiceError('السؤال غير موجود', 404, 'FAQ_NOT_FOUND')
  await store.deleteFaq(id)
  await store.appendAudit({
    actorId: adminId,
    action: 'faq.delete',
    entityType: 'faq',
    entityId: id,
    beforeData: { question: before.question },
    afterData: null,
  })
}

/** إيقاف إعلان مخالف. */
/**
 * إيقاف إعلان مخالف — حالة `suspended` لا `cancelled`.
 *
 * الفرق ليس تسمية: `cancelled` ملك البائع يعيد عرضه متى شاء، فلو أُوقف
 * المخالف بها لأبطل الإيقاف بضغطتين. و`suspended` لا يرفعها إلا الإدارة، ولا
 * يُحذف إعلانها فيبقى الدليل.
 */
export async function suspendListingByAdmin(
  listingId: string,
  adminId: string,
  reason: string,
): Promise<Listing> {
  const store = getStore()
  const listing = await store.getListing(listingId)
  if (!listing) throw new ServiceError('الإعلان غير موجود', 404, 'LISTING_NOT_FOUND')
  if (listing.status === 'suspended') {
    throw new ServiceError('الإعلان موقوف مسبقًا', 409, 'ALREADY_SUSPENDED')
  }

  const updated = await closeListing(store, listingId, 'suspended', reason)
  await notify(store, {
    userId: listing.sellerId,
    type: 'listing_suspended',
    title: 'أُوقف عرض لوحتك',
    body: `${listing.arabicLetters} ${listing.plateNumbers} — ${reason}`,
    href: '/account/listings',
    listingId,
  })
  await store.appendAudit({
    actorId: adminId,
    action: 'listing.suspend',
    entityType: 'listing',
    entityId: listingId,
    beforeData: { status: listing.status },
    afterData: { status: 'suspended', reason },
  })
  return updated
}

/**
 * رفع الإيقاف — يعود الإعلان **مسودّة** لا معروضًا.
 *
 * الإدارة ترفع المنع ولا تنشر نيابةً عن البائع؛ وهو ينشر فيبدأ المزاد بمدّة
 * كاملة جديدة، فلا يعود بوقتٍ انقضى أثناء الإيقاف.
 */
export async function reinstateListingByAdmin(
  listingId: string,
  adminId: string,
  reason: string,
): Promise<Listing> {
  const store = getStore()
  const listing = await store.getListing(listingId)
  if (!listing) throw new ServiceError('الإعلان غير موجود', 404, 'LISTING_NOT_FOUND')
  if (listing.status !== 'suspended') {
    throw new ServiceError('الإعلان ليس موقوفًا', 409, 'NOT_SUSPENDED')
  }

  const { listing: updated } = await relistListing(store, listing)
  await notify(store, {
    userId: listing.sellerId,
    type: 'listing_reinstated',
    title: 'رُفع الإيقاف عن لوحتك',
    body: `${listing.arabicLetters} ${listing.plateNumbers} — ${reason}. عادت مسودّة، انشرها متى شئت.`,
    href: '/account/listings',
    listingId,
  })
  await store.appendAudit({
    actorId: adminId,
    action: 'listing.reinstate',
    entityType: 'listing',
    entityId: listingId,
    beforeData: { status: 'suspended' },
    afterData: { status: 'draft', reason },
  })
  return updated
}

export type { AuctionStore }


// ---------------------------------------------------------------- إعادة الإرساء

export type NextBidderOption = {
  userId: string
  userName: string
  amount: Halalas
  bidId: string
  /** هل ما زال عربونه محجوزًا؟ بلا عربون لا ضمان لجدّيته */
  depositHeld: boolean
}

export type ReawardContext = {
  order: Order
  listing: Listing
  plateLabel: string
  currentWinnerName: string
  currentDepositAmount: Halalas
  currentDepositHeld: boolean
  overdue: boolean
  candidates: NextBidderOption[]
}

/**
 * يجمع ما تحتاجه الإدارة لقرار إعادة الإرساء: الفائز المتخلّف وعربونه،
 * والمزايدون الذين يلونه مرتّبين تنازليًا.
 */
export async function getReawardContext(orderId: string): Promise<ReawardContext> {
  const store = getStore()
  const order = await store.getOrder(orderId)
  if (!order) throw new ServiceError('الطلب غير موجود', 404, 'ORDER_NOT_FOUND')

  const listing = await store.getListing(order.listingId)
  if (!listing) throw new ServiceError('الإعلان غير موجود', 404, 'LISTING_NOT_FOUND')

  const bids = (await store.listBids(listing.id)).filter((bid) => bid.status === 'accepted')
  const deposits = await store.listDeposits({ listingId: listing.id })
  const heldBy = new Set(deposits.filter((d) => d.status === 'held').map((d) => d.userId))

  // أعلى مزايدة لكل مزايد، مرتّبة تنازليًا، بلا الفائز الحالي
  const best = new Map<string, { amount: Halalas; bidId: string }>()
  for (const bid of bids) {
    const current = best.get(bid.bidderId)
    if (!current || bid.amount > current.amount) {
      best.set(bid.bidderId, { amount: bid.amount, bidId: bid.id })
    }
  }
  best.delete(order.buyerId)

  const candidates: NextBidderOption[] = []
  for (const [userId, entry] of best) {
    const user = await store.findUser(userId)
    candidates.push({
      userId,
      userName: user?.displayName ?? 'مستخدم',
      amount: entry.amount,
      bidId: entry.bidId,
      depositHeld: heldBy.has(userId),
    })
  }
  candidates.sort((a, b) => b.amount - a.amount)

  const winnerDeposit = order.depositId ? await store.getDeposit(order.depositId) : null
  const buyer = await store.findUser(order.buyerId)

  return {
    order,
    listing,
    plateLabel: `${listing.arabicLetters} ${listing.plateNumbers}`,
    currentWinnerName: buyer?.displayName ?? 'مستخدم',
    currentDepositAmount: winnerDeposit?.amount ?? 0,
    currentDepositHeld: winnerDeposit?.status === 'held',
    overdue: isOverdue(order, Date.now()),
    candidates,
  }
}

/**
 * يُعيد إرساء المزاد على المزايد التالي.
 *
 * إجراء واحد يجمع ما يقع فعلًا في هذه الحالة: إعلان تخلّف الفائز، ومصادرة
 * عربونه اختياريًا، وإنشاء صفقة جديدة للمزايد التالي بمهلة سداد جديدة، وإشعار
 * الطرفين. تفريقها إلى خطوات يترك المزاد في حالة نصفية إن نُسيت خطوة.
 */
export async function reawardOrder(input: {
  orderId: string
  nextBidderId: string
  forfeitCurrentDeposit: boolean
  reason: string
  adminId: string
}): Promise<{ order: Order; forfeited: Halalas }> {
  const store = getStore()
  const context = await getReawardContext(input.orderId)
  const { order, listing } = context

  if (order.status === 'completed') {
    throw new ServiceError('الصفقة مكتملة — لا يمكن إعادة الإرساء', 409, 'ORDER_COMPLETED')
  }
  /*
   * ولا إرساء لصفقة **وصل مالها**: إعادة الإرساء تُنشئ صفقة لغير هذا المشتري
   * وتترك ما دفعه بلا صفقة تقابله — مالٌ يتيم في حساب المنصّة.
   */
  const paidRows = (await store.listPayments({ userId: order.buyerId })).filter(
    (row) => row.orderId === order.id && row.status === 'paid',
  )
  if (paidRows.length > 0) {
    throw new ServiceError(
      `سُدّدت هذه الصفقة (${paidRows[0].reference}) — ردّ المبلغ قبل إعادة الإرساء`,
      409,
      'ORDER_ALREADY_PAID',
    )
  }
  /*
   * لا إرساء مرّتين على الصفقة نفسها.
   *
   * كل نداء يُنشئ صفقة جديدة، فالضغط مرّتين كان يُنشئ صفقتين متطابقتين على
   * اللوحة نفسها لمشترٍ واحد — ولا يعرف أحد أيّهما الحقيقية.
   *
   * والدليل ليس ترتيب التواريخ — نداءان متتاليان قد يقعان في المللي نفسها —
   * بل رسوّ الإعلان: إن كانت اللوحة قد رست على غير مشتري هذه الصفقة فقد
   * أُعيد إرساؤها فعلًا.
   */
  if (listing.soldToUserId && listing.soldToUserId !== order.buyerId) {
    const current = (await store.listOrders({ listingId: listing.id })).find(
      (row) => row.buyerId === listing.soldToUserId,
    )
    throw new ServiceError(
      `أُعيد إرساء هذه الصفقة مسبقًا${current ? ` إلى ${current.reference}` : ''}`,
      409,
      'ALREADY_REAWARDED',
    )
  }
  const next = context.candidates.find((c) => c.userId === input.nextBidderId)
  if (!next) throw new ServiceError('هذا المزايد ليس ضمن مزايدي هذا المزاد', 409, 'NOT_A_BIDDER')

  // 1) الفائز المتخلّف: مصادرة عربونه إن طُلب، ثم إعلان تخلّفه
  let forfeited = 0
  if (input.forfeitCurrentDeposit && order.depositId && context.currentDepositHeld) {
    const deposit = await forfeitDeposit({
      depositId: order.depositId,
      adminId: input.adminId,
      reason: input.reason,
    })
    forfeited = deposit.forfeitedAmount
  } else if (order.depositId && context.currentDepositHeld) {
    // بلا مصادرة: لا يبقى عربونه محجوزًا على مزادٍ خرج منه
    await releaseLosingDeposits(store, listing.id, next.userId, 'أُعيد الإرساء بلا مصادرة')
  }
  if (order.status !== 'defaulted') {
    await store.updateOrderStatus(order.id, 'defaulted', Date.now())
  }
  await notify(store, {
    userId: order.buyerId,
    type: 'order_defaulted',
    title: 'أُعيد إرساء المزاد على مزايد آخر',
    body: `${input.reason} — «${context.plateLabel}».`,
    href: '/account/purchases',
    listingId: listing.id,
  })

  // 2) المزايد التالي: صفقة جديدة بمهلة سداد جديدة
  const now = Date.now()
  const deposits = await store.listDeposits({ listingId: listing.id, userId: next.userId })
  const heldDeposit = deposits.find((d) => d.status === 'held')

  const newOrder = await store.createOrder({
    listingId: listing.id,
    buyerId: next.userId,
    sellerId: listing.sellerId,
    amount: next.amount,
    source: 'auction',
    status: 'awaiting_settlement',
    paymentDueAt: paymentDueAt(listing, now),
    depositId: heldDeposit?.id ?? null,
  })

  await store.updateListing(listing.id, {
    status: 'sold',
    soldToUserId: next.userId,
    soldAmount: next.amount,
    highestBidId: next.bidId,
  })

  await notify(store, {
    userId: next.userId,
    type: 'auction_won',
    title: 'رست عليك اللوحة',
    body: `تخلّف الفائز السابق، فرست «${context.plateLabel}» عليك بـ${formatAmount(next.amount)} ريال — أتمّ السداد خلال ${listing.paymentWindowHours} ساعة.`,
    href: '/account/purchases',
    listingId: listing.id,
  })
  await notify(store, {
    userId: listing.sellerId,
    type: 'listing_sold',
    title: 'أُعيد إرساء لوحتك',
    body: `«${context.plateLabel}» على ${next.userName} بـ${formatAmount(next.amount)} ريال.`,
    href: '/account/sales',
    listingId: listing.id,
  })

  await store.appendAudit({
    actorId: input.adminId,
    action: 'order.reaward',
    entityType: 'order',
    entityId: order.id,
    beforeData: { buyerId: order.buyerId, amount: order.amount },
    afterData: {
      buyerId: next.userId,
      amount: next.amount,
      forfeited: input.forfeitCurrentDeposit,
      reason: input.reason,
    },
  })

  return { order: newOrder, forfeited }
}

// ------------------------------------------------------------ حساب المنصّة

export type RevenueRow = {
  id: string
  reference: string
  type: PlatformEntry['type']
  amount: Halalas
  userName: string
  plateLabel: string
  orderId: string | null
  settled: boolean
  reversed: boolean
  note: string
  createdAt: string
}

export type RevenueView = {
  rows: RevenueRow[]
  totals: {
    commission: Halalas
    vat: Halalas
    forfeits: Halalas
    /** المُحصَّل فعلًا — ما دخل المنصّة */
    settled: Halalas
    /** المستحقّ ولم يُحصَّل بعد */
    due: Halalas
    /** المُبطَل بتراجع عن مصادرة — لا يُحتسب إيرادًا */
    reversed: Halalas
  }
}

/** كل ما دخل المنصّة أو استحقّ لها، بمصدره وحالته. */
export async function getRevenue(): Promise<RevenueView> {
  const store = getStore()
  const entries = await store.listPlatformEntries()
  const rows: RevenueRow[] = []
  const totals = { commission: 0, vat: 0, forfeits: 0, settled: 0, due: 0, reversed: 0 }

  for (const entry of entries) {
    const user = entry.userId ? await store.findUser(entry.userId) : null
    const listing = entry.listingId ? await store.getListing(entry.listingId) : null
    const reversed = Boolean(entry.reversedAt)

    if (reversed) totals.reversed += entry.amount
    else {
      if (entry.type.startsWith('vat_')) totals.vat += entry.amount
      else if (entry.type === 'deposit_forfeit') totals.forfeits += entry.amount
      else totals.commission += entry.amount
      if (entry.settled) totals.settled += entry.amount
      else totals.due += entry.amount
    }

    rows.push({
      id: entry.id,
      reference: entry.reference,
      type: entry.type,
      amount: entry.amount,
      userName: user?.displayName ?? '—',
      plateLabel: listing ? `${listing.arabicLetters} ${listing.plateNumbers}` : '—',
      orderId: entry.orderId,
      settled: entry.settled,
      reversed,
      note: entry.note,
      createdAt: entry.createdAt,
    })
  }
  return { rows, totals }
}

// ------------------------------------------------------ تفاصيل إعلان للإدارة

export type AdminListingDetail = {
  listing: Listing
  plate: Plate
  seller: {
    id: string
    reference: string
    name: string
    email: string
    phone: string | null
    social: SocialHandles
  }
  /** كشف المزايدات كاملًا **بأسماء صريحة** — الإدارة تحقّق لا تُزايد */
  bids: {
    id: string
    /** تسلسل الخادم — ترتيب قاطع لا يعتمد على الساعة */
    sequence: number
    bidderId: string
    bidderReference: string
    bidderName: string
    amount: Halalas
    status: Bid['status']
    createdAt: string
    cancellationReason: string | null
  }[]
  /** المشاركون: أعلى مزايدة لكل مزايد وحالة عربونه */
  participants: {
    userId: string
    userReference: string
    name: string
    /** للإدارة وحدها — تحتاجه لحسم صفقة أو التحقّق قبل بثّ */
    phone: string | null
    social: SocialHandles
    bidCount: number
    highest: Halalas
    isHighest: boolean
    depositStatus: DepositStatus | null
    depositAmount: Halalas
  }[]
  offers: (Offer & { bidderName: string })[]
  orders: (Order & { buyerName: string; overdue: boolean })[]
  deposits: (Deposit & { userName: string })[]
  summary: {
    highest: Halalas | null
    bidderCount: number
    heldDeposits: Halalas
    reserveMet: boolean
    remainingMs: number
  }
}

/** يجد الإعلان برقمه المرجعي أو بمعرّفه الداخلي. */
async function resolveListing(handle: string): Promise<Listing | null> {
  const store = getStore()
  const parsed = parseReference(handle)
  if (parsed?.kind === 'listing') {
    const all = await store.listListings({ includeDrafts: true })
    return all.find((listing) => listing.reference === parsed.canonical) ?? null
  }
  return store.getListing(handle)
}

/**
 * صورة الإعلان كاملة للإدارة.
 *
 * تختلف عن صفحة السوق في أمرين جوهريين: **الأسماء صريحة** لا مقنّعة، لأن
 * الإدارة تحقّق في نزاع وتحتاج معرفة من زايد؛ و**السعر الاحتياطي ظاهر**، لأنه
 * سرٌّ عن المزايدين لا عن من يفصل بينهم.
 */
export async function getListingAdminDetail(handle: string): Promise<AdminListingDetail> {
  const store = getStore()
  const listing = await resolveListing(handle)
  if (!listing) throw new ServiceError('الإعلان غير موجود', 404, 'LISTING_NOT_FOUND')

  const now = Date.now()
  const [rawBids, rawOffers, rawOrders, rawDeposits, seller] = await Promise.all([
    store.listBids(listing.id),
    store.listOffers({ listingId: listing.id }),
    store.listOrders({ listingId: listing.id }),
    store.listDeposits({ listingId: listing.id }),
    store.findUser(listing.sellerId),
  ])

  const cache = new Map<
    string,
    { name: string; reference: string; phone: string | null; social: SocialHandles }
  >()
  const who = async (userId: string) => {
    if (!cache.has(userId)) {
      const user = await store.findUser(userId)
      cache.set(userId, {
        name: user?.displayName ?? 'مستخدم',
        reference: user?.reference ?? userId,
        phone: user?.phone ?? null,
        social: user?.social ?? EMPTY_SOCIAL,
      })
    }
    return cache.get(userId)!
  }

  const bids: AdminListingDetail['bids'] = []
  for (const bid of rawBids) {
    const user = await who(bid.bidderId)
    bids.push({
      id: bid.id,
      sequence: bid.serverSequence,
      bidderId: bid.bidderId,
      bidderReference: user.reference,
      bidderName: user.name,
      amount: bid.amount,
      status: bid.status,
      createdAt: bid.createdAt,
      cancellationReason: bid.cancellationReason,
    })
  }

  const accepted = bids.filter((bid) => bid.status === 'accepted')
  const highest = accepted.reduce<number | null>(
    (best, bid) => (best === null || bid.amount > best ? bid.amount : best),
    null,
  )

  const byUser = new Map<string, AdminListingDetail['participants'][number]>()
  for (const bid of accepted) {
    const current = byUser.get(bid.bidderId)
    if (current) {
      current.bidCount += 1
      current.highest = Math.max(current.highest, bid.amount)
    } else {
      const deposit = rawDeposits.find((row) => row.userId === bid.bidderId)
      const contact = await who(bid.bidderId)
      byUser.set(bid.bidderId, {
        userId: bid.bidderId,
        userReference: bid.bidderReference,
        name: bid.bidderName,
        phone: contact.phone,
        social: contact.social,
        bidCount: 1,
        highest: bid.amount,
        isHighest: false,
        depositStatus: deposit?.status ?? null,
        depositAmount: deposit?.amount ?? 0,
      })
    }
  }
  const participants = [...byUser.values()].sort((a, b) => b.highest - a.highest)
  for (const participant of participants) participant.isHighest = participant.highest === highest

  const offers: AdminListingDetail['offers'] = []
  for (const offer of rawOffers) {
    offers.push({ ...offer, bidderName: (await who(offer.buyerId)).name })
  }

  const orders: AdminListingDetail['orders'] = []
  for (const order of rawOrders) {
    orders.push({
      ...order,
      buyerName: (await who(order.buyerId)).name,
      overdue: isOverdue(order, now),
    })
  }

  const deposits: AdminListingDetail['deposits'] = []
  for (const deposit of rawDeposits) {
    deposits.push({ ...deposit, userName: (await who(deposit.userId)).name })
  }

  return {
    listing,
    plate: toPlate(listing),
    seller: {
      id: listing.sellerId,
      reference: seller?.reference ?? listing.sellerId,
      name: seller?.displayName ?? 'مستخدم',
      email: seller?.email ?? '—',
      phone: seller?.phone ?? null,
      social: seller?.social ?? EMPTY_SOCIAL,
    },
    bids,
    participants,
    offers,
    orders,
    deposits,
    summary: {
      highest,
      bidderCount: participants.length,
      heldDeposits: rawDeposits
        .filter((deposit) => deposit.status === 'held')
        .reduce((sum, deposit) => sum + deposit.amount, 0),
      reserveMet: highest !== null && highest >= listing.reservePrice,
      remainingMs: listing.endsAt ? Math.max(0, Date.parse(listing.endsAt) - now) : 0,
    },
  }
}

/**
 * عدّادات شارات التنقّل — ما ينتظر تصرّف الإدارة الآن.
 *
 * تُحسب في الخادم مع كل تصيير لصفحة إدارية، فلا تحتاج الشارة طلبًا خاصًّا ولا
 * تُصبح قديمة بين صفحة وأخرى.
 */
export async function getNavBadges(): Promise<{
  orders: number
  deposits: number
  payments: number
  payouts: number
}> {
  const store = getStore()
  const now = Date.now()
  const [orders, deposits, payments, payouts] = await Promise.all([
    store.listAllOrders(),
    store.listDeposits({ status: ['held'] }),
    store.listPayments({}),
    store.listDisbursements({ status: ['pending'] }),
  ])

  const overdue = orders.filter((order) => isOverdue(order, now))
  const overdueIds = new Set(overdue.map((order) => order.depositId).filter(Boolean))

  return {
    orders: overdue.length,
    // العربون المستحقّ للمصادرة وحده — لا كل محجوز
    deposits: deposits.filter((deposit) => overdueIds.has(deposit.id)).length,
    payments: payments.filter((payment) => payment.status === 'under_review').length,
    // القابل للصرف وحده: ما ينقصه حساب بنكي ينتظر صاحبه لا المحاسب
    payouts: payouts.filter(isPayable).length,
  }
}


// ------------------------------------------------------------ فصل الاعتراض

/**
 * قرار الإدارة في اعتراض: إفراج للبائع أو استرداد للمشتري.
 *
 * مخرجان لا ثالث لهما. والتسوية الجزئية تُنفَّذ بقيد تسوية موثّق **قبل** أحد
 * المخرجين — استثناء يُعالَج لا مرحلة تُضاف إلى الدورة.
 */
export async function resolveDispute(input: {
  orderId: string
  decision: 'release' | 'refund'
  reason: string
  adminId: string
}): Promise<Order> {
  const store = getStore()
  const order = await store.getOrder(input.orderId)
  if (!order) throw new ServiceError('الصفقة غير موجودة', 404, 'ORDER_NOT_FOUND')
  if (!isEscrowHeld(order.status)) {
    throw new ServiceError(
      `لا قرار على صفقة حالتها «${ORDER_STATUS_LABELS[order.status]}»`,
      409,
      'ORDER_STATE_INVALID',
    )
  }

  const resolved =
    input.decision === 'release'
      ? await releaseOrderEscrow(order, { by: 'admin', adminId: input.adminId })
      : await refundOrderEscrow(order, { reason: input.reason, adminId: input.adminId })

  await store.appendAudit({
    actorId: input.adminId,
    action: 'order.dispute.resolve',
    entityType: 'order',
    entityId: order.id,
    beforeData: { status: order.status, reason: order.disputeReason },
    afterData: { status: resolved.status, decision: input.decision, reason: input.reason },
  })
  return resolved
}

// ------------------------------------------------------------ أوامر الصرف

export type PayoutRow = Disbursement & {
  /** هل يكتمل حسابه البنكي؟ — أمرٌ بلا آيبان لا يُنفَّذ */
  payable: boolean
  /** رصيد المستفيد المتاح الآن — يُقرأ قبل الخصم لا بعده */
  beneficiaryBalance: Halalas
}

export type PayoutView = {
  rows: PayoutRow[]
  totals: {
    pending: Halalas
    pendingCount: number
    blocked: number
    paidThisMonth: Halalas
    paidCount: number
  }
}

/**
 * لوحة المحاسب: كل التزام على المنصّة وما نُفّذ منه.
 *
 * الترتيب من المخزَن: الأحدث أوّلًا. والمحجوب — أمرٌ ينقصه حساب بنكي —
 * يُحصى وحده: هو الوحيد الذي لا يمضي بقرار المحاسب بل بإكمال صاحبه بياناته.
 */
export async function getPayouts(): Promise<PayoutView> {
  const store = getStore()
  const rows = await store.listDisbursements()
  const totals = { pending: 0, pendingCount: 0, blocked: 0, paidThisMonth: 0, paidCount: 0 }

  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)

  const out: PayoutRow[] = []
  for (const row of rows) {
    const wallet = await store.getWallet(row.beneficiaryId)
    const payable = isPayable(row)
    if (row.status === 'pending') {
      totals.pending += row.amount
      totals.pendingCount += 1
      if (!payable) totals.blocked += 1
    }
    if (row.status === 'paid') {
      totals.paidCount += 1
      if (row.paidAt && Date.parse(row.paidAt) >= monthStart.getTime()) {
        totals.paidThisMonth += row.amount
      }
    }
    out.push({ ...row, payable, beneficiaryBalance: availableBalance(wallet) })
  }
  return { rows: out, totals }
}

// ------------------------------------------------------- الفواتير الضريبية

export type InvoiceView = {
  rows: TaxInvoice[]
  totals: { count: number; net: Halalas; vat: Halalas; total: Halalas }
  /** سلامة سلسلة التجزئة — كسرُها يعني فاتورة عُدّلت أو حُذفت */
  chain: { ok: boolean; brokenAt: string | null }
}

export async function getInvoices(): Promise<InvoiceView> {
  const store = getStore()
  const rows = await store.listInvoices()
  const totals = { count: rows.length, net: 0, vat: 0, total: 0 }
  for (const row of rows) {
    totals.net += row.netAmount
    totals.vat += row.vatAmount
    totals.total += row.totalAmount
  }
  // المخزَن يُرجع الأحدث أوّلًا، والسلسلة تُقرأ بترتيب إصدارها
  // لا يُعكس: التحقّق يمشي بروابط السلسلة فلا يعنيه ترتيب العرض
  return { rows, totals, chain: verifyInvoiceChain(rows) }
}
