import { generateKeyPairSync } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sendFcm } from '@/lib/server/fcm'
import { TIME_SENSITIVE_NOTIFICATIONS, URGENT_NOTIFICATIONS } from '@/lib/domain/types'

/**
 * الإشعارات التي تخترق وضع التركيز.
 *
 * وخطرُها ليس في الكود بل في **التوسّع**: يُضاف نوعٌ اليوم وآخرُ غدًا، حتى
 * يصير كلُّ شيءٍ عاجلًا — فيُطفئ صاحبُ الجهاز التصنيف كلَّه من إعداداته،
 * ويخسر الثلاثة التي كانت تستحقّ. فالحدُّ هنا مقصود.
 */

describe('إشعاراتٌ تخترق وضع التركيز', () => {
  it('ثلاثةٌ لا أكثر — وزيادتُها قرارٌ يُراجَع لا سطرٌ يُضاف', () => {
    expect(TIME_SENSITIVE_NOTIFICATIONS).toEqual(['outbid', 'payment_due_soon', 'payment_overdue'])
  })

  it('وكلُّها ممّا يُدفَع أصلًا — ونوعٌ لا يُدفَع لا يخترق شيئًا', () => {
    for (const type of TIME_SENSITIVE_NOTIFICATIONS) {
      expect(URGENT_NOTIFICATIONS, `«${type}» يخترق التركيز ولا يُدفَع أصلًا`).toContain(type)
    }
  })

  it('أضيقُ من العاجل — وإلّا فلا معنى للتمييز', () => {
    expect(TIME_SENSITIVE_NOTIFICATIONS.length).toBeLessThan(URGENT_NOTIFICATIONS.length)
  })

  it('المعيار: خسارةٌ خلال دقائق — لا مجرّد خبرٍ مهمّ', () => {
    /*
     * هذه وقعت ولا تُردّ: إشعارٌ بها لا يُلحّ لأنّ صاحبه لا يملك تصرّفًا.
     * وهي أقربُ ما يُغري بالإضافة، فتُحرس صراحةً.
     */
    for (const past of ['deposit_forfeited', 'order_defaulted', 'auction_lost', 'auction_won']) {
      expect(TIME_SENSITIVE_NOTIFICATIONS, `«${past}» أمرٌ وقع ولا يُردّ`).not.toContain(past)
    }
  })

  it('والاستحقاق موجودٌ في iOS — وبدونه تُتجاهَل بلا خطأ', () => {
    const entitlements = readFileSync(
      join(__dirname, '..', '..', 'ios/App/App/App.entitlements'),
      'utf8',
    )
    expect(entitlements).toContain('com.apple.developer.usernotifications.time-sensitive')
    expect(entitlements).toContain('aps-environment')
  })
})

describe('الحمولة المرسَلة إلى أبل', () => {
  /**
   * الثابت في الكود لا يكفي: ما يصل أبل هو **ما في الحمولة**. فتُلتقط
   * المكالمة الشبكية ويُقرأ ما فيها — لا يُفترض أنّه ما نويناه.
   */
  const KEY = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  }).privateKey

  let sent: Record<string, unknown> | null = null

  beforeEach(() => {
    sent = null
    process.env.FCM_PROJECT_ID = 'plate-test'
    process.env.FCM_CLIENT_EMAIL = 'ci@plate-test.iam.gserviceaccount.com'
    process.env.FCM_PRIVATE_KEY = KEY.replace(/\n/g, '\\n')

    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      if (String(url).includes('oauth2')) {
        return new Response(JSON.stringify({ access_token: 'tkn', expires_in: 3600 }), {
          status: 200,
        })
      }
      sent = JSON.parse(String(init?.body))
      return new Response('{}', { status: 200 })
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.FCM_PROJECT_ID
    delete process.env.FCM_CLIENT_EMAIL
    delete process.env.FCM_PRIVATE_KEY
  })

  const aps = () =>
    ((sent as { message?: { apns?: { payload?: { aps?: Record<string, unknown> } } } })?.message
      ?.apns?.payload?.aps ?? {}) as Record<string, unknown>

  it('العاجل يحمل `interruption-level` في حمولة APNs', async () => {
    const result = await sendFcm('token', {
      title: 'تجاوزك أحد',
      body: '…',
      href: '/market/x',
      tag: 'outbid',
      badge: 3,
      timeSensitive: true,
    })
    expect(result).toBe('sent')
    expect(aps()['interruption-level']).toBe('time-sensitive')
  })

  it('وغيرُه لا يحمله — ولا يُرسَل الحقل فارغًا', async () => {
    await sendFcm('token', {
      title: 'رُست عليك',
      body: '…',
      href: null,
      tag: 'auction_won',
      badge: 1,
    })
    expect(aps()).not.toHaveProperty('interruption-level')
    /* وبقيّة الحمولة كما كانت — الإضافة لا تُزحزح شيئًا */
    expect(aps().badge).toBe(1)
    expect(aps()['content-available']).toBe(1)
  })

  it('ولا مبلغ ولا رقم لوحةٍ في الحمولة — هنا كما في الويب', async () => {
    await sendFcm('token', {
      title: 'تجاوزك أحد',
      body: 'أعلى مزايدة الآن',
      href: '/market/x',
      tag: 'outbid',
      badge: 1,
      timeSensitive: true,
    })
    expect(JSON.stringify(sent)).not.toMatch(/\d{4,}/)
  })
})
