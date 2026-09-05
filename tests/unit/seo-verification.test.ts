import { describe, expect, it } from 'vitest'
import { extractToken } from '@/components/admin/seo-settings-form'

/**
 * جوجل تعطي **الوسم كاملًا** لا الرمز وحده.
 *
 * ومن ينسخه كما هو — وهو ما يفعله الجميع — كان يُخزَّن عنده الوسم بأكمله في
 * موضع المحتوى، فيخرج في الصفحة وسمًا داخل وسم فيفشل التحقّق بلا أن يُقال له
 * لماذا. فيُستخرج الرمز من الوسم بدل أن يُطلب من الناشر أن يستخرجه بنفسه.
 */
describe('رمز التحقّق من جوجل', () => {
  it('يُستخرج من الوسم كاملًا بأي نوع اقتباس', () => {
    expect(extractToken('<meta name="google-site-verification" content="Abc-123_xyz" />')).toBe(
      'Abc-123_xyz',
    )
    expect(extractToken("<meta name='google-site-verification' content='Abc123'>")).toBe('Abc123')
  })

  it('ويُقبل وحده كما هو', () => {
    expect(extractToken('  Abc-123_xyz  ')).toBe('Abc-123_xyz')
    expect(extractToken('')).toBe('')
  })
})
