import { describe, expect, it } from 'vitest'
import { arabicCount } from '@/lib/utils'

const DEAL = { one: 'صفقة واحدة', two: 'صفقتان', few: 'صفقات', many: 'صفقة' }

describe('تصريف المعدود', () => {
  it('المفرد والمثنّى يُغنيان عن الرقم', () => {
    expect(arabicCount(1, DEAL)).toBe('صفقة واحدة')
    expect(arabicCount(2, DEAL)).toBe('صفقتان')
  })

  it('من ثلاثة إلى عشرة: جمع قِلّة مع الرقم', () => {
    expect(arabicCount(3, DEAL)).toBe('3 صفقات')
    expect(arabicCount(10, DEAL)).toBe('10 صفقات')
  })

  /*
   * ما فوق العشرة يعود مفردًا — وهو ما كان مكسورًا في الواجهة: «11 صفقات».
   */
  it('من أحد عشر إلى تسعة وتسعين: مفرد مع الرقم', () => {
    expect(arabicCount(11, DEAL)).toBe('11 صفقة')
    expect(arabicCount(99, DEAL)).toBe('99 صفقة')
  })

  it('المئة فصاعدًا: مفرد كذلك', () => {
    expect(arabicCount(100, DEAL)).toBe('100 صفقة')
    expect(arabicCount(1_000, DEAL)).toBe('1000 صفقة')
  })

  it('الصفر يُصاغ نفيًا لا رقمًا', () => {
    expect(arabicCount(0, DEAL)).toBe('لا صفقة')
    expect(arabicCount(0, { ...DEAL, zero: 'لا صفقات بعد' })).toBe('لا صفقات بعد')
  })
})
