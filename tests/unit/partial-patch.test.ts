import { describe, expect, it } from 'vitest'
import { patchOf } from '@/lib/server/api'
import { bannerShape, storyShape } from '@/lib/domain/schemas'

/**
 * **التعديلُ الجزئيُّ يحمل ما أُرسل وحده.**
 *
 * وهذا الفحصُ وُلد من ترقية Zod ٣ إلى ٤: صارت `.partial()` تُطبّق القيمَ
 * الافتراضيّة للمفاتيح الغائبة بعد أن كانت تتركها غائبة. والخدمةُ تدمج ما
 * يصلها على الصفّ — فتعديلُ عنوانِ بنرٍ وحده كان سيُلغي نشرَه ويمسح نافذتَه
 * الزمنيّةَ ويُصفّر ترتيبَه، صامتًا بلا رسالةِ خطأٍ واحدة.
 *
 * **ولا يكشفه فحصُ الأنواع** لأنّ الشكل صحيح، ولا الفحوصُ القائمةُ لأنّ
 * أحدًا منها لا يُعدّل حقلًا واحدًا. فهو هنا.
 */
describe('التعديلُ الجزئيّ', () => {
  it('حقلٌ واحدٌ يُرسَل، وحقلٌ واحدٌ يصل', () => {
    const body = { title: 'عنوانٌ جديد' }
    const input = patchOf(bannerShape.partial().parse(body), body)

    expect(Object.keys(input)).toEqual(['title'])
    /* ولا تُدسّ قيمةٌ افتراضيّةٌ تمسح ما في الصفّ */
    expect('published' in input).toBe(false)
    expect('startsAt' in input).toBe(false)
    expect('sortOrder' in input).toBe(false)
    expect('linkUrl' in input).toBe(false)
  })

  it('وما أُرسل صراحةً يصل ولو كان فراغًا', () => {
    const body = { startsAt: null, published: false }
    const input = patchOf(bannerShape.partial().parse(body), body)

    /* فإلغاءُ النشر وإزالةُ موعدِ البدء قصدٌ لا سهو */
    expect(input).toEqual({ startsAt: null, published: false })
  })

  it('والستوري مثلُه', () => {
    const body = { title: 'ستوري' }
    const input = patchOf(storyShape.partial().parse(body), body)
    expect(Object.keys(input)).toEqual(['title'])
  })

  it('ويُنقّى الحقلُ الدخيلُ قبل أن يُرشَّح', () => {
    const body = { title: 'عنوانٌ جديد', nope: 1 }
    const input = patchOf(bannerShape.partial().parse(body), body)
    expect(input).toEqual({ title: 'عنوانٌ جديد' })
  })

  it('وجسمٌ ليس كائنًا لا يُعدّل شيئًا', () => {
    expect(patchOf({ a: 1 }, null)).toEqual({})
    expect(patchOf({ a: 1 }, 'نصّ')).toEqual({})
  })

  /** **والتحقّقُ يبقى على ما أُرسل** — جزئيٌّ لا يعني بلا فحص. */
  it('وقيمةٌ خاطئةٌ تُردّ ولو كانت وحدها', () => {
    expect(() => bannerShape.partial().parse({ title: 'ع' })).toThrow()
    expect(() => bannerShape.partial().parse({ width: 0 })).toThrow()
  })
})
