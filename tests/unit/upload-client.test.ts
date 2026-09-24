import { afterEach, describe, expect, it, vi } from 'vitest'
import { uploadMedia, UploadError } from '@/lib/client/upload-media'

const file = (bytes: number, type: string) =>
  ({ size: bytes, type, name: 'x' }) as unknown as File

/**
 * **لكلّ ساقٍ رسالتُها — والخلطُ بينها هو ما أضاع يومًا كاملًا.**
 *
 * الرفعُ ثلاثُ ساقين إلى خادمنا وواحدةٌ عابرةُ أصلٍ إلى R2. وطلبٌ تحجبه CORS
 * **يُرفض في المتصفّح قبل أن يغادر**: لا حالةَ ولا جسم، و`fetch` يرمي
 * `TypeError` مجرَّدًا — وهو بعينه شكلُ انقطاع الشبكة. فلو قُرئا واحدًا
 * لَقيل «تعذّر الاتّصال بالخادم» والخادمُ لم يُسأل، وقاعدةُ الحاوية هي المانع.
 */
describe('رسائلُ الرفع — كلُّ ساقٍ تُسمّي موضعَها', () => {
  const realFetch = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = realFetch
  })

  /** يردّ توقيعًا سليمًا، ويترك سلوكَ الرفع المباشر للمستدعي. */
  function stub(onPut: () => Promise<Response>) {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/admin/media/sign')) {
        return new Response(JSON.stringify({ key: 'staging/a.mp4', url: 'https://acc.r2.cloudflarestorage.com/b/staging/a.mp4?X-Amz-Signature=x' }), { status: 200 })
      }
      if (url.includes('/api/admin/media/confirm')) {
        return new Response(JSON.stringify({ key: 'platform/videos/a.mp4', width: null, height: null }), { status: 200 })
      }
      return onPut()
    }) as typeof fetch
  }

  it('حجبُ CORS يُسمّى باسمه — لا «تعذّر الاتّصال بالخادم»', async () => {
    stub(async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(uploadMedia(file(1024, 'video/mp4'), 'story')).rejects.toThrow(/CORS/)
    await expect(uploadMedia(file(1024, 'video/mp4'), 'story')).rejects.not.toThrow(
      /تعذّر الاتّصال بالخادم/,
    )
  })

  it('و403 من المخزن تُقال رفضًا لا انقطاعًا', async () => {
    stub(async () => new Response('', { status: 403 }))
    await expect(uploadMedia(file(1024, 'video/mp4'), 'story')).rejects.toThrow(/403/)
  })

  it('وسقوطُ خادمنا نفسِه يُقال اتّصالًا — فهو المقصود هناك', async () => {
    globalThis.fetch = (async () => {
      throw new TypeError('Failed to fetch')
    }) as typeof fetch
    await expect(uploadMedia(file(1024, 'video/mp4'), 'story')).rejects.toThrow(
      /تعذّر الاتّصال بالخادم/,
    )
  })

  it('وما مرّ يُعاد مفتاحُه من التأكيد لا من التوقيع', async () => {
    stub(async () => new Response('', { status: 200 }))
    const result = await uploadMedia(file(1024, 'video/mp4'), 'story')
    expect(result.key).toBe('platform/videos/a.mp4')
  })

  /*
   * والفحصُ قبل الإرسال يسبق كلَّ شبكة: ملفٌّ فوق الحدّ لا يُوقَّع له رابط
   * ولا يُفتح له اتّصال.
   */
  it('وملفٌّ فوق الحدّ يُردّ بلا طلبٍ واحد', async () => {
    const calls = vi.fn()
    globalThis.fetch = (async () => {
      calls()
      return new Response('', { status: 200 })
    }) as typeof fetch
    await expect(uploadMedia(file(400 * 1024 * 1024, 'video/mp4'), 'story')).rejects.toThrow(
      UploadError,
    )
    expect(calls).not.toHaveBeenCalled()
  })
})
