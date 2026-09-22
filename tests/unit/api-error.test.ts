import { describe, expect, it } from 'vitest'
import {
  classifyStatus,
  classifyThrown,
  FAILURE_TEXT,
  isSafeToRetry,
  type ApiFailure,
} from '@/lib/api-error'

describe('تصنيف أخطاء الطلبات', () => {
  it('لكلّ سببٍ نصُّه — ولا نصَّ فارغًا', () => {
    for (const [failure, text] of Object.entries(FAILURE_TEXT)) {
      expect(text.length, `«${failure}» بلا نصّ`).toBeGreaterThan(10)
    }
  })

  it('رموز الحالة تُصنَّف كلٌّ إلى بابه', () => {
    expect(classifyStatus(401)).toBe('unauthorized')
    expect(classifyStatus(403)).toBe('forbidden')
    expect(classifyStatus(409)).toBe('conflict')
    expect(classifyStatus(422)).toBe('validation')
    expect(classifyStatus(429)).toBe('rate_limited')
    expect(classifyStatus(500)).toBe('server')
    expect(classifyStatus(503)).toBe('server')
    expect(classifyStatus(418)).toBe('unknown')
  })

  it('منقطعٌ قبل الإرسال ⇐ offline · ومتّصلٌ ثمّ سقط ⇐ **غير مؤكّد**', () => {
    const thrown = new TypeError('Failed to fetch')
    expect(classifyThrown(thrown, false)).toBe('offline')
    expect(classifyThrown(thrown, true)).toBe('uncertain')
  })

  it('والإجهاض مهلةٌ لا انقطاع', () => {
    expect(classifyThrown(new DOMException('aborted', 'AbortError'), true)).toBe('timeout')
  })

  it('نصّ «غير المؤكّد» لا يقول «فشل» — فقد يكون وقع', () => {
    expect(FAILURE_TEXT.uncertain).not.toMatch(/فشل|لم يتم|تعذّر إرسال/)
  })

  it('لا يُعاد إرسال ما قد يكون وقع', () => {
    /* غير المؤكّد والانقطاع لا يُعادان تلقائيًّا — حتى في القراءات */
    expect(isSafeToRetry('uncertain')).toBe(false)
    expect(isSafeToRetry('offline')).toBe(false)
    expect(isSafeToRetry('unauthorized')).toBe(false)
    expect(isSafeToRetry('conflict')).toBe(false)
    /* وهذه آمنةٌ للقراءات */
    expect(isSafeToRetry('timeout')).toBe(true)
    expect(isSafeToRetry('server')).toBe(true)
  })

  it('كلُّ صنفٍ معرَّفٌ في جدول النصوص', () => {
    const all: ApiFailure[] = [
      'offline', 'uncertain', 'timeout', 'unauthorized', 'forbidden',
      'not_found', 'conflict', 'rate_limited', 'validation', 'server', 'unknown',
    ]
    for (const failure of all) expect(FAILURE_TEXT[failure]).toBeDefined()
    expect(Object.keys(FAILURE_TEXT).length).toBe(all.length)
  })
})
