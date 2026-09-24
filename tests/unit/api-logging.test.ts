import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ZodError } from 'zod'
import { handleError, resetLogThrottleForTests } from '@/lib/server/api'
import { ServiceError } from '@/lib/server/market-service'

/**
 * **سجلُّ الإنتاج كان صامتًا — ثمّ كاد يغرق.**
 *
 * `handleError` كان يسجّل في التطوير وحده، فعطلُ إنتاجٍ لا يخلّف سطرًا واحدًا
 * ويُشخَّص بالحدس. ولمّا رُفع الكتم غرقت البوّابةُ في رسالةٍ واحدة تتكرّر كلَّ
 * خمس ثوان — لأنّ المسحَ الدوريّ يطلب مسارًا داخليًّا بهذا الإيقاع. فالغرضان
 * يتنازعان، وهذا الفحص يحرسهما معًا: أن يُقال، وأن لا يُقال ألفَ مرّة.
 */
describe('سجلُّ أخطاء الواجهة البرمجية', () => {
  let lines: string[] = []
  let spy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    lines = []
    resetLogThrottleForTests()
    spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      lines.push(args.map(String).join(' '))
    })
  })
  afterEach(() => {
    spy.mockRestore()
    vi.useRealTimers()
    resetLogThrottleForTests()
  })

  it('ما لم نتوقّعه يُسجَّل — ولو كنّا في الإنتاج', () => {
    handleError(new Error('انكسر شيءٌ في المحرّك'))
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('انكسر شيءٌ في المحرّك')
  })

  /*
   * **الحارس الذي يمنع غرق السجلّ.**
   *
   * ولو سقط لكتب المسحُ الدوريّ سبعةَ عشرَ ألفَ سطرٍ في اليوم من رسالةٍ
   * واحدة — فيُدفن تحتها السطرُ الذي جاء الإصلاحُ ليُظهره.
   */
  it('والمكرَّرُ يُكتب مرّةً لا ستَّ عشرةَ في الدقيقة', () => {
    for (let i = 0; i < 16; i += 1) handleError(new Error('المسح: لا اتّصال بالقاعدة'))
    expect(lines).toHaveLength(1)
  })

  it('وبعد انقضاء النافذة يعود — ومعه عددُ ما كُتم', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-24T00:00:00Z'))
    for (let i = 0; i < 5; i += 1) handleError(new Error('عطلٌ متكرّر'))
    expect(lines).toHaveLength(1)

    vi.setSystemTime(new Date('2026-09-24T00:01:30Z'))
    handleError(new Error('عطلٌ متكرّر'))
    expect(lines).toHaveLength(2)
    expect(lines[1]).toMatch(/كُتم 4/)
  })

  it('ورسالتان مختلفتان لا تكتم إحداهما الأخرى', () => {
    handleError(new Error('الأولى'))
    handleError(new Error('الثانية'))
    expect(lines).toHaveLength(2)
  })

  /*
   * `ServiceError` و`ZodError` نتائجُ محكومة يقرؤها العميل في الردّ — و401
   * لكلّ زائرٍ غيرِ مسجَّل تُغرق السجلَّ بما لا يُصلَح.
   */
  it('والمحكومُ لا يُسجَّل — لا 401 ولا خطأُ تحقّق', () => {
    handleError(new ServiceError('يجب تسجيل الدخول', 401, 'NOT_AUTHENTICATED'))
    handleError(new ZodError([]))
    expect(lines).toHaveLength(0)
  })

  it('والروابط تُحجب — فلا يسكن السجلَّ رابطُ اتّصالٍ ولا توقيعٌ موقَّت', () => {
    handleError(new Error('تعذّر الاتّصال بـ postgres://user:pw@db:5432/app'))
    expect(lines[0]).not.toContain('pw')
    expect(lines[0]).toContain('‹رابط محجوب›')
  })
})
