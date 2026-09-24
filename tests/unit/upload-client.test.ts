import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { uploadMedia, UploadError } from '@/lib/client/upload-media'

const file = (bytes: number, type: string) =>
  ({ size: bytes, type, name: 'x' }) as unknown as File

/** محاكاةُ `XMLHttpRequest` — تُملي ما يقع بعد `send`. */
class FakeXHR {
  static last: FakeXHR | null = null
  static onSend: ((xhr: FakeXHR) => void) | null = null

  status = 0
  responseText = ''
  timeout = 0
  private readonly own: Record<string, ((event: unknown) => void)[]> = {}
  private readonly up: Record<string, ((event: unknown) => void)[]> = {}

  upload = {
    addEventListener: (type: string, fn: (event: unknown) => void) => {
      ;(this.up[type] ??= []).push(fn)
    },
  }

  addEventListener(type: string, fn: (event: unknown) => void) {
    ;(this.own[type] ??= []).push(fn)
  }
  open() {}
  send() {
    FakeXHR.last = this
    FakeXHR.onSend?.(this)
  }
  fire(type: string) {
    for (const fn of this.own[type] ?? []) fn({})
  }
  progress(loaded: number, total: number) {
    for (const fn of this.up.progress ?? []) fn({ loaded, total, lengthComputable: true })
  }
}

/**
 * **الرفع بـ`XMLHttpRequest` لا `fetch` — والسبب رقمٌ واحد.**
 *
 * `fetch` يرمي `TypeError` مجرَّدًا لكلّ عطلٍ شبكيّ: حجبٌ من إضافةٍ في
 * المتصفّح، أو قطعٌ من وكيلٍ عكسيّ، أو شبكةٌ ماتت. وثلاثتُها تُصلَح بغير ما
 * تُصلَح به الأخرى، ولا يفرّقها إلّا **كم بايتًا غادر الجهاز**:
 *
 *   صفر     → لم يخرج الطلب أصلًا
 *   بعضُه   → خرج ومات في الطريق
 *
 * وقد ضاع يومٌ في التفريق بينهما بالحدس.
 */
describe('رفعُ الوسائط من المتصفّح', () => {
  const realXHR = globalThis.XMLHttpRequest

  beforeEach(() => {
    FakeXHR.last = null
    FakeXHR.onSend = null
    globalThis.XMLHttpRequest = FakeXHR as unknown as typeof XMLHttpRequest
  })
  afterEach(() => {
    globalThis.XMLHttpRequest = realXHR
  })

  it('ما مرّ يُعاد مفتاحُه', async () => {
    FakeXHR.onSend = (xhr) => {
      xhr.status = 200
      xhr.responseText = JSON.stringify({ key: 'platform/images/a.png', width: 1200, height: 600 })
      xhr.fire('load')
    }
    expect((await uploadMedia(file(1024, 'image/png'), 'banner')).key).toBe('platform/images/a.png')
  })

  it('ورسالةُ الخادم تُعرض كما هي — لا تُستبدل برسالةٍ عامّة', async () => {
    FakeXHR.onSend = (xhr) => {
      xhr.status = 422
      xhr.responseText = JSON.stringify({ error: { message: 'نسبة الصورة 1.00:1، والمطلوب 2:1' } })
      xhr.fire('load')
    }
    await expect(uploadMedia(file(1024, 'image/png'), 'banner')).rejects.toThrow(/2:1/)
  })

  it('وردٌّ غيرُ JSON يُقال بحالته — لا انقطاعَ شبكةٍ موهومًا', async () => {
    FakeXHR.onSend = (xhr) => {
      xhr.status = 504
      xhr.responseText = '<html>Gateway Timeout</html>'
      xhr.fire('load')
    }
    await expect(uploadMedia(file(1024, 'image/png'), 'banner')).rejects.toThrow(/504/)
  })

  /*
   * **الحارس الذي يفرّق الحجبَ من الانقطاع.**
   *
   * ولو سقط لَقيل «انقطع الاتّصال» لطلبٍ لم يغادر الجهاز — فيُطارَد العطل
   * في الخادم وهو في إضافةٍ على المتصفّح.
   */
  it('وصفرُ بايت يعني أنّ الطلب لم يغادر المتصفّح — ويُقال ذلك ويُدلّ على النافذة الخاصّة', async () => {
    FakeXHR.onSend = (xhr) => xhr.fire('error')

    let message = ''
    await uploadMedia(file(300_000, 'image/png'), 'banner').catch((e: Error) => {
      message = e.message
    })

    expect(message).toContain('لم يغادر')
    expect(message).toContain('خاصّة')
    expect(message).not.toContain('انقطع الاتّصال بالخادم')
  })

  it('وبعضُه يعني أنّه خرج ومات في الطريق — ومعه الرقمان', async () => {
    FakeXHR.onSend = (xhr) => {
      xhr.progress(1_048_576, 4_194_304)
      xhr.fire('error')
    }

    let message = ''
    await uploadMedia(file(4_194_304, 'image/png'), 'banner').catch((e: Error) => {
      message = e.message
    })

    expect(message).toContain('انقطع الاتّصال')
    expect(message).toContain('أُرسل 1 من 4')
    expect(message).toMatch(/\d+ ثانية/)
  })

  it('وانقضاءُ المهلة يُقال مهلةً لا انقطاعًا', async () => {
    FakeXHR.onSend = (xhr) => xhr.fire('timeout')
    await expect(uploadMedia(file(1024, 'image/png'), 'banner')).rejects.toThrow(/مهلة/)
  })

  it('والتقدّمُ يُبلَّغ كنسبة — فالشريط يتحرّك', async () => {
    const seen: number[] = []
    FakeXHR.onSend = (xhr) => {
      xhr.progress(250, 1000)
      xhr.progress(1000, 1000)
      xhr.status = 200
      xhr.responseText = JSON.stringify({ key: 'platform/images/a.png' })
      xhr.fire('load')
    }
    await uploadMedia(file(1000, 'image/png'), 'banner', (f) => seen.push(f))
    expect(seen).toEqual([0.25, 1])
  })

  it('وملفٌّ فوق الحدّ يُردّ بلا طلبٍ واحد', async () => {
    const sent = vi.fn()
    FakeXHR.onSend = sent
    await expect(uploadMedia(file(400 * 1024 * 1024, 'video/mp4'), 'story')).rejects.toThrow(
      UploadError,
    )
    expect(sent).not.toHaveBeenCalled()
  })
})
