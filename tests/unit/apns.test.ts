import { createPublicKey, generateKeyPairSync, verify } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * القناة المباشرة إلى APNs.
 *
 * وما يُراد إثباتُه هنا لا يظهر بقراءة الكود: صيغةُ التوقيع، وما في الترويسات،
 * وما في الحمولة. فتُلتقط الجلسة ويُقرأ ما أُرسل فعلًا.
 */

const KEYS = generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
})

type Captured = { headers: Record<string, string>; body: string }
let captured: Captured | null = null
let replyStatus = 200
let replyBody = ''

/** جلسة HTTP/2 مقلَّدة — تلتقط ما يُرسل وتردّ ما يُملى عليها. */
function stubHttp2() {
  vi.doMock('node:http2', async () => {
    const actual = await vi.importActual<typeof import('node:http2')>('node:http2')
    return {
      ...actual,
      connect: () => ({
        closed: false,
        destroyed: false,
        on: () => undefined,
        unref: () => undefined,
        request: (headers: Record<string, string>) => {
          const handlers: Record<string, (arg?: unknown) => void> = {}
          return {
            setEncoding: () => undefined,
            setTimeout: () => undefined,
            close: () => undefined,
            on: (event: string, handler: (arg?: unknown) => void) => {
              handlers[event] = handler
            },
            end: (body: string) => {
              captured = { headers, body }
              queueMicrotask(() => {
                handlers.response?.({ ':status': replyStatus })
                if (replyBody) handlers.data?.(replyBody)
                handlers.end?.()
              })
            },
          }
        },
      }),
    }
  })
}

async function load() {
  vi.resetModules()
  stubHttp2()
  return import('@/lib/server/apns')
}

describe('APNs مباشرةً', () => {
  beforeEach(() => {
    captured = null
    replyStatus = 200
    replyBody = ''
    process.env.APNS_KEY_ID = 'ABC1234567'
    process.env.APNS_TEAM_ID = 'U9V3HL7NKQ'
    process.env.APNS_KEY_P8 = KEYS.privateKey.replace(/\n/g, '\\n')
  })

  afterEach(() => {
    vi.doUnmock('node:http2')
    delete process.env.APNS_KEY_ID
    delete process.env.APNS_TEAM_ID
    delete process.env.APNS_KEY_P8
    delete process.env.APNS_BUNDLE_ID
  })

  const message = {
    title: 'تجاوزك أحد',
    body: 'ارفع مزايدتك',
    href: '/market/abc',
    tag: 'outbid',
    badge: 4,
  }

  it('لا يُرسل بلا مفتاح — ولا يرمي', async () => {
    delete process.env.APNS_KEY_P8
    const { sendApns, apnsConfigured } = await load()
    expect(apnsConfigured()).toBe(false)
    expect(await sendApns('tok', message)).toBe('failed')
  })

  it('التوقيع ES256 خامٌّ لا ASN.1 — وإلّا ردّته أبل بلا بيان', async () => {
    const { sendApns } = await load()
    await sendApns('devicetoken', message)

    const jwt = captured!.headers.authorization.replace('bearer ', '')
    const [header, claims, signature] = jwt.split('.')

    expect(JSON.parse(Buffer.from(header, 'base64url').toString())).toEqual({
      alg: 'ES256',
      kid: 'ABC1234567',
    })
    expect(JSON.parse(Buffer.from(claims, 'base64url').toString()).iss).toBe('U9V3HL7NKQ')

    /* ستّون بايتًا (R‖S) — وASN.1 تُخرج غيرها */
    const raw = Buffer.from(signature, 'base64url')
    expect(raw.length).toBe(64)

    /* ويُتحقّق منه بالمفتاح العامّ — لا بطوله وحده */
    const valid = verify(
      'sha256',
      Buffer.from(`${header}.${claims}`),
      { key: createPublicKey(KEYS.publicKey), dsaEncoding: 'ieee-p1363' },
      raw,
    )
    expect(valid, 'التوقيع لا يُتحقّق منه').toBe(true)
  })

  it('الترويسات كما تشترطها أبل', async () => {
    const { sendApns } = await load()
    await sendApns('devicetoken', message)
    const h = captured!.headers

    expect(h[':path']).toBe('/3/device/devicetoken')
    expect(h['apns-topic']).toBe('sa.nx.mazad')
    expect(h['apns-push-type']).toBe('alert')
    expect(h['apns-priority']).toBe('10')
    expect(h['apns-collapse-id']).toBe('outbid')
    expect(Number(h['apns-expiration'])).toBeGreaterThan(Math.floor(Date.now() / 1000))
  })

  it('الحمولة تحمل العنوان والشارة والوجهة — ولا مبلغ فيها', async () => {
    const { sendApns } = await load()
    await sendApns('devicetoken', { ...message, timeSensitive: true })
    const body = JSON.parse(captured!.body)

    expect(body.aps.alert).toEqual({ title: 'تجاوزك أحد', body: 'ارفع مزايدتك' })
    expect(body.aps.badge).toBe(4)
    expect(body.aps['interruption-level']).toBe('time-sensitive')
    expect(body.href).toBe('/market/abc')
    /* الحمولة تعبر شبكةً عامّة — لا رقم لوحةٍ ولا مبلغ */
    expect(captured!.body).not.toMatch(/\d{4,}/)
  })

  it('وغيرُ العاجل بلا مستوى مقاطعة', async () => {
    const { sendApns } = await load()
    await sendApns('devicetoken', message)
    expect(JSON.parse(captured!.body).aps).not.toHaveProperty('interruption-level')
  })

  it('410 يعني رمزًا ميّتًا — وحده والمصرَّح به', async () => {
    const { sendApns } = await load()
    replyStatus = 410
    expect(await sendApns('dead', message)).toBe('gone')
  })

  it('400 بـBadDeviceToken كذلك — و400 عامّة لا', async () => {
    const { sendApns } = await load()
    replyStatus = 400
    replyBody = '{"reason":"BadDeviceToken"}'
    expect(await sendApns('bad', message)).toBe('gone')

    replyBody = '{"reason":"PayloadTooLarge"}'
    expect(await sendApns('ok', message), 'حمولةٌ مرفوضة تُفقدنا الجهاز').toBe('failed')
  })

  it('الموضوع يُضبط من البيئة إن خالف الافتراضيّ', async () => {
    process.env.APNS_BUNDLE_ID = 'sa.nx.other'
    const { sendApns } = await load()
    await sendApns('devicetoken', message)
    expect(captured!.headers['apns-topic']).toBe('sa.nx.other')
  })
})
