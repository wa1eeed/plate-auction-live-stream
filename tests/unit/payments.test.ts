import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createHmac } from 'node:crypto'
import { emptyDatabase, MemoryStore, type MemoryDatabase } from '@/lib/store/memory-store'
import { seedDatabase } from '@/lib/store/seed'
import { resetStoreForTests } from '@/lib/store'
import { resetRateLimits } from '@/lib/server/rate-limit'
import {
  getPublicPaymentOptions,
  markPaymentFailed,
  markPaymentPaid,
  startTopUp,
  submitTransferProof,
  updatePaymentSettings,
} from '@/lib/server/payment-service'
import { chargeOutcome, isTapConfigured, verifyWebhookSignature } from '@/lib/server/tap-client'
import { riyalsToHalalas } from '@/lib/domain/money'

let db: MemoryDatabase
let store: MemoryStore

const adminId = () => db.admins[0].id
const userId = () => db.users[0].id

const BANK = {
  bankTransferEnabled: true,
  bankName: 'مصرف الاختبار',
  bankAccountName: 'سوق اللوحات',
  bankIban: 'SA1234567890123456789012',
  bankAccountNumber: '0001',
  bankInstructions: '',
}

beforeEach(() => {
  db = emptyDatabase()
  seedDatabase(db)
  store = new MemoryStore(db)
  resetStoreForTests(store)
  resetRateLimits()
  delete process.env.TAP_TEST_SECRET_KEY
  delete process.env.TAP_LIVE_SECRET_KEY
})

afterEach(() => {
  delete process.env.TAP_TEST_SECRET_KEY
  delete process.env.TAP_LIVE_SECRET_KEY
})

describe('إعدادات الدفع', () => {
  it('كل الطرق معطّلة ابتداءً — لا تُفعَّل بوابة بلا قرار', async () => {
    const options = await getPublicPaymentOptions()
    expect(options.tapEnabled).toBe(false)
    expect(options.bankTransferEnabled).toBe(false)
    expect(options.bank).toBeNull()
  })

  it('يرفض تفعيل Tap بلا مفتاح للبيئة المختارة', async () => {
    await expect(
      updatePaymentSettings({ tapEnabled: true, tapMode: 'live' }, adminId()),
    ).rejects.toMatchObject({ code: 'TAP_NOT_CONFIGURED' })
  })

  it('يقبل التفعيل عند ضبط مفتاح البيئة', async () => {
    process.env.TAP_TEST_SECRET_KEY = 'sk_test_example'
    const settings = await updatePaymentSettings({ tapEnabled: true, tapMode: 'test' }, adminId())
    expect(settings.tapEnabled).toBe(true)
    expect((await getPublicPaymentOptions()).tapEnabled).toBe(true)
  })

  it('لا يظهر خيار Tap إن ضاع المفتاح بعد التفعيل', async () => {
    process.env.TAP_TEST_SECRET_KEY = 'sk_test_example'
    await updatePaymentSettings({ tapEnabled: true, tapMode: 'test' }, adminId())
    delete process.env.TAP_TEST_SECRET_KEY
    // خيار يفشل حتمًا لا يُعرض
    expect((await getPublicPaymentOptions()).tapEnabled).toBe(false)
  })

  it('لا يظهر خيار الحوالة بلا آيبان', async () => {
    await updatePaymentSettings({ ...BANK, bankIban: '' }, adminId())
    expect((await getPublicPaymentOptions()).bankTransferEnabled).toBe(false)
  })

  it('يعرض بيانات البنك للمستخدم عند اكتمالها', async () => {
    await updatePaymentSettings(BANK, adminId())
    const options = await getPublicPaymentOptions()
    expect(options.bankTransferEnabled).toBe(true)
    expect(options.bank?.iban).toBe(BANK.bankIban)
  })

  it('يوثّق تغيير الإعدادات في سجلّ التدقيق', async () => {
    await updatePaymentSettings(BANK, adminId())
    expect(db.audits.some((a) => a.action === 'payments.settings')).toBe(true)
  })
})

