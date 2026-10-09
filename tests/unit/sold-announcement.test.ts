import { beforeEach, describe, expect, it } from 'vitest'
import {
  muteNextSoldToast,
  resetSoldAnnouncementsForTests,
  shouldAnnounceSold,
  SELF_WINDOW_MS,
} from '@/lib/sold-announcement'

/**
 * **من سبّب البيع لا يُخبَر به — وغيرُه يُخبَر.**
 *
 * وقد وقع العكس على شاشة مستخدم: ضغط «اشترِ الآن» فنُقل إلى صفحة السداد،
 * فلحقته نافذةٌ تقول «تمّت الصفقة» — ولم يكن دفع بعد. فظنّ أنّه دفع.
 *
 * **والفحصُ هنا لا في المتصفّح.** فجُرّب في Playwright: يُرفع الكتمُ كلُّه
 * فيمرّ الفحص — لأنّ المشتري يغادر الصفحة قبل أن يصل الحدثُ على الحلقة
 * المحلّية، فلا نافذةَ تظهر أصلًا. فحارسٌ يُقاس بسباقٍ لا يُضبط ليس حارسًا.
 */
describe('إعلانُ البيع لمن يشاهد لا لمن فعل', () => {
  beforeEach(resetSoldAnnouncementsForTests)

  it('بلا علامةٍ يُعلَن — فالمشاهدُ يُخبَر', () => {
    expect(shouldAnnounceSold('lst_1')).toBe(true)
  })

  it('ومن علّم تبويبَه لا يُعلَن له', () => {
    muteNextSoldToast('lst_1')
    expect(shouldAnnounceSold('lst_1')).toBe(false)
  })

  it('والعلامةُ تُستهلك مرّةً — فلا تكتم بيعًا ثانيًا', () => {
    muteNextSoldToast('lst_1')
    expect(shouldAnnounceSold('lst_1')).toBe(false)
    expect(shouldAnnounceSold('lst_1'), 'كُتم بيعٌ ثانٍ بعلامةٍ استُهلكت').toBe(true)
  })

  it('ولا تكتم لوحةً أخرى', () => {
    muteNextSoldToast('lst_1')
    expect(shouldAnnounceSold('lst_2')).toBe(true)
  })

  /*
   * فطلبٌ ينجح في الخادم ثمّ ينقطع اتّصالُه يترك علامةً لا يستهلكها حدث.
   * ولولا المهلةُ لكتمت إعلانًا حقيقيًّا بعد ساعةٍ من بيعٍ لغير صاحبها.
   */
  it('وتسقط بعد نافذتها فلا تتسرّب إلى بيعٍ لاحق', () => {
    const at = 1_000_000
    muteNextSoldToast('lst_1', at)
    expect(shouldAnnounceSold('lst_1', at + SELF_WINDOW_MS + 1)).toBe(true)
  })

  it('وداخلَ نافذتها تكتم', () => {
    const at = 1_000_000
    muteNextSoldToast('lst_1', at)
    expect(shouldAnnounceSold('lst_1', at + SELF_WINDOW_MS - 1)).toBe(false)
  })
})
