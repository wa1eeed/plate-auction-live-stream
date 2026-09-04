import { describe, expect, it } from 'vitest'
import {
  applyMovement,
  assertDepositEligibility,
  buildEntry,
  buildStatement,
  emptyWallet,
  isOverdue,
  isWalletError,
  paymentDueAt,
  paymentRemainingMs,
  requiresDeposit,
} from '@/lib/domain/wallet'
import { availableBalance, type LedgerEntry, type Wallet } from '@/lib/domain/types'
import { riyalsToHalalas } from '@/lib/domain/money'

const AT = '2026-08-31T12:00:00.000Z'
const wallet = (balance: number, held = 0): Wallet => ({
  userId: 'usr_1',
  balance: riyalsToHalalas(balance),
  held: riyalsToHalalas(held),
  updatedAt: AT,
})

describe('رصيد المحفظة', () => {
  it('المتاح هو الرصيد ناقص المحجوز', () => {
    expect(availableBalance(wallet(50_000, 10_000))).toBe(riyalsToHalalas(40_000))
  })

  it('لا يصير المتاح سالبًا مهما بلغ المحجوز', () => {
    expect(availableBalance({ balance: 100, held: 500 })).toBe(0)
  })

  it('يرفض حركة تُنزل الرصيد تحت الصفر', () => {
    expect(() => applyMovement(wallet(1_000), riyalsToHalalas(-2_000), 0, AT)).toThrow()
  })

  it('يرفض حجزًا يتجاوز الرصيد', () => {
    try {
      applyMovement(wallet(1_000), 0, riyalsToHalalas(2_000), AT)
      throw new Error('كان يجب أن يرمي')
    } catch (error) {
      expect(isWalletError(error) && error.code).toBe('HELD_EXCEEDS_BALANCE')
    }
  })

  it('يرفض فكّ حجز غير موجود', () => {
    try {
      applyMovement(wallet(1_000, 0), 0, riyalsToHalalas(-500), AT)
      throw new Error('كان يجب أن يرمي')
    } catch (error) {
      expect(isWalletError(error) && error.code).toBe('DEPOSIT_NOT_HELD')
    }
  })
})

describe('القيود المحاسبية', () => {
  const base = { userId: 'usr_1', listingId: null, depositId: null, orderId: null, note: null, actorAdminId: null }

  it('الشحن يزيد الرصيد ولا يمسّ المحجوز', () => {
    const { wallet: next, entry } = buildEntry(
      emptyWallet('usr_1', AT),
      { ...base, type: 'topup', amount: riyalsToHalalas(5_000) },
      AT,
    )
    expect(next.balance).toBe(riyalsToHalalas(5_000))
    expect(next.held).toBe(0)
    expect(entry.direction).toBe('credit')
    expect(entry.balanceAfter).toBe(riyalsToHalalas(5_000))
  })

  it('حجز العربون لا يغيّر الرصيد الكلي — ينقل جزءًا منه إلى المحجوز', () => {
    const { wallet: next, entry } = buildEntry(
      wallet(50_000),
      { ...base, type: 'deposit_hold', amount: riyalsToHalalas(10_000) },
      AT,
    )
    expect(next.balance).toBe(riyalsToHalalas(50_000))
    expect(next.held).toBe(riyalsToHalalas(10_000))
    expect(availableBalance(next)).toBe(riyalsToHalalas(40_000))
    // القيد محايد: لا يدخل في مجموع المدين ولا الدائن
    expect(entry.direction).toBe('neutral')
  })

  it('المصادرة تنقص الرصيد والمحجوز معًا', () => {
    const { wallet: next, entry } = buildEntry(
      wallet(50_000, 10_000),
      { ...base, type: 'deposit_forfeit', amount: riyalsToHalalas(10_000) },
      AT,
    )
    expect(next.balance).toBe(riyalsToHalalas(40_000))
    expect(next.held).toBe(0)
    expect(entry.direction).toBe('debit')
  })

  it('فكّ الحجز يعيد المبلغ إلى المتاح بلا مسّ الرصيد', () => {
    const { wallet: next } = buildEntry(
      wallet(50_000, 10_000),
      { ...base, type: 'deposit_release', amount: riyalsToHalalas(10_000) },
      AT,
    )
    expect(next.balance).toBe(riyalsToHalalas(50_000))
    expect(next.held).toBe(0)
  })

  it('يرفض مبلغًا غير صحيح أو غير موجب', () => {
    for (const amount of [0, -100, 12.5]) {
      expect(() =>
        buildEntry(wallet(50_000), { ...base, type: 'topup', amount }, AT),
      ).toThrow()
    }
  })

  it('يمنع سحبًا يتجاوز الرصيد', () => {
    expect(() =>
      buildEntry(wallet(1_000), { ...base, type: 'withdrawal', amount: riyalsToHalalas(2_000) }, AT),
    ).toThrow()
  })

  it('يمنع سحب المبلغ المحجوز', () => {
    // الرصيد 50 ألفًا لكن 45 منها محجوزة: سحب 10 آلاف يترك المحجوز أكبر من الرصيد
    expect(() =>
      buildEntry(
        wallet(50_000, 45_000),
        { ...base, type: 'withdrawal', amount: riyalsToHalalas(10_000) },
        AT,
      ),
    ).toThrow()
  })
})

