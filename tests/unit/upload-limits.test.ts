import { describe, expect, it } from 'vitest'
import { limitFor, overLimitMessage, UPLOAD_LIMITS } from '@/lib/domain/upload-limits'
import { ALLOWED_MEDIA } from '@/lib/server/media/keys'

/**
 * **الحدُّ يُقاس في المتصفّح قبل الإرسال — لا بعد أن تُقطع الوصلة.**
 *
 * الخادم يردّ `413` على `content-length` **قبل قراءة الجسم**، فيغلق الوصلة
 * والمتصفّح ما زال يرفع. والردُّ لا يبلغ المتصفّحَ رسالةً — يُجهَض `fetch`
 * فيقع في `catch` فيُقرأ «تعذّر الاتّصال بالخادم». فيُطارَد عطلُ شبكةٍ لا
 * وجود له، والعلّةُ ملفٌّ أكبر من الحدّ.
 */
describe('حدودُ الرفع', () => {
  it('ما دون الحدّ يمرّ بلا رسالة', () => {
    expect(overLimitMessage('image/png', 4 * 1024 * 1024)).toBeNull()
    expect(overLimitMessage('video/mp4', 1024)).toBeNull()
  })

  it('وما فوقه يُردّ برسالةٍ فيها الرقمان — بالميغابايت لا بالبايت', () => {
    const message = overLimitMessage('video/mp4', 42 * 1024 * 1024)
    expect(message).toContain('42')
    expect(message).toContain('24')
    /* ولا يُقذف في وجه الرافع رقمٌ بالبايت */
    expect(message).not.toMatch(/\d{7,}/)
  })

  it('وبايتٌ واحدٌ فوق الحدّ تجاوزٌ — فالحدُّ حدٌّ', () => {
    expect(overLimitMessage('image/png', 4 * 1024 * 1024 + 1)).not.toBeNull()
  })

  /*
   * نوعٌ لا نعرفه لا يُردّ في المتصفّح: الخادم يردّه بـ415 برسالةٍ تصل،
   * وليس من شأن هذا الفحص أن يُضاعف قائمةَ السماح في موضعين.
   */
  it('ونوعٌ مجهولٌ يُترك للخادم — لا يُخمَّن له حدّ', () => {
    expect(limitFor('image/heic')).toBeNull()
    expect(overLimitMessage('image/heic', 99 * 1024 * 1024)).toBeNull()
  })

  /*
   * **الحارس الذي يمنع انحراف القائمتين.**
   *
   * حدٌّ في المتصفّح يخالف حدَّ الخادم أسوأ من لا حدّ: يَعِد الرافعَ بقبولٍ
   * يردّه الخادم، أو يردُّ ما كان الخادم يقبله.
   */
  it('ولكلّ نوعٍ مسموحٍ في الخادم حدٌّ هنا — ولا نوعَ زائد', () => {
    expect(Object.keys(UPLOAD_LIMITS).sort()).toEqual(Object.keys(ALLOWED_MEDIA).sort())
  })
})
