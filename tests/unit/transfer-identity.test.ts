import { describe, expect, it } from 'vitest'
import {
  ABSHER_FEES,
  IDENTITY_ERROR_TEXT,
  validateTransferIdentity,
} from '@/lib/domain/absher-transfer'

/**
 * **تحقّقُ هويّة المشتري — قبل أن تصل أبشر.**
 *
 * ورقمٌ خاطئٌ لا يُردّ في المنصّة بل في أبشر، بعد أن يكون البائعُ فتح
 * الخدمةَ وأدخل ومضى — فيرجع بلا سببٍ مفهوم ولا يدري أين الخطأ. فما يُقاس
 * بيقينٍ يُقاس عندنا.
 */
describe('هويّة المشتري لنقل اللوحة', () => {
  const ok = { nationalId: '1098765432', birthDate: '1990-05-04', birthCalendar: 'gregorian' }

  it('يقبل هوية مواطنٍ ومقيمٍ معًا', () => {
    expect(validateTransferIdentity(ok)).toBeNull()
    expect(validateTransferIdentity({ ...ok, nationalId: '2123456789' })).toBeNull()
  })

  it('ويردّ ما ليس عشر خاناتٍ تبدأ بـ١ أو ٢', () => {
    for (const nationalId of ['3123456789', '109876543', '10987654321', '', 'abcdefghij']) {
      expect(validateTransferIdentity({ ...ok, nationalId }), nationalId).toBe('ID_FORMAT')
    }
  })

  it('ويردّ تاريخًا غيرَ مكتملِ الصيغة', () => {
    for (const birthDate of ['1990-5-4', '04/05/1990', '1990-13-01', '1990-01-32', '']) {
      expect(validateTransferIdentity({ ...ok, birthDate }), birthDate).toBe('DATE_FORMAT')
    }
  })

  /**
   * **والمدى يسع التقويمين.**
   *
   * فسجلُّ أبشر هجريٌّ للمواطن وميلاديٌّ لكثيرٍ من المقيمين — و١٤١٢ هجريّة
   * تاريخُ ميلادٍ صحيحٌ تمامًا كـ١٩٩١ ميلاديّة. فمدًى يردّ أحدَهما يردّ
   * نصفَ المستخدمين.
   */
  it('ويقبل السنةَ الهجريّة كما يقبل الميلاديّة', () => {
    expect(validateTransferIdentity({ ...ok, birthDate: '1412-07-19' })).toBeNull()
    expect(validateTransferIdentity({ ...ok, birthDate: '1991-02-04' })).toBeNull()
  })

  it('ويردّ ما خرج عن المدى', () => {
    expect(validateTransferIdentity({ ...ok, birthDate: '0990-05-04' })).toBe('DATE_RANGE')
    expect(validateTransferIdentity({ ...ok, birthDate: '2199-05-04' })).toBe('DATE_RANGE')
  })

  it('ولكلّ خطأٍ نصٌّ يقول ما يُصلحه', () => {
    for (const key of Object.keys(IDENTITY_ERROR_TEXT) as (keyof typeof IDENTITY_ERROR_TEXT)[]) {
      expect(IDENTITY_ERROR_TEXT[key].length, key).toBeGreaterThan(10)
    }
  })

  /** ورسومُ أبشر مكتوبةٌ مرّةً — تُقرأ في الدليل وفي الأسئلة الشائعة. */
  it('ورسومُ أبشر مصدرُها واحد', () => {
    expect(ABSHER_FEES.walletActivation).toBe(402)
    expect(ABSHER_FEES.transfer).toBe(230)
  })
})
