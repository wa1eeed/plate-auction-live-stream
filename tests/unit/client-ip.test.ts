import { describe, expect, it } from 'vitest'
import { clientIp } from '@/lib/server/client-ip'

const h = (init: Record<string, string>) => new Headers(init)

describe('عنوان الزائر من خلف وكيل', () => {
  it('كلاودفلير أوّلًا — فهو الأقرب إلى الزائر إن وُجد', () => {
    expect(
      clientIp(h({ 'cf-connecting-ip': '1.1.1.1', 'x-forwarded-for': '9.9.9.9' })),
    ).toBe('1.1.1.1')
  })

  it('وإلّا فأوّل عنوانٍ في `x-forwarded-for` — وهو الزائر، وما بعده وكلاء', () => {
    expect(clientIp(h({ 'x-forwarded-for': '2.2.2.2, 10.0.0.1, 10.0.0.2' }))).toBe('2.2.2.2')
  })

  it('يتخطّى ترويسةً فارغة إلى التي بعدها', () => {
    expect(clientIp(h({ 'x-forwarded-for': '  ', 'x-real-ip': '3.3.3.3' }))).toBe('3.3.3.3')
  })

  it('بلا ترويسة: ثابتٌ واحد لا عشوائيّ — والعشوائيّ يُلغي الحدّ', () => {
    expect(clientIp(h({}))).toBe('unknown')
    expect(clientIp(h({}))).toBe(clientIp(h({})))
  })
})
