/**
 * خدمات المحفظة: القراءة للمستخدم، والحركات الإدارية، وتسوية الصفقات.
 *
 * المنصّة لا تنفّذ تحويلًا ماليًا. الشحن والسحب يوثّقهما الأدمن بعد تمامهما
 * خارجها، وكل حركة تترك قيدًا لا يُمحى في كشف الحساب.
 */
import {
  availableBalance,
  type Deposit,
  type LedgerEntry,
  type Listing,
  type Order,
  type Wallet,
} from '@/lib/domain/types'
import { buildStatement, isOverdue, isWalletError, type Statement } from '@/lib/domain/wallet'
import type { Halalas } from '@/lib/domain/money'
import { getStore } from '@/lib/store'
import type { AuctionStore } from '@/lib/store/types'
import { ServiceError } from './market-service'
import { notify } from './notification-service'
import { formatAmount } from '@/lib/domain/money'

/** يحوّل أخطاء المحفظة النقية إلى أخطاء خدمة بحالة HTTP ورمز. */
function rethrow(error: unknown): never {
  if (isWalletError(error)) throw new ServiceError(error.message, 409, error.code)
  throw error
}

export type WalletView = {
  balance: Halalas
  held: Halalas
  available: Halalas
  statement: Statement
  deposits: (Deposit & { plateLabel: string })[]
  /**
   * عمولات استحقّت ولم تُقتطع لعجز الرصيد وقتها.
   *
   * تُعرض للمستخدم لا للإدارة وحدها: دَينٌ لا يعرف صاحبه به لا يُسدَّد، ومن
   * يرى المبلغ يشحن ويُغلقه.
   */
  dueCommission: Halalas
}

/** محفظة المستخدم مع كشف حسابه وعرابينه. */
export async function getWalletView(userId: string): Promise<WalletView> {
  const store = getStore()
  const wallet = await store.getWallet(userId)
  const entries = await store.listLedger({ userId })
  const deposits = await store.listDeposits({ userId })

  /*
   * أسماء اللوحات تُقرأ مرّةً واحدة لكل إعلان.
   *
   * العرابين والقيود كلاهما يشير إلى إعلانات، وبعضها الإعلان نفسه — فقراءةُ
   * كلّ سطرٍ على حدة تعيد الطلب عشرات المرّات على محفظةٍ نشِطة.
   */
  const plateNames = new Map<string, string>()
  const plateOf = (listingId: string) => plateNames.get(listingId) ?? null
  const ids = new Set<string>([
    ...deposits.map((deposit) => deposit.listingId),
    ...entries.map((entry) => entry.listingId).filter((id): id is string => Boolean(id)),
  ])
  for (const id of ids) {
    const listing = await store.getListing(id)
    if (listing) plateNames.set(id, `${listing.arabicLetters} ${listing.plateNumbers}`)
  }

  const decorated = deposits.map((deposit) => ({
    ...deposit,
    plateLabel: plateOf(deposit.listingId) ?? '—',
  }))

  const dueCommission = (await store.listPlatformEntries({ userId, settled: false }))
    .filter((entry) => !entry.reversedAt)
    .reduce((sum, entry) => sum + entry.amount, 0)

  return {
    balance: wallet.balance,
    held: wallet.held,
    available: availableBalance(wallet),
    statement: buildStatement(entries, wallet, plateOf),
    deposits: decorated,
    dueCommission,
  }
}

/** شحن أو خصم رصيد بأمر إداري موثّق. */
export async function adjustBalance(input: {
  userId: string
  amount: Halalas
  type: 'topup' | 'withdrawal' | 'adjustment'
  note: string | null
  adminId: string
}): Promise<{ wallet: Wallet; entry: LedgerEntry }> {
  const store = getStore()
  if (!(await store.findUser(input.userId))) {
    throw new ServiceError('المستخدم غير موجود', 404, 'USER_NOT_FOUND')
  }
  try {
    const result = await store.postLedgerEntry({
      userId: input.userId,
      type: input.type,
      amount: input.amount,
      listingId: null,
      depositId: null,
      orderId: null,
      note: input.note,
      actorAdminId: input.adminId,
    })
    await store.appendAudit({
      actorId: input.adminId,
      action: `wallet.${input.type}`,
      entityType: 'wallet',
      entityId: input.userId,
      beforeData: null,
      afterData: { amount: input.amount, balanceAfter: result.wallet.balance },
    })
    return result
  } catch (error) {
    rethrow(error)
  }
}