describe('أهلية العربون', () => {
  const auction = { saleType: 'auction' as const, depositAmount: riyalsToHalalas(10_000) }

  it('البيع المباشر لا يتطلّب عربونًا', () => {
    expect(requiresDeposit({ saleType: 'fixed', depositAmount: riyalsToHalalas(5_000) })).toBe(false)
  })

  it('مزاد بعربون صفر لا يتطلّب عربونًا', () => {
    expect(requiresDeposit({ saleType: 'auction', depositAmount: 0 })).toBe(false)
  })

  it('يطلب حجزًا عند توفّر رصيد كافٍ', () => {
    const decision = assertDepositEligibility(auction, wallet(50_000), null)
    expect(decision).toEqual({ needsHold: true, amount: riyalsToHalalas(10_000) })
  })

  it('يرفض المزايدة عند نقص الرصيد المتاح', () => {
    try {
      // الرصيد 50 ألفًا لكن 45 محجوزة ⇒ المتاح 5 آلاف فقط
      assertDepositEligibility(auction, wallet(50_000, 45_000), null)
      throw new Error('كان يجب أن يرمي')
    } catch (error) {
      expect(isWalletError(error) && error.code).toBe('DEPOSIT_REQUIRED')
    }
  })

  it('لا يحجز عربونًا ثانيًا لمن عربونه محجوز على المزاد نفسه', () => {
    const existing = {
      id: 'dep_1',
      reference: 'D26-00001',
      listingId: 'lst_1',
      userId: 'usr_1',
      amount: riyalsToHalalas(10_000),
      status: 'held' as const,
      forfeitedAmount: 0,
      createdAt: AT,
      resolvedAt: null,
      resolvedByAdminId: null,
      reason: null,
    }
    // المتاح صفر تمامًا ومع ذلك يُسمح: العربون محجوز أصلًا
    const decision = assertDepositEligibility(auction, wallet(10_000, 10_000), existing)
    expect(decision.needsHold).toBe(false)
  })

  it('عربون مُصادَر لا يُحتسب محجوزًا فيُطلب من جديد', () => {
    const forfeited = {
      id: 'dep_1',
      reference: 'D26-00001',
      listingId: 'lst_1',
      userId: 'usr_1',
      amount: riyalsToHalalas(10_000),
      status: 'forfeited' as const,
      forfeitedAmount: riyalsToHalalas(10_000),
      createdAt: AT,
      resolvedAt: AT,
      resolvedByAdminId: 'adm_1',
      reason: 'تخلّف',
    }
    expect(assertDepositEligibility(auction, wallet(50_000), forfeited).needsHold).toBe(true)
  })
})

