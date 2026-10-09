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
   * **ونصُّ القاعدة يبقى في السجلّ ولا يبلغ الشاشة.**
   *
   * وقد بلغها: مزايدٌ في الإنتاج ضغط «زايد» فظهرت فوق صفحة المزاد نافذةٌ
   * فيها عبارةُ الإدراج بأسماء الجداول والأعمدة، ومعرّفاتُ الصفّ والمستخدم
   * والإعلان، والمبلغُ بالهللات. خريطةُ المخطَّط لمن يقرؤها، ورعبٌ لمن لا
   * يقرؤها. وتوثيقُ `handleError` كان يَعِد بغير ذلك.
   */
  it('نصُّ خطأ القاعدة يُسجَّل ولا يُرسَل', async () => {
    const raw =
      'Failed query: insert into "deposits" ("id", "reference", "listing_id", "user_id", ' +
      '"amount", "status") values ($1, $2, $3, $4, $5, $6) params: dep_01aa94a99698, ' +
      'D26-00015, lst_c5c65fa80d87, usr_39ffe6f4b261, 500000, held'

    const response = handleError(new Error(raw))
    const body = (await response.json()) as { error: { message: string; code: string } }

    expect(response.status).toBe(500)
    expect(body.error.code).toBe('INTERNAL')
    for (const leak of ['deposits', 'insert into', 'params', 'usr_', 'lst_', 'dep_', '$1', '500000']) {
      expect(body.error.message, `تسرّب «${leak}» إلى الشاشة`).not.toContain(leak)
    }

    /* ويبقى كاملًا في السجلّ — فالكتمُ عن المستخدم لا عن من يُصلح */
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('insert into "deposits"')
  })

  /*
   * **ورمزٌ يصل الشاشةَ بالسجلّ.**
   *
   * فجملةٌ عامّةٌ وحدها تُعمي الدعم: «ما عمل معي» لا يُشخَّص. والرمزُ يُعرض
   * ويُكتب معًا، فيُبحث عنه في السجلّ فيُقرأ العطبُ بعينه.
   */
  it('ورمزُ العطل في الرسالة هو نفسُه في السطر', async () => {
    const response = handleError(new Error('انكسر شيءٌ في المحرّك'))
    const body = (await response.json()) as { error: { message: string } }

    const code = body.error.message.match(/\b([0-9a-f]{8})\b/)?.[1]
    expect(code, 'لا رمزَ في الرسالة').toBeDefined()
    expect(lines[0], 'الرمزُ ليس في السطر').toContain(code!)
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
