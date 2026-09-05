/**
 * قواعد المحفظة والعربون — نقية بلا تخزين ولا وقت خارجي.
 *
 * المبدأ المحاسبي: لا يُعدَّل قيد بعد كتابته ولا يُحذف. كل تغيّر في الرصيد
 * يُكتب قيدًا جديدًا يحمل الرصيد بعده، فيبقى كشف الحساب قابلًا للتدقيق سطرًا
 * بسطر، ويُكتشف أي اختلال بمقارنة آخر قيد بالرصيد المخزّن.
 */
import type { Halalas } from './money'
import type {
  Deposit,
  LedgerEntry,
  LedgerEntryType,
  Listing,
  Order,
  Wallet,
} from './types'
import { LEDGER_ENTRY_DIRECTION, availableBalance } from './types'

export const WALLET_ERROR_CODES = [
  'INSUFFICIENT_FUNDS',
  'DEPOSIT_REQUIRED',
  'DEPOSIT_ALREADY_HELD',
  'DEPOSIT_NOT_HELD',
  'INVALID_AMOUNT',
  'HELD_EXCEEDS_BALANCE',
] as const

export type WalletErrorCode = (typeof WALLET_ERROR_CODES)[number]

export const WALLET_ERROR_MESSAGES: Record<WalletErrorCode, string> = {
  INSUFFICIENT_FUNDS: 'الرصيد المتاح في محفظتك لا يكفي.',
  DEPOSIT_REQUIRED: 'هذا المزاد يتطلّب عربونًا محجوزًا من رصيد محفظتك.',
  DEPOSIT_ALREADY_HELD: 'لديك عربون محجوز على هذا المزاد بالفعل.',
  DEPOSIT_NOT_HELD: 'لا يوجد عربون محجوز على هذا المزاد.',
  INVALID_AMOUNT: 'المبلغ غير صالح.',
  HELD_EXCEEDS_BALANCE: 'المحجوز لا يمكن أن يتجاوز الرصيد.',
}

export class WalletError extends Error {
  /** علامة بنيوية: `instanceof` غير موثوق عبر حدود الحزم. */
  readonly isWalletError = true as const
  readonly code: WalletErrorCode
  constructor(code: WalletErrorCode) {
    super(WALLET_ERROR_MESSAGES[code])
    this.name = 'WalletError'
    this.code = code
  }
}

export function isWalletError(error: unknown): error is WalletError {
  return typeof error === 'object' && error !== null && (error as WalletError).isWalletError === true
}

// ---------------------------------------------------------------- الرصيد

export function emptyWallet(userId: string, at: string): Wallet {
  return { userId, balance: 0, held: 0, updatedAt: at }
}

/** يتحقّق من صلاحية مبلغ قبل أي حركة. */
export function assertValidAmount(amount: Halalas): void {
  if (!Number.isInteger(amount) || amount <= 0) throw new WalletError('INVALID_AMOUNT')
}

/** يتحقّق أن الرصيد المتاح يكفي مبلغًا. */
export function assertSufficient(wallet: Wallet, amount: Halalas): void {
  if (availableBalance(wallet) < amount) throw new WalletError('INSUFFICIENT_FUNDS')
}

/**
 * يطبّق حركة على المحفظة ويعيد حالتها الجديدة.
 * `balanceDelta` يغيّر الرصيد الكلي، و`heldDelta` يغيّر المحجوز وحده.
 */
export function applyMovement(
  wallet: Wallet,
  balanceDelta: Halalas,
  heldDelta: Halalas,
  at: string,
): Wallet {
  const balance = wallet.balance + balanceDelta
  const held = wallet.held + heldDelta
  if (balance < 0) throw new WalletError('INSUFFICIENT_FUNDS')
  if (held < 0) throw new WalletError('DEPOSIT_NOT_HELD')
  if (held > balance) throw new WalletError('HELD_EXCEEDS_BALANCE')
  return { ...wallet, balance, held, updatedAt: at }
}

/** حركة كل نوع قيد على (الرصيد الكلي، المحجوز). */
export const LEDGER_MOVEMENT: Record<LedgerEntryType, { balance: 1 | -1 | 0; held: 1 | -1 | 0 }> = {
  topup: { balance: 1, held: 0 },
  withdrawal: { balance: -1, held: 0 },
  // الحجز لا يغيّر الرصيد الكلي — ينقل جزءًا منه إلى المحجوز فقط
  deposit_hold: { balance: 0, held: 1 },
  deposit_release: { balance: 0, held: -1 },
  // المصادرة تخرج المال فعليًا، فتنقص الرصيد والمحجوز معًا
  deposit_forfeit: { balance: -1, held: -1 },
  // العمولة والضريبة تخرجان من الرصيد ولا تمسّان المحجوز
  commission: { balance: -1, held: 0 },
  vat: { balance: -1, held: 0 },
  deposit_applied: { balance: -1, held: -1 },
  sale_proceeds: { balance: 1, held: 0 },
  purchase_payment: { balance: -1, held: 0 },
  // ردّ ما حُصّل عن صفقة لم تُسوَّ — يعود إلى رصيد صاحبه
  purchase_refund: { balance: 1, held: 0 },
  adjustment: { balance: 1, held: 0 },
}