/**
 * مصادرة عربون فائز تخلّف عن السداد.
 * لا تجوز إلا بعد انقضاء المهلة وعلى صفقة ما زالت بانتظار السداد.
 */
export async function forfeitDeposit(input: {
  depositId: string
  adminId: string
  reason: string
}): Promise<Deposit> {
  const store = getStore()
  const deposit = await requireHeldDeposit(store, input.depositId)
  const { listing, order } = await requireForfeitable(store, deposit)

  // نسبة المصادرة من قواعد الإعلان وقت نشره لا من الإعدادات الحالية
  const percent = Math.max(0, Math.min(100, listing.forfeitPercent))
  if (percent === 0) {
    throw new ServiceError('المصادرة معطّلة في قواعد المزاد', 409, 'FORFEIT_DISABLED')
  }
  const forfeited = Math.round((deposit.amount * percent) / 100)
  const returned = deposit.amount - forfeited

  let ledgerEntryId: string | null = null
  try {
    const posted = await store.postLedgerEntry({
      userId: deposit.userId,
      type: 'deposit_forfeit',
      amount: forfeited,
      listingId: deposit.listingId,
      depositId: deposit.id,
      orderId: order?.id ?? null,
      note: input.reason,
      actorAdminId: input.adminId,
    })
    ledgerEntryId = posted.entry.id

    // الباقي بعد المصادرة الجزئية يعود إلى المتاح في العملية نفسها
    if (returned > 0) {
      await store.postLedgerEntry({
        userId: deposit.userId,
        type: 'deposit_release',
        amount: returned,
        listingId: deposit.listingId,
        depositId: deposit.id,
        orderId: order?.id ?? null,
        note: `الباقي بعد مصادرة ${percent}٪`,
        actorAdminId: input.adminId,
      })
    }
  } catch (error) {
    rethrow(error)
  }

  const updated = await store.updateDeposit(deposit.id, {
    status: 'forfeited',
    forfeitedAmount: forfeited,
    resolvedAt: new Date().toISOString(),
    resolvedByAdminId: input.adminId,
    reason: input.reason,
  })

  // ما خرج من المحفظة يدخل حساب المنصّة — قيد مزدوج لا خصم من طرف واحد
  await store.appendPlatformEntry({
    paymentId: null,
    type: 'deposit_forfeit',
    amount: forfeited,
    userId: deposit.userId,
    orderId: order?.id ?? null,
    listingId: deposit.listingId,
    depositId: deposit.id,
    settled: true,
    ledgerEntryId,
    note: input.reason,
    settledAt: new Date().toISOString(),
  })

  if (order && order.status === 'awaiting_settlement') {
    await store.updateOrderStatus(order.id, 'defaulted', Date.now())
  }
  await notify(store, {
    userId: deposit.userId,
    type: 'deposit_forfeited',
    title: 'صودر عربونك',
    body:
      returned > 0
        ? `صودر ${formatAmount(forfeited)} ريال (${percent}٪) وعاد ${formatAmount(returned)} ريال إلى رصيدك — ${input.reason}`
        : `${formatAmount(forfeited)} ريال — ${input.reason}`,
    href: '/account/wallet',
    listingId: deposit.listingId,
  })
  await store.appendAudit({
    actorId: input.adminId,
    action: 'deposit.forfeit',
    entityType: 'deposit',
    entityId: deposit.id,
    beforeData: { status: 'held', amount: deposit.amount },
    afterData: { status: 'forfeited', forfeited, returned, percent, reason: input.reason },
  })
  return updated
}

/**
 * شروط المصادرة — يحرسها **الخادم** لا الواجهة.
 *
 * إخفاء الزرّ ليس حراسة: طلب مباشر إلى نقطة الإدارة كان يصادر عربونًا في مزاد
 * ما زال جاريًا ولا صفقة له أصلًا. المال لا يُحرس بإخفاء زرّ.
 */
