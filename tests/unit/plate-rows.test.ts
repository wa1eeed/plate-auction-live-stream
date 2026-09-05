import { describe, expect, it } from 'vitest'

import {
  ARABIC_DIGIT_INK,
  ARABIC_LETTER_INK,
  LATIN_CAP_INK,
  LATIN_DIGIT_INK,
  inkOf,
  layoutRow,
} from '@/components/plate/arial-metrics'

const BAND_TOP = 20
const BAND_HEIGHT = 80

const ink = (size: number, metrics: { asc: number; desc: number }) =>
  size * (metrics.asc + metrics.desc)

describe('توزيع الصفّ داخل شريطه', () => {
  it('الحبر بارتفاعٍ واحد وإن اختلفت أحجام الخطّ', () => {
    /*
     * حبر اللاتينيّ ‎0.73em‎ وحبر الأرقام العربية ‎0.58em‎، فحجمٌ واحد يُخرج
     * ارتفاعين متفاوتين بالرُّبع. والمقاس يُطلب بالحبر فيتساوى ما يُرى.
     */
    const row = layoutRow(
      [
        { widthLimit: 999, ink: ARABIC_DIGIT_INK },
        { widthLimit: 999, ink: LATIN_CAP_INK },
      ],
      BAND_TOP,
      BAND_HEIGHT,
    )

    expect(row.sizes[0]).not.toBeCloseTo(row.sizes[1], 1)
    expect(ink(row.sizes[0], ARABIC_DIGIT_INK)).toBeCloseTo(ink(row.sizes[1], LATIN_CAP_INK), 6)
  })

  it('الحبر دون شريطه، فللحرف فراغٌ حوله', () => {
    const row = layoutRow([{ widthLimit: 999, ink: LATIN_DIGIT_INK }], BAND_TOP, BAND_HEIGHT)
    const height = ink(row.sizes[0], LATIN_DIGIT_INK)
    expect(height).toBeLessThan(BAND_HEIGHT)
    expect(height).toBeGreaterThan(BAND_HEIGHT * 0.6)
  })

  it('كلٌّ مُوسَّطٌ في شريطه، فتتحاذى أعالي الحبر وأسافله', () => {
    const items = [
      { widthLimit: 999, ink: ARABIC_DIGIT_INK },
      { widthLimit: 999, ink: inkOf('رر', ARABIC_LETTER_INK) },
    ]
    const row = layoutRow(items, BAND_TOP, BAND_HEIGHT)

    const tops = items.map((item, i) => row.baselines[i] - row.sizes[i] * item.ink.asc)
    const bottoms = items.map((item, i) => row.baselines[i] + row.sizes[i] * item.ink.desc)
    expect(tops[0]).toBeCloseTo(tops[1], 6)
    expect(bottoms[0]).toBeCloseTo(bottoms[1], 6)
    expect(tops[0] - BAND_TOP).toBeCloseTo(BAND_TOP + BAND_HEIGHT - bottoms[0], 6)
  })

  it('ضيقُ الخانة يحدّ الحجم قبل الشريط، ويظلّ الحبر مُوسَّطًا', () => {
    const row = layoutRow([{ widthLimit: 40, ink: LATIN_CAP_INK }], BAND_TOP, BAND_HEIGHT)
    expect(row.sizes[0]).toBeCloseTo(40, 6)
    const top = row.baselines[0] - 40 * LATIN_CAP_INK.asc
    const bottom = row.baselines[0] + 40 * LATIN_CAP_INK.desc
    expect(top - BAND_TOP).toBeCloseTo(BAND_TOP + BAND_HEIGHT - bottom, 6)
  })

  it('الألف بلا همزة معروفةٌ في الجدول، فلا تُقدَّر بأوسع الحدود', () => {
    expect(ARABIC_LETTER_INK['ا']).toBeDefined()
    expect(inkOf('ا', ARABIC_LETTER_INK)).toEqual(ARABIC_LETTER_INK['ا'])
  })
})
