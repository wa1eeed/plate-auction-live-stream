import { describe, expect, it } from 'vitest'
import {
  ARABIC_LETTER_ADVANCE,
  arabicAdvance,
  fitFontSize,
} from '@/components/plate/arial-metrics'

/**
 * عرضُ الحرف — **لكلّ حرفٍ حرفُه لا متوسّطٌ واحد**.
 *
 * وكان التخطيط يقدّر العرض بمتوسّطٍ (0.82). و«ص» عرضُها 1.0625 و«ا» 0.2168 —
 * بينهما خمسةُ أضعاف. فثلاثُ «ص» تحتاج 3.19em ويُحسب لها 2.46em **فتفيض عن
 * خانتها**، وثلاثُ «ا» تُضيَّق بلا سبب.
 *
 * ويشتدّ الأثر لأنّ الحبر والعرض لا يتلازمان: «س» حبرُها قصير فيُكبَّر خطُّها
 * لتملأ الشريط، وهي من أعرض الحروف — فتُكبَّر ثمّ تفيض.
 */

describe('عرض الحروف العربية', () => {
  it('الحروف السبعة عشر كلُّها في الجدول', () => {
    for (const letter of 'أابحدرسصطعقكلمنهوي') {
      expect(ARABIC_LETTER_ADVANCE[letter], `«${letter}» بلا عرض`).toBeGreaterThan(0)
    }
  })

  it('والفرق بين أعرضها وأضيقها خمسةُ أضعاف — فلا يصحّ متوسّط', () => {
    const widths = Object.values(ARABIC_LETTER_ADVANCE)
    const ratio = Math.max(...widths) / Math.min(...widths)
    expect(ratio, 'الفرق صغير؟ راجع القياس').toBeGreaterThan(4)
  })

  it('«ص» أعرضُها و«ا» أضيقُها — وهو ما يُفيض ويُضيّق', () => {
    expect(ARABIC_LETTER_ADVANCE['ص']).toBe(Math.max(...Object.values(ARABIC_LETTER_ADVANCE)))
    expect(ARABIC_LETTER_ADVANCE['ا']).toBe(Math.min(...Object.values(ARABIC_LETTER_ADVANCE)))
  })

  it('والمجموع يتبع الحروف بعينها لا عددَها', () => {
    /* ثلاثُ «ص» أوسعُ بكثيرٍ من ثلاث «ا» — والمتوسّط يساويهما */
    expect(arabicAdvance('صصص')).toBeGreaterThan(arabicAdvance('ااا') * 4)
    expect(arabicAdvance('سسس')).toBeCloseTo(0.8994 * 3, 3)
  })

  it('وما لا يُعرف يأخذ أوسعها — فلا يفيض حرفٌ مجهول', () => {
    expect(arabicAdvance('ض')).toBe(1.0625)
  })

  it('والمتوسّط القديم كان يُخطئ «صصص» بثلاثين بالمئة', () => {
    const assumed = 3 * 0.82
    const actual = arabicAdvance('صصص')
    expect((actual - assumed) / actual).toBeGreaterThan(0.22)
  })
})

describe('الحجم المحسوب يَسَع الخانة', () => {
  /*
   * وهذا هو الفحص الذي يمسك العطب.
   *
   * وأوّلُ صياغةٍ كانت تستنسخ لوحةً في المتصفّح وتُبدّل نصَّها ثمّ تقيس —
   * وحجمُ الخط كان قد حُسب للحروف الأصلية، فبقي كما هو. أي أنّها تقيس شيئًا
   * آخر: جُرّبت بإرجاع المتوسّط القديم فمرّت. فصار القياس على **الحساب**.
   */
  const ROOM = 100 // عرض الخانة
  const BASE = 40 // الحجم المطلوب قبل التقييد

  /** عرضُ النصّ بعد أن يُقيَّد حجمُه — يجب ألّا يتجاوز الخانة. */
  function renderedWidth(letters: string, spacing = 0.06): number {
    const size = fitFontSize(arabicAdvance(letters), BASE, ROOM, spacing, letters.length)
    return size * (arabicAdvance(letters) + spacing * (letters.length - 1))
  }

  for (const letters of ['صصص', 'سسس', 'ااا', 'أبح', 'صصص'.slice(0, 2)]) {
    it(`«${letters}» تَسَع خانتها`, () => {
      expect(renderedWidth(letters)).toBeLessThanOrEqual(ROOM + 0.001)
    })
  }

  it('والمتوسّط القديم كان يُفيضها — فهذا ما يُحرَس', () => {
    /* الحساب القديم: عددٌ × 0.82 — فيُقدَّر «صصص» بـ2.46 وهي 3.19 */
    const oldAdvance = 3 * 0.82
    const oldSize = fitFontSize(oldAdvance, BASE, ROOM, 0.06, 3)
    const actualWidth = oldSize * (arabicAdvance('صصص') + 0.06 * 2)
    expect(actualWidth, 'المتوسّط القديم لم يكن يُفيض؟ راجع القياس').toBeGreaterThan(ROOM)
  })

  it('و«ااا» لا تُضيَّق: تأخذ الحجم الكامل لأنّها تَسَعه', () => {
    const size = fitFontSize(arabicAdvance('ااا'), BASE, ROOM, 0.06, 3)
    expect(size, '«ااا» ضُيّقت بلا سبب').toBe(BASE)
  })
})