async function requireForfeitable(
  store: AuctionStore,
  deposit: Deposit,
): Promise<{ listing: Listing; order: Order | null }> {
  const listing = await store.getListing(deposit.listingId)
  if (!listing) throw new ServiceError('الإعلان غير موجود', 404, 'LISTING_NOT_FOUND')

  const orders = await store.listOrders({ listingId: deposit.listingId })
  const order = orders.find((row) => row.buyerId === deposit.userId) ?? null

  if (!order) {
    throw new ServiceError(
      'لا صفقة على هذا العربون — لا يُصادَر عربون مزايد لم ترسُ عليه اللوحة',
      409,
      'NO_ORDER_FOR_DEPOSIT',
    )
  }
  if (order.status === 'completed') {
    throw new ServiceError('الصفقة مكتملة — لا مصادرة بعد السداد', 409, 'ORDER_COMPLETED')
  }
  if (order.status !== 'defaulted' && !isOverdue(order, Date.now())) {
    throw new ServiceError(
      'مهلة السداد ما زالت قائمة — لا تجوز المصادرة قبل انقضائها',
      409,
      'FORFEIT_TOO_EARLY',
    )
  }
  return { listing, order }
}

/** ردّ عربون محجوز إلى الرصيد المتاح. */
export async function refundDeposit(input: {
  depositId: string
  adminId: string
  reason: string
}): Promise<Deposit> {
  const store = getStore()
  const deposit = await requireHeldDeposit(store, input.depositId)
  await requireRefundable(store, deposit)

  try {
    await store.postLedgerEntry({
      userId: deposit.userId,
      type: 'deposit_release',
      amount: deposit.amount,
      listingId: deposit.listingId,
      depositId: deposit.id,
      orderId: null,
      note: input.reason,
      actorAdminId: input.adminId,
    })
  } catch (error) {
    rethrow(error)
  }

  const updated = await store.updateDeposit(deposit.id, {
    status: 'released',
    resolvedAt: new Date().toISOString(),
    resolvedByAdminId: input.adminId,
    reason: input.reason,
  })
  await notify(store, {
    userId: deposit.userId,
    type: 'deposit_released',
    title: 'عاد عربونك إلى رصيدك',
    body: `عاد ${formatAmount(deposit.amount)} ريال إلى رصيدك المتاح.`,
    href: '/account/wallet',
    listingId: deposit.listingId,
  })
  await store.appendAudit({
    actorId: input.adminId,
    action: 'deposit.refund',
    entityType: 'deposit',
    entityId: deposit.id,
    beforeData: { status: 'held' },
    afterData: { status: 'released', amount: deposit.amount, reason: input.reason },
  })
  return updated
}

/**
 * شروط ردّ العربون.
 *
 * العربون ضمانٌ خلف مزايدات قائمة: ردّه ومزاده ما زال جاريًا يترك مزايدة بلا
 * مال يضمنها — وقد تكون هي الأعلى. الإدارة تُلغي المزايدة أولًا إن أرادت
 * تحرير المزايد.
 */
async function requireRefundable(store: AuctionStore, deposit: Deposit): Promise<void> {
  const listing = await store.getListing(deposit.listingId)
  if (!listing) return
  if (listing.status !== 'active') return

  const bids = await store.listBids(deposit.listingId)
  const stillBidding = bids.some(
    (bid) => bid.bidderId === deposit.userId && bid.status === 'accepted',
  )
  if (stillBidding) {
    throw new ServiceError(
      'المزاد ما زال جاريًا ولهذا المزايد مزايدة قائمة — ألغِ مزايدته قبل ردّ عربونه',
      409,
      'BIDS_STILL_STANDING',
    )
  }
}

async function requireHeldDeposit(store: AuctionStore, depositId: string): Promise<Deposit> {
  const deposit = await store.getDeposit(depositId)
  if (!deposit) throw new ServiceError('العربون غير موجود', 404, 'DEPOSIT_NOT_FOUND')
  if (deposit.status !== 'held') {
    throw new ServiceError('هذا العربون مسوّى مسبقًا', 409, 'DEPOSIT_RESOLVED')
  }
  return deposit
}

/**
 * يُخصم العربون المحجوز من قيمة الصفقة عند تحصيلها.
 *
 * ولا يُخصم ما زاد عنه من الرصيد لأنّه لم يمرّ بالمحفظة: المشتري يسدّده عند
 * التحصيل ببطاقةٍ أو حوالة أو من رصيده، فيدخل الأمانة هناك لا هنا. وهذه
 * الدالّة تُنهي حجز العربون وتقيّده جزءًا من الثمن، ليس إلّا.
 *
 * (كان هنا سطرٌ يقول إنّ ما زاد عن العربون «يُسدَّد خارج المنصّة» — وصفُ
 *  نموذجٍ سابقٍ على الضمان، سقط حين صار المال كلّه يمرّ بالمنصّة.)
 */
