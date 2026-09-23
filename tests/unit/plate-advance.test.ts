import { describe, expect, it } from 'vitest'
import {
  ARABIC_LETTER_ADVANCE,
  ARABIC_SEPARATOR,
  ARABIC_SEPARATOR_ADVANCE,
  SPACE_ADVANCE,
  arabicAdvance,
  fitFontSize,
  FIT_SAFETY,
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

describe('الفاصل بين الحروف يُقاس بعرضه لا بتقدير', () => {
  it('هو مانعُ وصلٍ ثمّ مسافة — بهذا الترتيب', () => {
    expect(Array.from(ARABIC_SEPARATOR)).toEqual(['\u200c', ' '])
  })

  it('وعرضُه عرضُ المسافة وحدها — فمانعُ الوصل بلا عرض', () => {
    expect(ARABIC_SEPARATOR_ADVANCE).toBe(SPACE_ADVANCE)
    /* مقيسٌ بـ`measureText` على Arial Bold — لا مقدَّر */
    expect(SPACE_ADVANCE).toBeCloseTo(0.2778, 4)
  })

  it('والتقدير القديم (0.06) كان يُنقصه إلى الخُمس', () => {
    expect(ARABIC_SEPARATOR_ADVANCE / 0.06).toBeGreaterThan(4)
  })
})

/**
 * خانة الحروف في اللوحة الاعتيادية — أضيقُ خاناتها، وفيها وقع الفيضان.
 *
 * `letters: { from: 232, to: 386 }` و`fonts.letters: 170`، والحرف يُترك له
 * ١٤٪ من خانته فراغًا (`× 0.86`) كما في الراسم.
 */
describe('حروفُ الاعتيادية تَسَع خانتها بعد حساب الفاصل', () => {
  const CELL = 386 - 232
  const ROOM = CELL * 0.86
  const BASE = 170

  /** العرضُ **كما يُرسم**: الحروف وفواصلها بعد أن يُقيَّد الحجم. */
  function renderedWidth(letters: string, gap = ARABIC_SEPARATOR_ADVANCE): number {
    const count = Array.from(letters).length
    const size = fitFontSize(arabicAdvance(letters), BASE, ROOM, gap, count)
    /* والرسم يصل بالفاصل الحقيقي مهما قيل للحاسب — وهنا كان الفرق */
    return size * (arabicAdvance(letters) + ARABIC_SEPARATOR_ADVANCE * (count - 1))
  }

  for (const letters of ['صصص', 'سسس', 'سعد', 'ااا', 'صسص', 'ربن', 'كلم', 'صص', 'ص']) {
    it(`«${letters}» لا تتجاوز ${CELL}`, () => {
      expect(renderedWidth(letters)).toBeLessThanOrEqual(CELL)
    })
  }

  /*
   * **ويُقاس بما تهدف إليه المطابقة لا بالخانة.**
   *
   * هامشُ الأمان (`FIT_SAFETY`) يُبقي الحبر داخل الخانة ولو أخطأ التقدير —
   * وهو المقصود منه. فلو قيس هذا الحارس بالخانة لَمرّ بعد إضافته وهو يحرس
   * عطبًا ما زال قائمًا في الحساب. والهدف هو `ROOM × FIT_SAFETY`.
   */
  const TARGET = ROOM * FIT_SAFETY

  it('وبالتقدير القديم كانت «سعد» تتجاوز ما تهدف إليه المطابقة', () => {
    const old = renderedWidth('سعد', 0.06)
    expect(old, 'التقدير القديم لم يكن يُفيض؟ راجع القياس').toBeGreaterThan(TARGET)
    expect(renderedWidth('سعد')).toBeLessThanOrEqual(TARGET + 0.001)
  })

  /*
   * **الهامش لا يمسّ ما كان يَسَع خانته.**
   *
   * المطابقة بالعرض لا تعمل إلّا حين يتجاوز المجموعُ الخانة، والحرفُ الضيّق
   * وحده يقع بعيدًا عن حدّها.
   *
   * **وهذا حدُّ العرض لا المرسوم**: الحجم النهائيّ `min(حدّ العرض، حدّ
   * الشريط)`. فـ«رر» يُضيَّق حدُّ عرضها هنا ويبقى المرسوم على حاله لأنّ
   * الشريط أضيقُ منه — وقِيس على المتصفّح فلم يتغيّر.
   */
  it('الحروفُ الضيّقة تأخذ الحجم الكامل — قبل الهامش وبعده', () => {
    for (const letters of ['ا', 'ر']) {
      const count = Array.from(letters).length
      expect(
        fitFontSize(arabicAdvance(letters), BASE, ROOM, ARABIC_SEPARATOR_ADVANCE, count),
        `«${letters}» ضُيّقت بلا حاجة`,
      ).toBe(BASE)
    }
  })

  /*
   * **وما كان يُضيَّق يُضيَّق أكثر بقدر الهامش — وهذه كلفتُه.**
   *
   * وهي كلفةٌ في **حدّ العرض** لا في المرسوم بالضرورة: الحجم النهائيّ
   * `min(حدّ العرض، حدّ الشريط)`، والشريط هو القيد في أكثر اللوحات. وقِيس
   * على المتصفّح بعد الهامش: «ا» و«رر» و«كطع» و«حد» **لم تتغيّر**، وتغيّرت
   * «سعد» (‎−١٠٫٨‎ ← ‎−١٦٫١‎) و«وسم» (‎−١٤‎ ← ‎−٢٠٫٩‎) — وهما أضيقُ ما في
   * الصفحة، وهما بعينهما ما كان مهدَّدًا بالفيض.
   */
  it('وما كان مُضيَّقًا يُضيَّق بقدر الهامش لا أكثر', () => {
    for (const letters of ['ص', 'صص', 'صصص', 'سعد']) {
      const count = Array.from(letters).length
      const withSafety = fitFontSize(arabicAdvance(letters), BASE, ROOM, ARABIC_SEPARATOR_ADVANCE, count)
      const advance = arabicAdvance(letters) + ARABIC_SEPARATOR_ADVANCE * (count - 1)
      const withoutSafety = (ROOM / (BASE * advance)) * BASE
      expect(withSafety / withoutSafety, `«${letters}»`).toBeCloseTo(FIT_SAFETY, 5)
    }
  })

  /*
   * **ولماذا الهامش أصلًا؟** الخطّ يُطلب من النظام، وArial غائبٌ في لينكس
   * وأندرويد — فيسقط الرسم إلى بديلٍ أوسع. وقِيس في بوّابة لينكس: «نور»
   * تجاوزت خانتها بـ٥٫٥ من ١٥٤، أي نحو ٣٫٦٪.
   */
  it('والهامش يتّسع لبديلٍ أوسع من Arial باثني عشر في المئة', () => {
    /*
     * ويُقاس باثني عشر لا بأربعة عشر: الهامش أربعة عشر، ويُترك فضلٌ فلا
     * يصير الحارسُ مساويًا للثابت فيمرّ مهما بلغ.
     */
    for (const letters of ['صصص', 'سسس', 'سعد', 'نور', 'بدر', 'صسص']) {
      const wider = renderedWidth(letters) * 1.12
      expect(wider, `«${letters}» تفيض ببديلٍ أوسع ١٢٪`).toBeLessThanOrEqual(CELL)
    }
  })
})
