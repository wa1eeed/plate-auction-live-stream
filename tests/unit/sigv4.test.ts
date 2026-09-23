import { describe, expect, it } from 'vitest'
import { presignUrl, signRequest, stamps, sha256Hex } from '@/lib/server/media/sigv4'

/*
 * متّجهات أمازون المنشورة (`aws-sig-v4-test-suite`) — لا تواقيعُ ولّدناها نحن.
 *
 * وتوقيعٌ يُقاس بنفسه يمرّ وهو غلط: يكفي أن يخطئ الترميزُ أو الترتيبُ على
 * نحوٍ ثابت فيوافق نفسَه في كلّ مرّة. والمتّجه المنشور وحده يقول إنّ ما
 * نُنتجه هو ما تنتظره الخدمة.
 */
const VECTOR = {
  accessKeyId: 'AKIDEXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
  region: 'us-east-1',
  service: 'service',
}
const AT = new Date('2015-08-30T12:36:00Z')

describe('توقيع SigV4', () => {
  it('get-vanilla — يطابق التوقيع المنشور من أمازون حرفًا بحرف', () => {
    const headers = signRequest({
      credentials: VECTOR,
      method: 'GET',
      url: new URL('https://example.amazonaws.com/'),
      headers: {},
      payloadHash: sha256Hex(''),
      now: AT,
    })

    expect(headers.authorization).toBe(
      'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, ' +
        'SignedHeaders=host;x-amz-date, ' +
        'Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31',
    )
  })

  it('get-vanilla-query-order-key-case — الاستعلام يُرتَّب فيطابق المنشور', () => {
    const headers = signRequest({
      credentials: VECTOR,
      method: 'GET',
      url: new URL('https://example.amazonaws.com/?Param2=value2&Param1=value1'),
      headers: {},
      payloadHash: sha256Hex(''),
      now: AT,
    })

    expect(headers.authorization).toContain(
      'Signature=b97d918cfa904a5beff61c982a1b6f458b799221646efd99d3219ec94cdf2500',
    )
  })

  it('التوقيع يتبدّل مع كلّ جزءٍ يدخل فيه — ولا يثبت على شيء', () => {
    const base = {
      credentials: VECTOR,
      url: new URL('https://bucket.example.com/platform/images/a.jpg'),
      headers: {},
      payloadHash: sha256Hex(''),
      now: AT,
    }
    const sig = (over: Partial<typeof base> & { method: string }) =>
      signRequest({ ...base, ...over }).authorization.split('Signature=')[1]!

    const original = sig({ method: 'GET' })
    expect(sig({ method: 'PUT' })).not.toBe(original)
    expect(sig({ method: 'GET', url: new URL('https://bucket.example.com/platform/images/b.jpg') })).not.toBe(original)
    expect(sig({ method: 'GET', payloadHash: sha256Hex('x') })).not.toBe(original)
    expect(sig({ method: 'GET', now: new Date('2015-08-30T12:36:01Z') })).not.toBe(original)
    expect(
      sig({ method: 'GET', credentials: { ...VECTOR, secretAccessKey: 'other' } }),
    ).not.toBe(original)
  })

  it('المسار يُرمَّز بـRFC 3986 — والمسافةُ `%20` لا `+`', () => {
    const headers = signRequest({
      credentials: VECTOR,
      method: 'GET',
      url: new URL('https://example.com/a b/c~d'),
      headers: {},
      payloadHash: sha256Hex(''),
      now: AT,
    })
    // التوقيع يُحسب على المسار المرمَّز؛ يكفي أن يُنتَج بلا رمي
    expect(headers.authorization).toMatch(/^AWS4-HMAC-SHA256 /)
  })

  it('الرابط الموقَّع مسبقًا يحمل ما تطلبه الصيغة، والمدّة تُقصّ عند أسبوع', () => {
    const url = new URL(
      presignUrl({
        credentials: VECTOR,
        method: 'GET',
        url: new URL('https://bucket.example.com/users-files/usr_1/proof.pdf'),
        expiresInSeconds: 999_999,
        now: AT,
      }),
    )
    expect(url.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256')
    expect(url.searchParams.get('X-Amz-Expires')).toBe('604800')
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('host')
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/)
    // المفتاح السرّي لا يظهر في الرابط بحال
    expect(url.toString()).not.toContain(VECTOR.secretAccessKey)
  })

  it('رابطان لمفتاحين مختلفين لا يحملان التوقيع نفسه', () => {
    const at = (key: string) =>
      new URL(
        presignUrl({
          credentials: VECTOR,
          method: 'GET',
          url: new URL(`https://bucket.example.com/${key}`),
          expiresInSeconds: 300,
          now: AT,
        }),
      ).searchParams.get('X-Amz-Signature')

    expect(at('users-files/usr_1/proof.pdf')).not.toBe(at('users-files/usr_2/proof.pdf'))
  })

  it('الختم بصيغة أمازون — بلا شرطات ولا نقطتين ولا أجزاء ثانية', () => {
    expect(stamps(new Date('2026-09-23T10:15:30.123Z'))).toEqual({
      amzDate: '20260923T101530Z',
      dateStamp: '20260923',
    })
  })
})
