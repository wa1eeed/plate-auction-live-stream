import { describe, expect, it } from 'vitest'
import {
  REFERENCE_PREFIX,
  buildReference,
  matchesReference,
  parseReference,
  referenceYear,
  type ReferenceKind,
} from '@/lib/domain/reference'

describe('بناء الرقم المرجعي', () => {
  it('يبني الصيغة المعيارية', () => {
    expect(buildReference('user', 26, 1)).toBe('U26-00001')
    expect(buildReference('listing', 26, 43)).toBe('L26-00043')
    expect(buildReference('order', 27, 12_345)).toBe('S27-12345')
  })

  it('يمتدّ ولا يلتفّ عند تجاوز خمس خانات', () => {
    // الالتفاف يمنح رقمًا مستعملًا لكيان آخر — الامتداد أسلم ولو طال
    expect(buildReference('listing', 26, 100_000)).toBe('L26-100000')
    expect(buildReference('listing', 26, 1_234_567)).toBe('L26-1234567')
  })

  it('السنة تُقصّ إلى خانتين', () => {
    expect(referenceYear('2026-09-01T00:00:00.000Z')).toBe(26)
    expect(referenceYear('2030-01-01T00:00:00.000Z')).toBe(30)
    expect(buildReference('user', 2026, 1)).toBe('U26-00001')
  })

  it('لا حرفَي O و I في أي بادئة — تُقرآن صفرًا وواحدًا', () => {
    const prefixes = Object.values(REFERENCE_PREFIX)
    expect(prefixes).not.toContain('O')
    expect(prefixes).not.toContain('I')
    // ولا تتكرّر بادئة بين نوعين
    expect(new Set(prefixes).size).toBe(prefixes.length)
  })
})

describe('قراءة الرقم المرجعي', () => {
  const expectParsed = (input: string, kind: ReferenceKind, sequence: number) => {
    const parsed = parseReference(input)
    expect(parsed, `تعذّر تحليل «${input}»`).not.toBeNull()
    expect(parsed!.kind).toBe(kind)
    expect(parsed!.sequence).toBe(sequence)
  }

  it('يقبل الصيغة المعيارية', () => {
    expectParsed('U26-00001', 'user', 1)
    expectParsed('L26-00043', 'listing', 43)
  })

  it('متسامح مع ما لا يغيّر المعنى: الشرطة والحالة والمسافات والأرقام العربية', () => {
    expectParsed('u2600001', 'user', 1)
    expectParsed('u26-1', 'user', 1)
    expectParsed('  L26-00043  ', 'listing', 43)
    expectParsed('L٢٦-٠٠٠٤٣', 'listing', 43)
  })

  it('متشدّد فيما يغيّره', () => {
    expect(parseReference('X26-00001')).toBeNull() // نوع غير معروف
    expect(parseReference('U26')).toBeNull() // بلا تسلسل
    expect(parseReference('2600001')).toBeNull() // بلا نوع
    expect(parseReference('U26-00000')).toBeNull() // تسلسل صفري
    expect(parseReference('4040')).toBeNull() // أرقام لوحة لا رقم مرجعي
    expect(parseReference('')).toBeNull()
  })

  it('يعيد الشكل المعياري مهما اختلف الإدخال', () => {
    expect(parseReference('u26-43')!.canonical).toBe('U26-00043')
    expect(parseReference('U2600043')!.canonical).toBe('U26-00043')
  })

  it('المطابقة تامّة لا جزئية', () => {
    expect(matchesReference('L26-00001', 'L26-00001')).toBe(true)
    expect(matchesReference('L26-00001', 'l2600001')).toBe(true)
    // «L26-1» لا تطابق «L26-00010» ولا «L26-00011»
    expect(matchesReference('L26-00010', 'L26-1')).toBe(false)
    expect(matchesReference('L26-00001', 'L26-00002')).toBe(false)
  })

  it('السنة تفصل بين رقمين متطابقي التسلسل', () => {
    expect(matchesReference('L26-00001', 'L27-00001')).toBe(false)
  })
})