export async function settleOrderDeposit(orderId: string, adminId: string | null): Promise<void> {
  const store = getStore()
  const order = await store.getOrder(orderId)
  if (!order?.depositId) return

  const deposit = await store.getDeposit(order.depositId)
  if (!deposit || deposit.status !== 'held') return

  await store.postLedgerEntry({
    userId: deposit.userId,
    type: 'deposit_applied',
    amount: deposit.amount,
    listingId: deposit.listingId,
    depositId: deposit.id,
    orderId: order.id,
    note: 'خُصم العربون من قيمة الصفقة',
    actorAdminId: adminId,
  })
  await store.updateDeposit(deposit.id, {
    status: 'applied',
    resolvedAt: new Date().toISOString(),
    resolvedByAdminId: adminId,
  })
}

/**
 * التراجع عن مصادرة خلال مهلتها.
 *
 * المصادرة قرار بشري يقع بضغطة، وقد يقع على الاسم الخطأ أو قبل أن يصل عذرٌ
 * وجيه. مهلة تراجع محدودة تجعل الخطأ قابلًا للإصلاح دون أن تجعل القرار
 * رخوًا: بعدها لا سبيل إلا تسوية إدارية موثّقة.
 *
 * ولا يُمحى شيء — القيد الأصلي يبقى، ويُضاف قيد عكسي، ويُوسَم قيد الإيراد
 * `reversedAt`. الدفتر يروي ما حدث لا ما نتمنّى أنه حدث.
 */
export async function undoForfeit(input: {
  depositId: string
  adminId: string
  reason: string
}): Promise<Deposit> {
  const store = getStore()
  const deposit = await store.getDeposit(input.depositId)
  if (!deposit) throw new ServiceError('العربون غير موجود', 404, 'DEPOSIT_NOT_FOUND')
  if (deposit.status !== 'forfeited') {
    throw new ServiceError('لا مصادرة على هذا العربون', 409, 'NOT_FORFEITED')
  }

  const listing = await store.getListing(deposit.listingId)
  const windowHours = listing?.forfeitUndoWindowHours ?? 0
  const resolvedAt = deposit.resolvedAt ? Date.parse(deposit.resolvedAt) : 0
  if (windowHours <= 0 || Date.now() > resolvedAt + windowHours * 3_600_000) {
    throw new ServiceError(
      'انتهت مهلة التراجع عن المصادرة — استعمل تسوية رصيد موثّقة',
      409,
      'UNDO_WINDOW_CLOSED',
    )
  }

  const amount = deposit.forfeitedAmount || deposit.amount
  try {
    await store.postLedgerEntry({
      userId: deposit.userId,
      type: 'adjustment',
      amount,
      listingId: deposit.listingId,
      depositId: deposit.id,
      orderId: null,
      note: `تراجع عن مصادرة — ${input.reason}`,
      actorAdminId: input.adminId,
    })
  } catch (error) {
    rethrow(error)
  }

  // قيود الإيراد تُوسَم مُبطَلة ولا تُحذف
  for (const entry of await store.listPlatformEntries({ depositId: deposit.id })) {
    if (entry.reversedAt) continue
    await store.updatePlatformEntry(entry.id, {
      reversedAt: new Date().toISOString(),
      reversalReason: input.reason,
    })
  }

  const updated = await store.updateDeposit(deposit.id, {
    status: 'released',
    forfeitedAmount: 0,
    resolvedAt: new Date().toISOString(),
    resolvedByAdminId: input.adminId,
    reason: `أُلغيت المصادرة: ${input.reason}`,
  })

  // الصفقة تعود إلى انتظار السداد بمهلتها الأصلية
  for (const order of await store.listOrders({ listingId: deposit.listingId })) {
    if (order.buyerId === deposit.userId && order.status === 'defaulted') {
      await store.updateOrderStatus(order.id, 'awaiting_settlement', Date.now())
    }
  }
  await notify(store, {
    userId: deposit.userId,
    type: 'deposit_released',
    title: 'أُلغيت مصادرة عربونك',
    body: `عاد ${formatAmount(amount)} ريال إلى رصيدك — ${input.reason}`,
    href: '/account/wallet',
    listingId: deposit.listingId,
  })
  await store.appendAudit({
    actorId: input.adminId,
    action: 'deposit.forfeit.undo',
    entityType: 'deposit',
    entityId: deposit.id,
    beforeData: { status: 'forfeited', forfeitedAmount: deposit.forfeitedAmount },
    afterData: { status: 'released', restored: amount, reason: input.reason },
  })
  return updated
}
