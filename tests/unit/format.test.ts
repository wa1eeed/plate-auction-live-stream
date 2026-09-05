import { describe, expect, it } from 'vitest'
import { formatCountdown, formatTimestamp } from '@/lib/utils'
import { formatAmount, parseAmountInput, riyalsToHalalas } from '@/lib/domain/money'

describe('تنسيق العدّاد', () => {
  it('يعرض الثواني وحدها تحت الدقيقة', () => {
    expect(formatCountdown(45_000)).toBe('45 ث')
    expect(formatCountdown(0)).toBe('0 ث')
  })

  it('يعرض دقائق وثوانٍ تحت الساعة', () => {
    expect(formatCountdown(23 * 60_000 + 10_000)).toBe('23:10')
  })

  it('يعرض ساعات ودقائق وثوانٍ تحت اليوم', () => {
    expect(formatCountdown(5 * 3_600_000 + 23 * 60_000 + 10_000)).toBe('5:23:10')
  })

  it('يعرض الأيام بصيغة عربية سليمة', () => {
    expect(formatCountdown(24 * 3_600_000)).toBe('1 يوم')
    expect(formatCountdown(2 * 24 * 3_600_000)).toBe('يومان')
    expect(formatCountdown(3 * 24 * 3_600_000 + 5 * 3_600_000)).toBe('3 أيام و5 س')
    expect(formatCountdown(12 * 24 * 3_600_000)).toBe('12 يومًا')
  })
})

describe('تنسيق المبالغ', () => {
  it('يستخدم الأرقام الغربية مع فواصل الآلاف', () => {
    expect(formatAmount(riyalsToHalalas(25_500))).toBe('25,500')
    expect(formatAmount(riyalsToHalalas(1_000_000))).toBe('1,000,000')
  })

  it('يقرأ المدخلات بالأرقام العربية والفواصل', () => {
    expect(parseAmountInput('25,500')).toBe(riyalsToHalalas(25_500))
    expect(parseAmountInput('٢٥٥٠٠')).toBe(riyalsToHalalas(25_500))
    expect(parseAmountInput('abc')).toBeNull()
  })
})

describe('الختم الزمني للأحداث', () => {
  // كل الأمثلة بتوقيت السعودية (UTC+3) — وهو ما تثبّته الدالة
  const now = '2026-08-31T12:00:00.000Z' // 15:00 بالرياض

  /** `Intl` يحشر علامات اتجاه بين المقاطع — تُهمَل عند المطابقة لا عند العرض. */
  const plain = (text: string) => text.replace(/[\u200e\u200f]/g, '')

  it('كامل دائمًا: تاريخ رقمي ووقت، بلا اختصار', () => {
    expect(plain(formatTimestamp('2026-08-31T04:02:00.000Z', now))).toBe('31/08/2026 · 07:02 ص')
  })

  it('لا «اليوم» ولا «أمس» — الأسطر تُقارن بعضها ببعض في كشف طويل', () => {
    expect(plain(formatTimestamp('2026-08-30T04:02:00.000Z', now))).toBe('30/08/2026 · 07:02 ص')
    expect(formatTimestamp('2026-08-30T04:02:00.000Z', now)).not.toContain('أمس')
  })

  it('الشهر رقم لا اسم — فلا يهتزّ عرض العمود من شهر لآخر', () => {
    const value = plain(formatTimestamp('2026-08-20T04:02:00.000Z', now))
    expect(value).toBe('20/08/2026 · 07:02 ص')
    /*
     * لا حرف عربيّ إلّا علامة الصباح والمساء.
     *
     * المقصود منع **اسم الشهر**: يطول ويختلف عرضه من شهر لآخر فتهتزّ أعمدة
     * الجداول. و«ص»/«م» حرفٌ واحد ثابت العرض لا يفعل ذلك — فيُستثنى بالنصّ
     * لا بتوسيع الشرط إلى «لا عربية أصلًا».
     */
    expect(value.replace(/ [صم]$/, '')).not.toMatch(/\p{Script=Arabic}/u)
  })

  it('السنة حاضرة دائمًا لا عند اختلافها فقط', () => {
    expect(plain(formatTimestamp('2025-12-20T04:02:00.000Z', now))).toBe('20/12/2025 · 07:02 ص')
    expect(plain(formatTimestamp('2026-08-20T04:02:00.000Z', now))).toContain('2026')
  })

  it('يحسب اليوم بتوقيت السعودية لا بتوقيت UTC', () => {
    // 2026-08-30T22:30Z هو 01:30 من يوم 31 بالرياض
    expect(plain(formatTimestamp('2026-08-30T22:30:00.000Z', now))).toBe('31/08/2026 · 01:30 ص')
  })

  it('يعيد شرطة للقيمة الفارغة', () => {
    expect(formatTimestamp(null, now)).toBe('—')
  })
})

/*
 * التقويم ميلاديّ مهما كان جهاز القارئ.
 *
 * تقويم `ar-SA` الافتراضيّ في CLDR أمّ القرى، وكلّ محرّك يحسمه ببيانات ICU
 * التي بُني بها — فيُقرأ التاريخ نفسه ميلاديًّا هنا وهجريًّا هناك. وأسوأ منه
 * أنّ الخادم يرسم بتقويمه والعميل يعيد الرسم بتقويمه فيسقط الترطيب.
 */
describe('تقويم المنصّة', () => {
  it('ميلاديّ مثبَّت لا يتبع المحرّك', () => {
    expect(formatTimestamp('2026-09-05T09:00:00.000Z')).toContain('2026')
    // ٢٠٢٦ ميلاديّة تقابل ١٤٤٧–١٤٤٨ هجريّة، فظهورها نفيٌ للهجريّ
    expect(formatTimestamp('2026-09-05T09:00:00.000Z')).not.toContain('1447')
    expect(formatTimestamp('2026-09-05T09:00:00.000Z')).not.toContain('1448')
  })

  it('يوافق ما يرسمه المتصفّح بالتقويم نفسه — فلا يختلف الخادم عن العميل', () => {
    const iso = '2026-09-05T09:00:00.000Z'
    const pinned = new Intl.DateTimeFormat('ar-SA-u-nu-latn-ca-gregory', {
      timeZone: 'Asia/Riyadh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
    expect(pinned.resolvedOptions().calendar).toBe('gregory')
    // `formatTimestamp` يضمّ الساعة، فيُقارَن الجزء التاريخيّ منه
    expect(formatTimestamp(iso).startsWith(pinned.format(new Date(iso)))).toBe(true)
  })
})
