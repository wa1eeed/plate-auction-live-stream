import { describe, expect, it } from 'vitest'
import { compactCountdown, countdownUrgency, elapsedRatio, preciseCountdown, splitCountdown, visibleUnits } from '@/lib/domain/countdown'

const SEC = 1_000
const MIN = 60 * SEC
const HOUR = 60 * MIN
const DAY = 24 * HOUR

describe('تفكيك العدّاد', () => {
  it('يفكّك المدّة إلى أيام وساعات ودقائق وثوانٍ', () => {
    expect(splitCountdown(2 * DAY + 3 * HOUR + 4 * MIN + 5 * SEC)).toMatchObject({
      days: 2,
      hours: 3,
      minutes: 4,
      seconds: 5,
    })
  })

  it('لا ينتج قيمًا سالبة لمدّة منتهية', () => {
    expect(splitCountdown(-5_000)).toMatchObject({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  })
})

describe('مراحل الإلحاح', () => {
  it('تتدرّج مع اقتراب الحسم', () => {
    expect(countdownUrgency(3 * DAY)).toBe('normal')
    expect(countdownUrgency(30 * MIN)).toBe('soon')
    expect(countdownUrgency(3 * MIN)).toBe('urgent')
    expect(countdownUrgency(30 * SEC)).toBe('final')
    expect(countdownUrgency(0)).toBe('ended')
  })

  it('حدود المراحل دقيقة لا تقريبية', () => {
    expect(countdownUrgency(60 * MIN)).toBe('normal')
    expect(countdownUrgency(60 * MIN - 1)).toBe('soon')
    expect(countdownUrgency(5 * MIN)).toBe('soon')
    expect(countdownUrgency(5 * MIN - 1)).toBe('urgent')
    expect(countdownUrgency(MIN)).toBe('urgent')
    expect(countdownUrgency(MIN - 1)).toBe('final')
  })
})

describe('الوحدات المعروضة', () => {
  it('تُسقط الأيام الصفرية ولا تنزل عن ثلاث وحدات', () => {
    expect(visibleUnits(splitCountdown(5 * HOUR))).toEqual(['hours', 'minutes', 'seconds'])
    expect(visibleUnits(splitCountdown(30 * SEC))).toEqual(['hours', 'minutes', 'seconds'])
  })

  it('تُظهر الأيام عند وجودها', () => {
    expect(visibleUnits(splitCountdown(DAY + HOUR))).toEqual([
      'days',
      'hours',
      'minutes',
      'seconds',
    ])
  })
})

describe('نسبة ما مضى', () => {
  it('تُحسب من المدّة الكاملة', () => {
    expect(elapsedRatio(DAY, 4 * DAY)).toBeCloseTo(0.75)
    expect(elapsedRatio(4 * DAY, 4 * DAY)).toBe(0)
    expect(elapsedRatio(0, 4 * DAY)).toBe(1)
  })

  it('محصورة بين صفر وواحد مهما كانت المدخلات', () => {
    expect(elapsedRatio(-DAY, 4 * DAY)).toBe(1)
    expect(elapsedRatio(10 * DAY, 4 * DAY)).toBe(0)
    expect(elapsedRatio(DAY, 0)).toBe(0)
  })
})

describe('النصّ المضغوط', () => {
  it('يعرض الأيام والساعات بتصريف عربي صحيح', () => {
    expect(compactCountdown(DAY + 2 * HOUR)).toBe('1 يوم و2 س')
    expect(compactCountdown(2 * DAY + 3 * HOUR)).toBe('2 يومان و3 س')
    expect(compactCountdown(5 * DAY)).toBe('5 أيام و0 س')
  })

  it('يعرض الثواني لما دون اليوم — هناك تُحسب', () => {
    expect(compactCountdown(3 * HOUR + 4 * MIN + 5 * SEC)).toBe('03:04:05')
  })

  it('يسقط الساعات الصفرية فيبقى دقيقة:ثانية', () => {
    expect(compactCountdown(4 * MIN + 5 * SEC)).toBe('04:05')
  })

  it('يعلن الانتهاء بلا أرقام', () => {
    expect(compactCountdown(0)).toBe('انتهى')
  })
})

/**
 * **عدٌّ دقيقٌ لصفحةٍ فيها عدّادٌ واحد.**
 *
 * و`compactCountdown` تُخفي الثواني ما دام أمامك أيّام، عمدًا: بطاقةُ السوق
 * تعرض عشراتِ اللوحات، وعدٌّ يتبدّل كلَّ ثانيةٍ في كلٍّ منها ضجيج.
 *
 * **ومهلةُ الصفقة غيرُ ذلك**: «يومان و٥ س» لا يتبدّل إلّا كلَّ ساعة، فيُقرأ
 * نصًّا جامدًا — ومن فتح الصفحةَ مرّتين رآه كما هو فظنّه معطوبًا.
 */
describe('العدّ الدقيق', () => {
  const H = 3_600_000
  const M = 60_000

  it('يُظهر الساعة والدقيقة والثانية ولو بقيت أيّام', () => {
    expect(preciseCountdown(2 * 24 * H + 5 * H + 23 * M + 41_000)).toBe('يومان · 05:23:41')
    expect(preciseCountdown(5 * 24 * H + 1 * H)).toBe('5 أيام · 01:00:00')
    expect(preciseCountdown(24 * H + 9 * M)).toBe('يوم · 00:09:00')
  })

  it('ودون اليوم ساعةٌ كاملة', () => {
    expect(preciseCountdown(2 * H + 3 * M + 4_000)).toBe('02:03:04')
    expect(preciseCountdown(45_000)).toBe('00:00:45')
  })

  it('وما انقضى يُقال «انتهى» لا صفرًا', () => {
    expect(preciseCountdown(0)).toBe('انتهى')
    expect(preciseCountdown(-5_000)).toBe('انتهى')
  })

  /** والمضغوطةُ على حالها — بطاقاتُ السوق لا تُثقَل بالثواني. */
  it('ولا تتغيّر المضغوطة', () => {
    expect(compactCountdown(2 * 24 * H + 5 * H)).toBe('2 يومان و5 س')
  })
})
