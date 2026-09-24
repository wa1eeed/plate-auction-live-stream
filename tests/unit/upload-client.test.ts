import { afterEach, describe, expect, it, vi } from 'vitest'
import { uploadMedia, UploadError } from '@/lib/client/upload-media'

const file = (bytes: number, type: string) =>
  ({ size: bytes, type, name: 'x' }) as unknown as File

/**
 * **رسالةٌ واحدة كانت تعلو كلَّ عطل** — «تعذّر الاتّصال بالخادم».
 *
 * وكانت تكذب في أكثر الأحوال: `response.json()` كان يُستدعى قبل فحص `ok`،
 * فأيُّ ردٍّ غيرِ JSON (504 بصفحة HTML، أو جسمٌ فارغ) يرمي في التحليل فيقع
 * في `catch` فيُقرأ انقطاعَ شبكة. فصار الجسمُ يُقرأ نصًّا، والحالةُ تُذكر،
 * ولا تُقال «تعذّر الاتّصال» إلّا حين لا يصل ردٌّ أصلًا.
 */
describe('رفعُ الوسائط من المتصفّح', () => {
  const realFetch = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = realFetch
  })

  it('ما مرّ يُعاد مفتاحُه', async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ key: 'platform/images/a.png', width: 1200, height: 600 }), {
        status: 200,
      })) as typeof fetch
    expect((await uploadMedia(file(1024, 'image/png'), 'banner')).key).toBe('platform/images/a.png')
  })

  it('ورسالةُ الخادم تُعرض كما هي — لا تُستبدل برسالةٍ عامّة', async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: { message: 'نسبة الصورة 1.00:1، والمطلوب 2:1' } }), {
        status: 422,
      })) as typeof fetch
    await expect(uploadMedia(file(1024, 'image/png'), 'banner')).rejects.toThrow(/2:1/)
  })

  /*
   * **الحارس الذي يمنع عودةَ العطب الأصليّ.**
   *
   * ردٌّ غيرُ JSON كان يرمي في التحليل فيُقرأ انقطاعًا. والآن تُذكر حالتُه.
   */
  it('وردٌّ غيرُ JSON يُقال بحالته — لا انقطاعَ شبكةٍ موهومًا', async () => {
    globalThis.fetch = (async () =>
      new Response('<html>504 Gateway Timeout</html>', { status: 504 })) as typeof fetch
    let message = ''
    await uploadMedia(file(1024, 'image/png'), 'banner').catch((e: Error) => {
      message = e.message
    })
    expect(message).toContain('504')
    expect(message).not.toContain('تعذّر الاتّصال بالخادم')
  })

  /*
   * **وصلةٌ تموت لا تُخلّف حالةً ولا جسمًا** — والمتصفّح يرمي `TypeError`
   * مجرَّدًا لكلّ سبب. فالزمنُ والحجمُ هما ما يفرّق: ثانيةٌ رفضٌ فوريّ،
   * وستّون مهلةُ بوّابة، وستُّمئة ملفٌّ أكبر من أن يصعد.
   */
  it('وسقوطُ الشبكة يُقال اتّصالًا — ومعه الزمنُ والحجم', async () => {
    globalThis.fetch = (async () => {
      throw new TypeError('Failed to fetch')
    }) as typeof fetch

    let message = ''
    await uploadMedia(file(3 * 1024 * 1024, 'image/png'), 'banner').catch((e: Error) => {
      message = e.message
    })

    expect(message).toContain('تعذّر الاتّصال بالخادم')
    expect(message).toMatch(/\d+ ثانية/)
    expect(message).toContain('3 ميغابايت')
  })

  /*
   * والفحصُ قبل الإرسال يسبق كلَّ شبكة: الخادم يردّ `413` على ترويسة الحجم
   * قبل قراءة الجسم فتُقطع الوصلة بلا رسالةٍ تصل — فلا يُرسل أصلًا.
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
