import { describe, expect, it } from 'vitest'
import { SOCIAL_URL, normalizeSocialHandle } from '@/lib/domain/types'
import {
  isSupportedPlateLetter,
  lettersToLatin,
  normalizeArabicLetters,
  normalizePlateNumbers,
  toArabicIndicDigits,
  toWesternDigits,
} from '@/lib/saudi-plate-mapping'

describe('تحويل حروف اللوحة السعودية', () => {
  it('يحوّل الحروف إلى مقابلها اللاتيني الخاص باللوحات', () => {
    expect(lettersToLatin('ابح')).toBe('ABJ')
    expect(lettersToLatin('صمع')).toBe('XZE')
    expect(lettersToLatin('قكل')).toBe('GKL')
    expect(lettersToLatin('نهو')).toBe('NHU')
    expect(lettersToLatin('ي')).toBe('V')
  })

  it('يطبّع أشكال الألف والهاء والياء البديلة', () => {
    // الحرف المعتمد على اللوحة «ا» و«ى» — وبقيّة الأشكال تُطبَّع إليهما
    expect(normalizeArabicLetters('أإآ')).toBe('ااا')
    expect(normalizeArabicLetters('ةي')).toBe('هى')
  })

  it('يقبل الإدخال اللاتيني ويحوّله إلى الحرف العربي المعتمد', () => {
    expect(normalizeArabicLetters('ABJ')).toBe('ابح')
    expect(lettersToLatin(normalizeArabicLetters('ABJ'))).toBe('ABJ')
  })

  it('يحترم الحد الأقصى لعدد الحروف', () => {
    expect(normalizeArabicLetters('أبحد', 3)).toBe('ابح')
    expect(normalizeArabicLetters('أبحد', 2)).toBe('اب')
  })

  it('يتجاهل الحروف غير المدعومة والمسافات المكررة', () => {
    expect(normalizeArabicLetters('أ  ب#ح')).toBe('ابح')
    expect(isSupportedPlateLetter('ز')).toBe(false)
    expect(isSupportedPlateLetter('أ')).toBe(true)
  })
})

describe('تحويل أرقام اللوحة', () => {
  it('يمنع تجاوز أربعة أرقام ويقبل الأرقام فقط', () => {
    expect(normalizePlateNumbers('12345')).toBe('1234')
    expect(normalizePlateNumbers('12a3')).toBe('123')
    expect(normalizePlateNumbers('  7 7 ')).toBe('77')
  })

  it('يحوّل الأرقام العربية الشرقية والفارسية إلى غربية', () => {
    expect(normalizePlateNumbers('٤٠٤٠')).toBe('4040')
    expect(toWesternDigits('۱۲۳')).toBe('123')
  })

  it('يولّد الصف العلوي بالأرقام العربية الشرقية', () => {
    expect(toArabicIndicDigits('4040')).toBe('٤٠٤٠')
    expect(toArabicIndicDigits('1')).toBe('١')
  })
})

describe('تطبيع حسابات التواصل', () => {
  it('يقبل الاسم و@الاسم والرابط الكامل ويُخرج شكلًا واحدًا', () => {
    // شكل واحد مخزَّن: وإلا صار الحساب نفسه حسابين
    expect(normalizeSocialHandle('waleed.plates')).toBe('waleed.plates')
    expect(normalizeSocialHandle('@waleed.plates')).toBe('waleed.plates')
    expect(normalizeSocialHandle('  @@Waleed.Plates  ')).toBe('waleed.plates')
    expect(normalizeSocialHandle('https://www.tiktok.com/@waleed.plates')).toBe('waleed.plates')
    expect(normalizeSocialHandle('https://www.instagram.com/waleed.plates/')).toBe('waleed.plates')
    expect(normalizeSocialHandle('https://www.snapchat.com/add/waleed_sa')).toBe('waleed_sa')
  })

  it('يرفض ما لا يُفتح حسابًا بدل تخزينه نصًّا ميّتًا', () => {
    expect(normalizeSocialHandle('وليد')).toBeNull()
    expect(normalizeSocialHandle('a')).toBeNull()
    expect(normalizeSocialHandle('has spaces')).toBeNull()
    expect(normalizeSocialHandle('x'.repeat(31))).toBeNull()
    expect(normalizeSocialHandle('')).toBeNull()
    expect(normalizeSocialHandle(null)).toBeNull()
    expect(normalizeSocialHandle(undefined)).toBeNull()
  })

  it('روابط المنصّات تُبنى من الاسم المطبَّع', () => {
    expect(SOCIAL_URL.tiktok('waleed')).toBe('https://www.tiktok.com/@waleed')
    expect(SOCIAL_URL.snapchat('waleed')).toBe('https://www.snapchat.com/add/waleed')
    expect(SOCIAL_URL.instagram('waleed')).toBe('https://www.instagram.com/waleed')
  })
})
