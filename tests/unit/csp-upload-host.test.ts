import { afterEach, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '@/middleware'

const policyFor = (): string => {
  const response = middleware(new NextRequest('https://mazad.nx.sa/admin/home'))
  return response.headers.get('content-security-policy') ?? ''
}
const directive = (policy: string, name: string): string =>
  policy.split(';').map((part) => part.trim()).find((part) => part.startsWith(name + ' ')) ?? ''

/**
 * **السياسةُ تعرف مضيفَ الرفع — وإلّا حُجب الرفعُ كلُّه بلا رسالة.**
 *
 * لوحةُ الإدارة ترفع **مباشرةً** إلى واجهة R2، وهي مضيفٌ غيرُ مضيف التقديم
 * (`cdn.…`). و`connect-src` لا تعرفه تحجب الطلبَ في المتصفّح: لا يبلغ
 * الشبكةَ أصلًا، ولا يظهر في سجلّ الخادم، ولا يُقرأ منه إلّا سطرٌ في
 * طرفيّة المطوّر لا يراه أحد.
 */
describe('سياسةُ المحتوى ومضيفُ الرفع', () => {
  const saved = { ...process.env }
  afterEach(() => {
    process.env = { ...saved }
  })

  it('بلا معرّف حساب تبقى السياسة على ضيقها — ولا مضيفَ زائد', () => {
    delete process.env.R2_ACCOUNT_ID
    expect(directive(policyFor(), 'connect-src')).toBe("connect-src 'self' ws: wss:")
  })

  it('وبمعرّفٍ صحيح يُذكر مضيفُ R2 وحده', () => {
    process.env.R2_ACCOUNT_ID = 'a'.repeat(32)
    const connect = directive(policyFor(), 'connect-src')
    expect(connect).toContain(`https://${'a'.repeat(32)}.r2.cloudflarestorage.com`)
    /* ولا يُفتح البابُ على مصراعيه */
    expect(connect).not.toContain('*')
    expect(connect).not.toMatch(/https:(?!\/\/)/)
  })

  /*
   * **الحارس الذي يمنع كسرَ السياسة بقيمةٍ من البيئة.**
   *
   * قيمةٌ فيها مسافةٌ أو فاصلةٌ منقوطة لا تُضيف مضيفًا — بل **تُنهي التوجيه
   * وتفتح ما بعده**. فمعرّفٌ مثل `x; script-src *` يُبطل السياسةَ كلَّها،
   * ومن ضبط المتغيّرات قد يلصق قيمةً فيها فراغٌ بلا أن ينتبه.
   */
  it('ومعرّفٌ لا يطابق الشكل يُهمل — ولا يُحقن في السياسة', () => {
    for (const bad of ['x; script-src *', 'a'.repeat(31), 'a'.repeat(33), 'zz' + 'a'.repeat(30), '', '  ']) {
      process.env.R2_ACCOUNT_ID = bad
      const policy = policyFor()
      expect(directive(policy, 'connect-src'), bad).toBe("connect-src 'self' ws: wss:")
      /* والسياسةُ تبقى بعدد توجيهاتها لم يُقحم فيها توجيهٌ جديد */
      expect(policy, bad).not.toContain('script-src *')
    }
  })
})
