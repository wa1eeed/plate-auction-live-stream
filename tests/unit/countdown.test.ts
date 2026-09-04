import { describe, expect, it } from 'vitest'
import {
  compactCountdown,
  countdownUrgency,
  elapsedRatio,
  splitCountdown,
  visibleUnits,
} from '@/lib/domain/countdown'

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
