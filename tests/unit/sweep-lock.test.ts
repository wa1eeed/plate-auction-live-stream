import { describe, expect, it } from 'vitest'
import { closeDb, isPostgresConfigured, LOCKS, withAdvisoryLock } from '@/lib/store/pg/client'

/**
 * القفل الاستشاريّ — ما يمنع ماسحين من إنشاء صفقتين لمزادٍ واحد.
 *
 * وما يُراد إثباتُه هنا لا يظهر إلّا على قاعدة: القفل فيها هي، لا في العملية.
 */
const when = isPostgresConfigured() ? describe : describe.skip

when('قفل المسح', () => {
  it('واحدٌ يظفر به والآخر يُردّ — لا ينتظر ولا يُخطئ', async () => {
    let inside = 0
    let maxInside = 0
    const results: Array<string | null> = []

    const work = (name: string) =>
      withAdvisoryLock(LOCKS.sweep, async () => {
        inside += 1
        maxInside = Math.max(maxInside, inside)
        // نافذةٌ يتسلّل منها الثاني لو لم يكن القفل يحرس
        await new Promise((r) => setTimeout(r, 120))
        inside -= 1
        return name
      })

    results.push(...(await Promise.all([work('أ'), work('ب')])))

    // أحدهما عمل والآخر رُدّ بـ`null` — ولم يجتمعا في الداخل قطّ
    expect(maxInside, 'دخل اثنان معًا — القفل لا يحرس').toBe(1)
    expect(results.filter((r) => r !== null)).toHaveLength(1)
    expect(results.filter((r) => r === null)).toHaveLength(1)
  })

  it('يُفكّ بعد الانتهاء فيمرّ التالي', async () => {
    const first = await withAdvisoryLock(LOCKS.sweep, async () => 'أوّل')
    const second = await withAdvisoryLock(LOCKS.sweep, async () => 'ثانٍ')
    expect([first, second]).toEqual(['أوّل', 'ثانٍ'])
  })

  it('يُفكّ ولو سقط العمل — وإلّا توقّف المسح إلى الأبد', async () => {
    await expect(
      withAdvisoryLock(LOCKS.sweep, async () => {
        throw new Error('سقوطٌ متعمَّد')
      }),
    ).rejects.toThrow('سقوطٌ متعمَّد')

    // لو بقي مقفولًا لعاد هذا `null`
    expect(await withAdvisoryLock(LOCKS.sweep, async () => 'بعده')).toBe('بعده')
  })

  it('لا يترك اتّصالًا محجوزًا في المَجمع', async () => {
    // عشرُ دوراتٍ متتابعة — ومجمعٌ افتراضيّه عشرة يجفّ لو لم يُعَد الاتّصال
    for (let i = 0; i < 12; i += 1) {
      await withAdvisoryLock(LOCKS.sweep, async () => i)
    }
    expect(await withAdvisoryLock(LOCKS.sweep, async () => 'حيّ')).toBe('حيّ')
    await closeDb()
  })
})
