import { describe, expect, it } from 'vitest'
import {
  ZATCA_QR_TAGS,
  decodeZatcaQr,
  encodeZatcaQr,
  fromBase64,
  invoiceAmount,
  invoiceDigestInput,
  isValidCrNumber,
  isValidVatNumber,
  toBase64,
} from '@/lib/domain/zatca'
import { formatIban, isValidSaudiIban } from '@/lib/domain/types'
import { riyalsToHalalas } from '@/lib/domain/money'

describe('رمز QR للفاتورة', () => {
  const payload = {
    sellerName: 'سوق اللوحات',
    vatNumber: '312345678910003',
    issuedAt: '2026-09-03T12:00:00.000Z',
    total: riyalsToHalalas(1_150),
    vatTotal: riyalsToHalalas(150),
  }

  it('يُرمّز الوسوم الخمسة ويُقرأ منها ما كُتب', () => {
    const decoded = decodeZatcaQr(encodeZatcaQr(payload))
    expect(decoded).not.toBeNull()
    expect(decoded![ZATCA_QR_TAGS.sellerName]).toBe('سوق اللوحات')
    expect(decoded![ZATCA_QR_TAGS.vatNumber]).toBe('312345678910003')
    expect(decoded![ZATCA_QR_TAGS.timestamp]).toBe('2026-09-03T12:00:00.000Z')
    expect(decoded![ZATCA_QR_TAGS.total]).toBe('1150.00')
    expect(decoded![ZATCA_QR_TAGS.vatTotal]).toBe('150.00')
  })

  /*
   * الطول بالبايتات لا بالمحارف.
   *
   * «سوق اللوحات» أحد عشر محرفًا وواحد وعشرون بايتًا في UTF-8. وقارئ الرمز
   * يقفز بالبايتات، فطولٌ محسوب بالمحارف يُزيح ما بعده فيُقرأ الرمز كلّه خطأً.
   */
  it('يحسب طول الوسم بالبايتات فلا تُزيح العربية ما بعدها', () => {
    const bytes = fromBase64(encodeZatcaQr(payload))
    expect(bytes[0]).toBe(ZATCA_QR_TAGS.sellerName)
    expect(bytes[1]).toBe(new TextEncoder().encode(payload.sellerName).length)
    expect(bytes[1]).toBeGreaterThan(payload.sellerName.length)
  })

  it('المبلغ برقمين بعد الفاصلة دائمًا — لا تنسيق عرض', () => {
    expect(invoiceAmount(riyalsToHalalas(1_000))).toBe('1000.00')
    expect(invoiceAmount(riyalsToHalalas(0.5))).toBe('0.50')
    expect(invoiceAmount(0)).toBe('0.00')
  })

  it('يردّ base64 غير صالح بلا رمي', () => {
    expect(decodeZatcaQr('@@@@')).toBeNull()
  })

  it('base64 يذهب ويعود كما هو لكل الأطوال', () => {
    for (let length = 0; length < 12; length += 1) {
      const bytes = Uint8Array.from({ length }, (_, i) => (i * 37 + 11) % 256)
      expect(Array.from(fromBase64(toBase64(bytes)))).toEqual(Array.from(bytes))
    }
  })
})

describe('الرقم الضريبي', () => {
  it('يقبل ما استوفى قاعدة الهيئة', () => {
    expect(isValidVatNumber('312345678910003')).toBe(true)
  })

  it('يردّ ما اختلّ فيه طولٌ أو طرفٌ أو خانة النوع', () => {
    expect(isValidVatNumber('31234567891000')).toBe(false) // أربع عشرة خانة
    expect(isValidVatNumber('412345678910003')).toBe(false) // لا يبدأ بـ3
    expect(isValidVatNumber('312345678910004')).toBe(false) // لا ينتهي بـ3
    expect(isValidVatNumber('312345678900003')).toBe(false) // الحادية عشرة ليست 1
    expect(isValidVatNumber('3123456789I0003')).toBe(false) // حرف
    expect(isValidVatNumber('')).toBe(false)
  })

  it('الرقم الموحّد عشر خانات', () => {
    expect(isValidCrNumber('7000000000')).toBe(true)
    expect(isValidCrNumber('700000000')).toBe(false)
  })
})

describe('الآيبان السعودي', () => {
  it('يقبل ما صحّت خانتا تحقّقه', () => {
    expect(isValidSaudiIban('SA3144000001012345678901')).toBe(true)
    // المسافات والحروف الصغيرة لا تغيّر الرقم
    expect(isValidSaudiIban('sa31 4400 0001 0123 4567 8901')).toBe(true)
  })

  /*
   * التحقّق حسابيّ لا شكليّ.
   *
   * رقمٌ صحيح الطول والبادئة لكنه أُخطئ في خانة يُردّ هنا — وإلا رُدّت
   * الحوالة من البنك بعد أن قيل لصاحبها إنها نُفّذت.
   */
  it('يردّ ما تغيّرت فيه خانة وإن صحّ شكله', () => {
    expect(isValidSaudiIban('SA3144000001012345678902')).toBe(false)
    expect(isValidSaudiIban('SA314400000101234567890')).toBe(false) // ناقص خانة
    expect(isValidSaudiIban('AE3144000001012345678901')).toBe(false) // دولة أخرى
    expect(isValidSaudiIban('')).toBe(false)
  })

  it('يُعرض بمجموعات رباعية ليُطابَق بالعين', () => {
    expect(formatIban('SA3144000001012345678901')).toBe('SA31 4400 0001 0123 4567 8901')
  })
})

describe('مدخل تجزئة الفاتورة', () => {
  const base = {
    reference: 'T26-00001',
    uuid: 'b3f1e0c2-0000-4000-8000-000000000001',
    issuedAt: '2026-09-03T12:00:00.000Z',
    vatNumber: '312345678910003',
    netAmount: riyalsToHalalas(1_000),
    vatAmount: riyalsToHalalas(150),
    totalAmount: riyalsToHalalas(1_150),
    customerReference: 'U26-00001',
    previousHash: 'AAAA',
  }

  it('يتغيّر بتغيّر أي حقل — وإلا لم تكشف السلسلة تعديلًا', () => {
    const original = invoiceDigestInput(base)
    expect(invoiceDigestInput({ ...base, netAmount: base.netAmount + 1 })).not.toBe(original)
    expect(invoiceDigestInput({ ...base, customerReference: 'U26-00002' })).not.toBe(original)
    expect(invoiceDigestInput({ ...base, previousHash: 'BBBB' })).not.toBe(original)
  })

  it('ثابت لنفس المدخلات', () => {
    expect(invoiceDigestInput(base)).toBe(invoiceDigestInput({ ...base }))
  })
})
