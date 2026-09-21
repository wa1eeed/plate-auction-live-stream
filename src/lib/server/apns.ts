import { createPrivateKey, sign } from 'node:crypto'
import { connect, constants, type ClientHttp2Session } from 'node:http2'
import type { FcmResult } from './fcm'

/**
 * إرسالٌ مباشر إلى APNs — بلا وسيط.
 *
 * ولماذا لا عبر FCM كأندرويد؟ لأنّ الإضافة على iOS تُعيد **رمز APNs خامًا**
 * (أربعةً وستّين حرفًا ستّ عشريًّا) لا رمزَ تسجيلٍ من FCM — فإرسالُه إلى FCM
 * يُردّ. وكان الكود يفترضهما سواءً، وهو خطأ.
 *
 * وبعد أن تبيّن ذلك صار المباشر أفضل لا أضطرّ:
 *
 * | | عبر FCM | مباشرةً |
 * | --- | --- | --- |
 * | المسار | خادم ← جوجل ← أبل | خادم ← **أبل** |
 * | خصائص APNs | ما تكشفه جوجل | **كلُّها** |
 * | حمولة مستخدمي iOS | تمرّ بطرفٍ ثالث | **لا تمرّ** |
 * | النشاط الحيّ لاحقًا | لا يدعمه | **طريقُه هذا** |
 *
 * ويبقى FCM لأندرويد: الإضافة هناك تستعمله فتُعيد رمزًا صحيحًا.
 */

const HOST = 'https://api.push.apple.com'

type ApnsKey = { keyId: string; teamId: string; privateKey: string; topic: string }

/*
 * المفتاح من البيئة وحدها — وهو يوقّع باسم الفريق كلّه: من ملكه أرسل إشعارًا
 * إلى كلّ جهازٍ في كلّ تطبيقٍ للفريق. فلا يُكتب في كود ولا يُسجَّل في مخرجات.
 */
function apnsKey(): ApnsKey | null {
  const keyId = process.env.APNS_KEY_ID?.trim()
  const teamId = process.env.APNS_TEAM_ID?.trim()
  /* يُلصق في البيئة بأسطرٍ مهروبة `\n` — تُعاد إلى أسطرها */
  const privateKey = process.env.APNS_KEY_P8?.replace(/\\n/g, '\n').trim()
  /* الموضوع هو معرّف الحزمة — ويطابق `appId` في `capacitor.config.ts` */
  const topic = process.env.APNS_BUNDLE_ID?.trim() || 'sa.nx.mazad'
  if (!keyId || !teamId || !privateKey) return null
  return { keyId, teamId, privateKey, topic }
}

export function apnsConfigured(): boolean {
  return apnsKey() !== null
}

const base64Url = (input: Buffer | string) =>
  Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

/**
 * رمزُ الموفّر — يُجدَّد كلّ خمسٍ وأربعين دقيقة.
 *
 * وأبل تردّ رمزًا أقدمَ من ساعة بـ`ExpiredProviderToken`، **وتردّ كذلك من
 * يجدّده أكثر من مرّةٍ كلّ عشرين دقيقة** بـ`TooManyProviderTokenUpdates`.
 * فالنافذة بين الحدّين، والخمس والأربعون وسطُها.
 */
let cachedJwt: { value: string; issuedAt: number } | null = null

function providerToken(key: ApnsKey): string {
  const now = Math.floor(Date.now() / 1000)
  if (cachedJwt && now - cachedJwt.issuedAt < 2_700) return cachedJwt.value

  const header = base64Url(JSON.stringify({ alg: 'ES256', kid: key.keyId }))
  const claims = base64Url(JSON.stringify({ iss: key.teamId, iat: now }))

  /*
   * `ieee-p1363` لا الافتراضيّ `der`.
   *
   * JWT يشترط توقيعًا خامًا (R‖S) بستّين بايت، وعقدة تُخرجه ASN.1 افتراضًا —
   * فيُقبل شكلًا ويُردّ بـ`InvalidProviderToken` بلا بيانٍ للسبب.
   */
  const signature = base64Url(
    sign('sha256', Buffer.from(`${header}.${claims}`), {
      key: createPrivateKey(key.privateKey),
      dsaEncoding: 'ieee-p1363',
    }),
  )

  cachedJwt = { value: `${header}.${claims}.${signature}`, issuedAt: now }
  return cachedJwt.value
}