describe('مهلة السداد', () => {
  const now = Date.parse('2026-08-31T12:00:00.000Z')

  it('تُحسب من لحظة رسوّ المزاد بعدد الساعات المحدّد', () => {
    expect(paymentDueAt({ paymentWindowHours: 48 }, now)).toBe('2026-09-02T12:00:00.000Z')
  })

  it('مهلة أقل من ساعة تُرفع إلى ساعة — لا مهلة صفرية', () => {
    expect(paymentDueAt({ paymentWindowHours: 0 }, now)).toBe('2026-08-31T13:00:00.000Z')
  })

  it('الصفقة متأخّرة فقط بعد انقضاء المهلة وهي بانتظار السداد', () => {
    const due = '2026-08-31T11:00:00.000Z'
    expect(isOverdue({ status: 'awaiting_settlement', paymentDueAt: due }, now)).toBe(true)
    expect(isOverdue({ status: 'completed', paymentDueAt: due }, now)).toBe(false)
    expect(isOverdue({ status: 'awaiting_settlement', paymentDueAt: null }, now)).toBe(false)
  })

  it('لا تُعدّ متأخّرة قبل انقضاء المهلة', () => {
    const due = '2026-09-01T12:00:00.000Z'
    expect(isOverdue({ status: 'awaiting_settlement', paymentDueAt: due }, now)).toBe(false)
    expect(paymentRemainingMs({ status: 'awaiting_settlement', paymentDueAt: due }, now)).toBe(
      24 * 3_600_000,
    )
  })
})

describe('كشف الحساب', () => {
  const entry = (
    id: string,
    type: LedgerEntry['type'],
    direction: LedgerEntry['direction'],
    amount: number,
    balanceAfter: number,
    createdAt: string,
  ): LedgerEntry => ({
    id,
    reference: `W26-${id.replace(/\D/g, '').padStart(5, '0')}`,
    userId: 'usr_1',
    type,
    direction,
    amount: riyalsToHalalas(amount),
    balanceAfter: riyalsToHalalas(balanceAfter),
    heldAfter: 0,
    listingId: null,
    depositId: null,
    orderId: null,
    note: null,
    actorAdminId: null,
    createdAt,
  })

  it('يرتّب من الأقدم إلى الأحدث ويجمع المدين والدائن', () => {
    const statement = buildStatement(
      [
        entry('b', 'withdrawal', 'debit', 2_000, 3_000, '2026-08-02T00:00:00.000Z'),
        entry('a', 'topup', 'credit', 5_000, 5_000, '2026-08-01T00:00:00.000Z'),
      ],
      wallet(3_000),
    )
    expect(statement.lines.map((l) => l.id)).toEqual(['a', 'b'])
    expect(statement.totalCredit).toBe(riyalsToHalalas(5_000))
    expect(statement.totalDebit).toBe(riyalsToHalalas(2_000))
    expect(statement.closingBalance).toBe(riyalsToHalalas(3_000))
  })

  it('قيود الحجز محايدة: تظهر في الكشف ولا تدخل في المجموعين', () => {
    const statement = buildStatement(
      [
        entry('a', 'topup', 'credit', 5_000, 5_000, '2026-08-01T00:00:00.000Z'),
        entry('b', 'deposit_hold', 'neutral', 1_000, 5_000, '2026-08-02T00:00:00.000Z'),
      ],
      wallet(5_000, 1_000),
    )
    expect(statement.lines).toHaveLength(2)
    expect(statement.totalDebit).toBe(0)
    expect(statement.totalCredit).toBe(riyalsToHalalas(5_000))
    expect(statement.available).toBe(riyalsToHalalas(4_000))
  })
})
