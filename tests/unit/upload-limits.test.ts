import { describe, expect, it } from 'vitest'
import {
  limitFor,
  MAX_UPLOAD_BYTES,
  PROXY_MAX_BYTES,
  uploadRejection,
  UPLOAD_LIMITS,
} from '@/lib/domain/upload-limits'
import { ALLOWED_MEDIA } from '@/lib/server/media/keys'

const MB = 1024 * 1024

/**
 * **الملفُّ يُفحص في المتصفّح قبل الإرسال — لا بعد أن تُقطع الوصلة.**
 *
 * الخادم يردّ `413` على ترويسة `content-length` **قبل أن يقرأ الجسم**، وهو
 * الصواب: لا يُستهلك مئةُ ميغابايت في ذاكرته لِيُردّ. لكنّه يغلق الوصلةَ
 * والمتصفّحُ ما زال يضخّ، فيُجهَض الطلب — `ECONNRESET` في سجلّ الخادم،
 * و`ERR_TIMED_OUT` في المتصفّح، **ولا تصل رسالةٌ إلى أحد**. فتُقرأ «تعذّر
 * الاتّصال بالخادم» والشبكةُ سليمة.
 *
 * وقد وقع هذا فعلًا على الإنتاج، ومرّتين: مرّةً قبل أن يكون فحصٌ أصلًا،
 * ومرّةً بعد فحصٍ يقيس بالنوع وحده — فمرّ نوعٌ مجهول بلا قياس.
 */
describe('ما يُردّ قبل الإرسال', () => {
  it('ما دون الحدّ يمرّ', () => {
    expect(uploadRejection('image/png', 4 * MB)).toBeNull()
    expect(uploadRejection('video/mp4', 1024)).toBeNull()
  })

  it('وما فوقه يُردّ برسالةٍ فيها الرقمان — بالميغابايت لا بالبايت', () => {
    const message = uploadRejection('video/mp4', 250 * MB)
    expect(message).toContain('250')
    expect(message).toContain('200')
    expect(message).not.toMatch(/\d{7,}/)
  })

  /*
   * فدّيو الآيفون يخرج `video/quicktime`. وكان يُردّ بصيغته، فصار مقبولًا
   * بحدّ الفدّيو نفسِه — **وحاويتُه حاويةُ MP4**، فالفحص بالبايتات يقبلهما.
   */
  it('و`video/quicktime` مقبولٌ بحدّ الفدّيو — لا يُردّ بصيغته', () => {
    expect(limitFor('video/quicktime')).toBe(limitFor('video/mp4'))
    expect(uploadRejection('video/quicktime', 150 * MB)).toBeNull()
    expect(uploadRejection('video/quicktime', 250 * MB)).toMatch(/250/)
  })

  it('وبايتٌ واحدٌ فوق الحدّ تجاوزٌ — فالحدُّ حدٌّ', () => {
    expect(uploadRejection('image/png', 4 * MB + 1)).not.toBeNull()
  })

  /*
   * **الثغرة التي أسقطت الرفع على الإنتاج.**
   *
   * فدّيو الآيفون يأتي `video/quicktime` لا `video/mp4`. وكان النوعُ المجهول
   * يُعاد منه `null` بلا قياسِ حجم — فيمرّ ملفٌّ بمئة ميغابايت إلى الشبكة،
   * فيردّ الخادم `413` قبل القراءة، فتُقطع الوصلة قبل أن يصل الردّ.
   *
   * ولو سقط هذا الفحص لعاد العطبُ نفسُه حرفًا.
   */
  it('ونوعٌ مجهولٌ **ضخم** يُردّ بالحجم — لا يمرّ بحجّة أنّا لا نعرف نوعه', () => {
    const message = uploadRejection('video/x-matroska', 250 * MB)
    expect(message).not.toBeNull()
    expect(message).toContain('250')
    expect(message).toContain('200')
  })

  it('ونوعٌ مجهولٌ صغيرٌ يُردّ بالصيغة — ولا يُرفع ليُقال له «غير مدعوم»', () => {
    const message = uploadRejection('image/heic', 1 * MB)
    expect(message).toMatch(/صيغة/)
    expect(message).toContain('image/heic')
  })

  it('وملفٌّ بلا نوعٍ معلنٍ يُردّ كذلك — ولا تُطبع أقواسٌ فارغة', () => {
    const message = uploadRejection('', 1024)
    expect(message).toMatch(/صيغة/)
    expect(message).not.toContain('()')
  })

  it('وأكبرُ حدٍّ هو أعلى ما في الجدول', () => {
    expect(MAX_UPLOAD_BYTES).toBe(Math.max(...Object.values(UPLOAD_LIMITS)))
    expect(limitFor('video/x-matroska')).toBeNull()
  })

  /*
   * **سقفان لا سقف — والخلطُ بينهما يقتل الحاوية.**
   *
   * الرفعُ المباشر لا يحمل شيئًا في ذاكرة الخادم، فسقفُه سقفُ المخزن.
   * والرفعُ عبر الخادم يقرأ الملفّ كلَّه، فسقفُه سقفُ الذاكرة. ولو ساويناهما
   * لَقرأ مسلكُ الرجوع مئتَي ميغابايت إلى ذاكرة حاويةٍ صغيرة.
   */
  it('وسقفُ الرفع عبر الخادم أدنى من سقف المخزن — ولا يُساوى به', () => {
    expect(PROXY_MAX_BYTES).toBeLessThan(MAX_UPLOAD_BYTES)
    /* ويسع أكبرَ صورة، فمسلكُ الرجوع يبقى صالحًا لما يُرفع عادةً */
    expect(PROXY_MAX_BYTES).toBeGreaterThanOrEqual(UPLOAD_LIMITS['image/jpeg'])
  })

  /*
   * حدٌّ في المتصفّح يخالف حدَّ الخادم أسوأ من لا حدّ: يَعِد بقبولٍ يُردّ،
   * أو يردُّ ما كان يُقبل.
   */
  it('ولكلّ نوعٍ مسموحٍ في الخادم حدٌّ هنا — ولا نوعَ زائد', () => {
    expect(Object.keys(UPLOAD_LIMITS).sort()).toEqual(Object.keys(ALLOWED_MEDIA).sort())
  })
})