export type NewLedgerEntry = Omit<
  LedgerEntry,
  'id' | 'reference' | 'balanceAfter' | 'heldAfter' | 'createdAt' | 'direction'
>

/** يبني القيد ويحسب الرصيد بعده — تُستدعى داخل قفل المحفظة. */
export function buildEntry(
  wallet: Wallet,
  input: NewLedgerEntry,
  at: string,
): { wallet: Wallet; entry: Omit<LedgerEntry, 'id' | 'reference'> } {
  assertValidAmount(input.amount)
  const movement = LEDGER_MOVEMENT[input.type]
  const next = applyMovement(
    wallet,
    movement.balance * input.amount,
    movement.held * input.amount,
    at,
  )
  return {
    wallet: next,
    entry: {
      ...input,
      direction: LEDGER_ENTRY_DIRECTION[input.type],
      balanceAfter: next.balance,
      heldAfter: next.held,
      createdAt: at,
    },
  }
}

// ---------------------------------------------------------------- العربون

/** هل يشترط هذا الإعلان عربونًا؟ */
export function requiresDeposit(listing: Pick<Listing, 'saleType' | 'depositAmount'>): boolean {
  return listing.saleType === 'auction' && listing.depositAmount > 0
}

/**
 * يتحقّق من أهلية المزايدة من ناحية العربون.
 * إن كان العربون محجوزًا مسبقًا فلا يُطلب مرة أخرى — يُحجز مرة واحدة لكل مزاد.
 */
export function assertDepositEligibility(
  listing: Pick<Listing, 'saleType' | 'depositAmount'>,
  wallet: Wallet,
  existing: Deposit | null,
): { needsHold: boolean; amount: Halalas } {
  if (!requiresDeposit(listing)) return { needsHold: false, amount: 0 }
  if (existing && existing.status === 'held') return { needsHold: false, amount: existing.amount }
  if (availableBalance(wallet) < listing.depositAmount) throw new WalletError('DEPOSIT_REQUIRED')
  return { needsHold: true, amount: listing.depositAmount }
}

/** موعد انتهاء مهلة سداد الفائز. */
export function paymentDueAt(listing: Pick<Listing, 'paymentWindowHours'>, fromMs: number): string {
  const hours = Math.max(1, listing.paymentWindowHours)
  return new Date(fromMs + hours * 3_600_000).toISOString()
}

/** هل تجاوزت الصفقة مهلة سدادها دون إتمام؟ */
export function isOverdue(order: Pick<Order, 'status' | 'paymentDueAt'>, nowMs: number): boolean {
  if (order.status !== 'awaiting_settlement' || !order.paymentDueAt) return false
  return new Date(order.paymentDueAt).getTime() <= nowMs
}

/** ما تبقّى من مهلة السداد بالمللي ثانية (0 إذا انقضت أو لا مهلة). */
export function paymentRemainingMs(
  order: Pick<Order, 'status' | 'paymentDueAt'>,
  nowMs: number,
): number {
  if (order.status !== 'awaiting_settlement' || !order.paymentDueAt) return 0
  return Math.max(0, new Date(order.paymentDueAt).getTime() - nowMs)
}

// ---------------------------------------------------------------- كشف الحساب

export type StatementLine = LedgerEntry & {
  debit: Halalas
  credit: Halalas
  /**
   * اللوحة التي جرى القيد عليها — لقيود العربون والبيع والشراء.
   *
   * «حجز عربون» و«عربون عاد للمحفظة» يتكرّران في الكشف بلا ما يفرّق بينهما:
   * من زايد على ثلاث لوحات يقرأ ثلاثة أسطر متطابقة ولا يعرف أيُّ عربونٍ عاد.
   * والقيد يحمل `listingId` أصلًا — فما نقص إلّا وصلُه بلوحته عند العرض.
   */
  plateLabel: string | null
}

export type Statement = {
  lines: StatementLine[]
  totalDebit: Halalas
  totalCredit: Halalas
  closingBalance: Halalas
  held: Halalas
  available: Halalas
}

/**
 * كشف حساب مدين/دائن مرتّب من الأقدم إلى الأحدث.
 * قيود الحجز وفكّه محايدة: لا تدخل في المجموعين لأنها لا تغيّر الرصيد الكلي،
 * لكنها تبقى ظاهرة في الكشف لأن المستخدم يحتاج تفسير انخفاض رصيده المتاح.
 */
export function buildStatement(
  entries: LedgerEntry[],
  wallet: Wallet,
  /** اسم اللوحة بمعرّف إعلانها — يُبنى في الخادم حيث تُقرأ الإعلانات */
  plateOf: (listingId: string) => string | null = () => null,
): Statement {
  const lines = entries
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .map((entry) => ({
      ...entry,
      debit: entry.direction === 'debit' ? entry.amount : 0,
      credit: entry.direction === 'credit' ? entry.amount : 0,
      plateLabel: entry.listingId ? plateOf(entry.listingId) : null,
    }))

  return {
    lines,
    totalDebit: lines.reduce((sum, line) => sum + line.debit, 0),
    totalCredit: lines.reduce((sum, line) => sum + line.credit, 0),
    closingBalance: wallet.balance,
    held: wallet.held,
    available: availableBalance(wallet),
  }
}