/**
 * جلسة HTTP/2 واحدة تُعاد على الطلبات.
 *
 * وفتحُ جلسةٍ لكلّ إشعار يضيف مصافحة TLS كاملةً إلى كلّ إرسال — وإشعارُ
 * «تجاوزك أحد» يُرسل إلى مزايدين كثرٍ في ثانيةٍ واحدة.
 */
type Ref = typeof globalThis & { __apnsSession?: ClientHttp2Session }

function session(): ClientHttp2Session {
  const ref = globalThis as Ref
  const existing = ref.__apnsSession
  if (existing && !existing.closed && !existing.destroyed) return existing

  const fresh = connect(HOST)
  /* بلا مستمعٍ للخطأ تُسقط الجلسةُ الساقطة العمليةَ كلَّها */
  fresh.on('error', () => {
    ref.__apnsSession = undefined
  })
  fresh.on('close', () => {
    ref.__apnsSession = undefined
  })
  /* لا تُبقي العملية حيّةً من أجلها */
  fresh.unref()
  ref.__apnsSession = fresh
  return fresh
}

export type ApnsMessage = {
  title: string
  body: string
  href: string | null
  tag: string
  badge: number
  timeSensitive?: boolean
}

export async function sendApns(deviceToken: string, message: ApnsMessage): Promise<FcmResult> {
  const key = apnsKey()
  if (!key) return 'failed'

  let jwt: string
  try {
    jwt = providerToken(key)
  } catch {
    return 'failed'
  }

  const payload = JSON.stringify({
    aps: {
      alert: { title: message.title, body: message.body },
      sound: 'default',
      badge: message.badge,
      /*
       * يُوقظ التطبيق ليُحدّث الشارة من الخادم — كما في قناة أندرويد.
       */
      'content-available': 1,
      ...(message.timeSensitive ? { 'interruption-level': 'time-sensitive' } : {}),
    },
    /* الوجهة خارج `aps` — تُقرأ عند الضغط */
    href: message.href ?? '/account',
    tag: message.tag,
  })

  return new Promise<FcmResult>((resolve) => {
    let settled = false
    const done = (result: FcmResult) => {
      if (!settled) {
        settled = true
        resolve(result)
      }
    }

    let request: ReturnType<ClientHttp2Session['request']>
    try {
      request = session().request({
        [constants.HTTP2_HEADER_METHOD]: 'POST',
        [constants.HTTP2_HEADER_PATH]: `/3/device/${deviceToken}`,
        authorization: `bearer ${jwt}`,
        'apns-topic': key.topic,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        /* وسمٌ لكلّ نوع: الثاني يحلّ محلّ الأوّل ولا يتراكمان */
        'apns-collapse-id': message.tag.slice(0, 64),
        /* ساعةٌ ثمّ يُسقَط: إشعارُ مزادٍ انتهى لا معنى له بعدها */
        'apns-expiration': String(Math.floor(Date.now() / 1000) + 3_600),
        'content-type': 'application/json',
      })
    } catch {
      return done('failed')
    }

    let status = 0
    let text = ''
    request.setEncoding('utf8')
    request.on('response', (headers) => {
      status = Number(headers[constants.HTTP2_HEADER_STATUS] ?? 0)
    })
    request.on('data', (chunk: string) => {
      text += chunk
    })
    request.on('error', () => done('failed'))
    request.on('end', () => {
      if (status === 200) return done('sent')

      /*
       * الرمز الميّت يُعرف بنصّه لا برمز الحالة وحده.
       *
       * 410 قاطعةٌ عند أبل، و400 قد تعني حمولةً مرفوضة — وحذفُ الجهاز عليها
       * عامّةً يُفقدنا كلّ الأجهزة عند خطأ صياغةٍ واحد.
       */
      if (status === 410) return done('gone')
      if (/BadDeviceToken|Unregistered|DeviceTokenNotForTopic/i.test(text)) return done('gone')
      done('failed')
    })

    /* مهلةٌ تمنع طلبًا معلّقًا من حبس الإرسال */
    request.setTimeout(10_000, () => {
      request.close()
      done('failed')
    })

    request.end(payload)
  })
}