describe('الحوالة البنكية', () => {
  async function startTransfer(amount = 1_000) {
    await updatePaymentSettings(BANK, adminId())
    return startTopUp({
      userId: userId(),
      amount: riyalsToHalalas(amount),
      method: 'bank_transfer',
    })
  }

  it('تُنشأ بانتظار التحويل ومعها مرجع فريد', async () => {
    const { payment, redirectUrl } = await startTransfer()
    expect(payment.status).toBe('awaiting_transfer')
    expect(payment.reference).toMatch(/^P\d{2}-\d{5}$/)
    expect(redirectUrl).toBeNull()
  })

  it('ترفض طريقة غير مفعّلة', async () => {
    await expect(
      startTopUp({ userId: userId(), amount: riyalsToHalalas(1_000), method: 'tap' }),
    ).rejects.toMatchObject({ code: 'METHOD_DISABLED' })
  })

  it('إبلاغ المستخدم ينقلها إلى المراجعة ولا يضيف رصيدًا', async () => {
    const { payment } = await startTransfer()
    const before = await store.getWallet(userId())

    const updated = await submitTransferProof({
      paymentId: payment.id,
      userId: userId(),
      note: 'TRX-99',
    })
    expect(updated.status).toBe('under_review')
    expect(updated.transferNote).toBe('TRX-99')
    expect((await store.getWallet(userId())).balance).toBe(before.balance)
  })

  it('تأكيد الإدارة يضيف الرصيد ويكتب قيدًا', async () => {
    const { payment } = await startTransfer(2_500)
    const before = await store.getWallet(userId())

    const paid = await markPaymentPaid({ paymentId: payment.id, adminId: adminId(), note: null })
    expect(paid.status).toBe('paid')
    expect(paid.ledgerEntryId).toBeTruthy()

    const after = await store.getWallet(userId())
    expect(after.balance).toBe(before.balance + riyalsToHalalas(2_500))

    const entries = await store.listLedger({ userId: userId() })
    expect(entries[0].type).toBe('topup')
    expect(entries[0].actorAdminId).toBe(adminId())
  })

  it('التأكيد المكرّر لا يضيف الرصيد مرّتين', async () => {
    const { payment } = await startTransfer(2_500)
    await markPaymentPaid({ paymentId: payment.id, adminId: adminId(), note: null })
    const afterFirst = await store.getWallet(userId())

    await markPaymentPaid({ paymentId: payment.id, adminId: adminId(), note: null })
    await markPaymentPaid({ paymentId: payment.id, adminId: null, note: null })

    expect((await store.getWallet(userId())).balance).toBe(afterFirst.balance)
    expect((await store.listLedger({ userId: userId() })).filter((e) => e.type === 'topup')).toHaveLength(2)
  })

  it('الرفض يسجّل السبب ولا يمسّ الرصيد', async () => {
    const { payment } = await startTransfer()
    const before = await store.getWallet(userId())

    const failed = await markPaymentFailed({
      paymentId: payment.id,
      adminId: adminId(),
      reason: 'لم تصل الحوالة',
    })
    expect(failed.status).toBe('failed')
    expect(failed.failureReason).toBe('لم تصل الحوالة')
    expect((await store.getWallet(userId())).balance).toBe(before.balance)
  })

  it('لا تُرفض عملية أُضيف رصيدها', async () => {
    const { payment } = await startTransfer()
    await markPaymentPaid({ paymentId: payment.id, adminId: adminId(), note: null })
    await expect(
      markPaymentFailed({ paymentId: payment.id, adminId: adminId(), reason: 'تراجع' }),
    ).rejects.toMatchObject({ code: 'PAYMENT_SETTLED' })
  })

  it('يحدّ من إنشاء عمليات دفع متتابعة', async () => {
    await updatePaymentSettings(BANK, adminId())
    for (let i = 0; i < 5; i++) {
      await startTopUp({ userId: userId(), amount: riyalsToHalalas(100), method: 'bank_transfer' })
    }
    await expect(
      startTopUp({ userId: userId(), amount: riyalsToHalalas(100), method: 'bank_transfer' }),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' })
  })
})

describe('عميل Tap', () => {
  it('يقرأ حالة تهيئة المفاتيح من البيئة وحدها', () => {
    expect(isTapConfigured('test')).toBe(false)
    process.env.TAP_TEST_SECRET_KEY = 'sk_test_example'
    expect(isTapConfigured('test')).toBe(true)
    expect(isTapConfigured('live')).toBe(false)
  })

  it('يترجم حالات البوابة إلى نتيجة نهائية', () => {
    expect(chargeOutcome('CAPTURED')).toBe('paid')
    expect(chargeOutcome('SUCCESS')).toBe('paid')
    expect(chargeOutcome('INITIATED')).toBe('pending')
    expect(chargeOutcome('PENDING')).toBe('pending')
    expect(chargeOutcome('DECLINED')).toBe('failed')
    expect(chargeOutcome('ABANDONED')).toBe('failed')
    expect(chargeOutcome('')).toBe('failed')
  })
})

describe('توقيع ويبهوك Tap', () => {
  const KEY = 'sk_test_signature'
  const payload = {
    id: 'chg_123',
    amount: 250,
    currency: 'SAR',
    reference: { gateway: 'gw_1', payment: 'pay_1' },
    status: 'CAPTURED',
    transaction: { created: '1788199019' },
  }

  function sign(key: string) {
    const source =
      `x_id${payload.id}` +
      `x_amount${payload.amount.toFixed(2)}` +
      `x_currency${payload.currency}` +
      `x_gateway_reference${payload.reference.gateway}` +
      `x_payment_reference${payload.reference.payment}` +
      `x_status${payload.status}` +
      `x_created${payload.transaction.created}`
    return createHmac('sha256', key).update(source).digest('hex')
  }

  it('يقبل توقيعًا صحيحًا', () => {
    process.env.TAP_TEST_SECRET_KEY = KEY
    expect(verifyWebhookSignature('test', payload, sign(KEY))).toBe(true)
  })

  it('يرفض توقيعًا بمفتاح آخر — وهو ما يمنع شحن رصيد مزوّر', () => {
    process.env.TAP_TEST_SECRET_KEY = KEY
    expect(verifyWebhookSignature('test', payload, sign('sk_attacker'))).toBe(false)
  })

  it('يرفض حمولة عُبث بمبلغها بعد التوقيع', () => {
    process.env.TAP_TEST_SECRET_KEY = KEY
    const signature = sign(KEY)
    expect(verifyWebhookSignature('test', { ...payload, amount: 99_999 }, signature)).toBe(false)
  })

  it('يرفض غياب الترويسة أو غياب المفتاح', () => {
    process.env.TAP_TEST_SECRET_KEY = KEY
    expect(verifyWebhookSignature('test', payload, null)).toBe(false)
    delete process.env.TAP_TEST_SECRET_KEY
    expect(verifyWebhookSignature('test', payload, sign(KEY))).toBe(false)
  })
})
