import { describe, expect, it } from 'vitest'

import {
  LATIN_ASCENT_SHARE,
  LATIN_CAP_INK,
  LATIN_DIGIT_INK,
  layoutRow,
} from '@/components/plate/arial-metrics'

const BAND_TOP = 42.8
const BAND_HEIGHT = 114.4

describe('توزيع الصفّ داخل شريطه', () => {
  it('بلا توسيط تبقى القاعدة مثبّتة في نصيب الصعود — فلا تتزحزح الصفوف المتجاورة', () => {
    const narrow = layoutRow(
      [{ widthLimit: 40, ink: LATIN_DIGIT_INK }],
      BAND_TOP,
      BAND_HEIGHT,
      LATIN_ASCENT_SHARE,
    )
    const wide = layoutRow(
      [{ widthLimit: 140, ink: LATIN_DIGIT_INK }],
      BAND_TOP,
      BAND_HEIGHT,
      LATIN_ASCENT_SHARE,
    )

    expect(narrow.baseline).toBeCloseTo(BAND_TOP + BAND_HEIGHT * LATIN_ASCENT_SHARE, 6)
    expect(wide.baseline).toBeCloseTo(narrow.baseline, 6)
  })

  it('التوسيط يقسم الفائض نصفين فوق الحبر وتحته', () => {
    const row = layoutRow(
      [{ widthLimit: 60, ink: LATIN_DIGIT_INK }],
      BAND_TOP,
      BAND_HEIGHT,
      LATIN_ASCENT_SHARE,
      { center: true },
    )
    const [size] = row.sizes
    // الحجم يحدّه العرض لا الارتفاع — وهذه هي الحال التي كانت تترك هامشًا فوق
    expect(size).toBeCloseTo(60, 6)

    const top = row.baseline - size * LATIN_DIGIT_INK.asc
    const bottom = row.baseline + size * LATIN_DIGIT_INK.desc
    expect(top - BAND_TOP).toBeCloseTo(BAND_TOP + BAND_HEIGHT - bottom, 6)
  })

  it('التوسيط يُبقي قاعدةً واحدة للأرقام والحروف وإن اختلفت أحجامها', () => {
    const row = layoutRow(
      [
        { widthLimit: 60, ink: LATIN_DIGIT_INK },
        { widthLimit: 90, ink: LATIN_CAP_INK },
      ],
      BAND_TOP,
      BAND_HEIGHT,
      LATIN_ASCENT_SHARE,
      { center: true },
    )

    expect(row.sizes[0]).not.toBeCloseTo(row.sizes[1], 3)
    // أطول الحبرين هو الذي يُوسَّط، والآخر يشاركه القاعدة نفسها
    const tallest = Math.max(...row.sizes.map((size, i) => size * [LATIN_DIGIT_INK, LATIN_CAP_INK][i].asc))
    const deepest = Math.max(...row.sizes.map((size, i) => size * [LATIN_DIGIT_INK, LATIN_CAP_INK][i].desc))
    expect(row.baseline).toBeCloseTo(BAND_TOP + (BAND_HEIGHT - (tallest + deepest)) / 2 + tallest, 6)
  })

  it('الحبر الذي يملأ شريطه لا يتحرّك بالتوسيط', () => {
    const plain = layoutRow(
      [{ widthLimit: 999, ink: LATIN_DIGIT_INK }],
      BAND_TOP,
      BAND_HEIGHT,
      LATIN_ASCENT_SHARE,
    )
    const centered = layoutRow(
      [{ widthLimit: 999, ink: LATIN_DIGIT_INK }],
      BAND_TOP,
      BAND_HEIGHT,
      LATIN_ASCENT_SHARE,
      { center: true },
    )
    expect(centered.sizes[0]).toBeCloseTo(plain.sizes[0], 6)
    // ما بقي من فائضٍ يُقسم نصفين، والباقي هنا أقلّ من ٢٪ من الشريط
    expect(centered.baseline).toBeLessThanOrEqual(plain.baseline)
    expect(plain.baseline - centered.baseline).toBeLessThan(BAND_HEIGHT * 0.02)
  })
})
