import { createSign } from 'node:crypto'

/**
 * إرسال الدفع الأصيل عبر FCM HTTP v1 — قناةٌ واحدة لأندرويد و iOS معًا.
 *
 * ولماذا FCM لآبل أيضًا بدل APNs مباشرةً؟ لأنّ APNs يقتضي اتّصال HTTP/2
 * بشهادةٍ أو مفتاحٍ موقَّع، ومسارَ أخطاءٍ وصيغةَ حمولةٍ مستقلّة — أي **قناة
 * ثانية كاملة** تُبنى وتُراقَب وتُصان. و FCM يحمل إلى آبل نيابةً عنّا متى
 * رُفع مفتاح APNs في مشروع Firebase، فيبقى في الخادم بابٌ واحد.
 *
 * والثمن تبعيّةٌ لطرفٍ ثالث في مسار الإشعار — وهي قائمةٌ أصلًا: دفعُ الويب
 * يمرّ بخادم صانع المتصفّح كذلك. ولذلك **لا تحمل الحمولة مبلغًا ولا شيئًا
 * محجوبًا**، هنا كما هناك.
 */

type ServiceAccount = { projectId: string; clientEmail: string; privateKey: string }

/*
 * المفتاح من البيئة وحدها.
 *
 * وهو مفتاحٌ خاصّ يوقّع باسم المشروع كلّه: من ملكه أرسل إشعارًا إلى كلّ جهازٍ
 * مسجَّل. فلا يُكتب في الكود ولا يُسجَّل في مخرجات، ولا يُعاد في أيّ استجابة.
 */
function serviceAccount(): ServiceAccount | null {
  const projectId = process.env.FCM_PROJECT_ID?.trim()
  const clientEmail = process.env.FCM_CLIENT_EMAIL?.trim()
  /* المفاتيح تُلصق في البيئة بأسطرٍ مهروبة `\n` — تُعاد إلى أسطرها */
  const privateKey = process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, '\n').trim()
  if (!projectId || !clientEmail || !privateKey) return null
  return { projectId, clientEmail, privateKey }
}

export function fcmConfigured(): boolean {
  return serviceAccount() !== null
}

const base64Url = (input: Buffer | string) =>
  Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

/** رمزٌ صالحٌ ساعةً، يُخزَّن ويُجدَّد قبل انتهائه بدقيقة. */
let cachedToken: { value: string; expiresAt: number } | null = null

async function accessToken(account: ServiceAccount): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000)
  if (cachedToken && cachedToken.expiresAt > now + 60) return cachedToken.value

  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64Url(
    JSON.stringify({
      iss: account.clientEmail,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  )

  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${claims}`)
  const signature = base64Url(signer.sign(account.privateKey))

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${signature}`,
    }),
  })
  if (!response.ok) return null

  const data = (await response.json()) as { access_token?: string; expires_in?: number }
  if (!data.access_token) return null

  cachedToken = { value: data.access_token, expiresAt: now + (data.expires_in ?? 3600) }
  return cachedToken.value
}

export type FcmMessage = {
  title: string
  body: string
  href: string | null
  tag: string
  /**
   * رقم الشارة على أيقونة التطبيق — لـiOS وحده.
   *
   * آبل لا تحسبه من الإشعارات الواصلة: تعرض ما يُرسَل إليها حرفيًّا. والخادم
   * وحده يعرف كم غير مقروء، فيُحسب عند الإرسال ويُرسَل معه.
   *
   * وأندرويد لا يحتاجه: النظام يضع نقطةً على الأيقونة من الإشعارات القائمة.
   */
  badge: number
  /**
   * يخترق وضع التركيز — لثلاثة أنواعٍ وحدها، انظر
   * `TIME_SENSITIVE_NOTIFICATIONS`.
   */
  timeSensitive?: boolean
}

/** نتيجةٌ تُفرّق بين الفشل العابر والرمز الميّت — والثاني وحده يُحذف صاحبه. */
export type FcmResult = 'sent' | 'failed' | 'gone'

export async function sendFcm(token: string, message: FcmMessage): Promise<FcmResult> {
  const account = serviceAccount()
  if (!account) return 'failed'

  const bearer = await accessToken(account).catch(() => null)
  if (!bearer) return 'failed'

  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${account.projectId}/messages:send`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: message.title, body: message.body },
          /* الوجهة في `data` لا في `notification` — تُقرأ عند الضغط */
          data: { href: message.href ?? '/account', tag: message.tag },
          android: {
            priority: 'HIGH',
            notification: {
              /* وسمٌ لكلّ نوع: الثاني يحلّ محلّ الأوّل ولا يتراكمان */
              tag: message.tag,
              default_sound: true,
            },
          },
          apns: {
            headers: { 'apns-priority': '10', 'apns-collapse-id': message.tag.slice(0, 64) },
            payload: {
              aps: {
                sound: 'default',
                badge: message.badge,
                /* يُوقظ التطبيق ليُحدّث الشارة من الخادم عند الاستلام */
                'content-available': 1,
                /*
                 * `time-sensitive` تخترق وضع التركيز و«عدم الإزعاج».
                 *
                 * والافتراضيّ `active` يُكتم فيهما — فإشعارُ «تجاوزك أحد»
                 * لا يصل صاحبه إلّا بعد أن ينتهي المزاد.
                 *
                 * وتُرسَل لثلاثة أنواعٍ وحدها: توسيعُها يُفقدها معناها،
                 * فيُطفئها صاحبها كلَّها ويخسر الثلاثة معها.
                 */
                ...(message.timeSensitive ? { 'interruption-level': 'time-sensitive' } : {}),
              },
            },
          },
        },
      }),
    },
  ).catch(() => null)

  if (!response) return 'failed'
  if (response.ok) return 'sent'

  /*
   * الرمز الميّت يُعرف بنصّه لا برمز الحالة وحده.
   *
   * 404 تعني «لا رسالة» عند FCM أحيانًا، و`UNREGISTERED` هو ما يقول إنّ
   * الجهاز حُذف عنه التطبيق أو بُدّل رمزه. وحذفُ الجهاز على 400 عام خطأ:
   * حمولةٌ مرفوضة تُفقدنا كلّ الأجهزة.
   */
  const text = await response.text().catch(() => '')
  if (/UNREGISTERED|NOT_FOUND|InvalidRegistration/i.test(text)) return 'gone'
  return 'failed'
}
