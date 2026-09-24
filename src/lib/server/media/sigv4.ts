import { createHash, createHmac } from 'node:crypto'

/**
 * توقيع AWS SigV4 — ما يفهمه R2 وكلُّ متجرٍ متوافقٍ مع S3.
 *
 * **ولماذا يُكتب ولا يُستورَد؟** `@aws-sdk/client-s3` عشرةُ ميغابايت وعشراتُ
 * حزمٍ متعدّية لأجل أربع عمليات: ضَعْ، واحذِف، ووقِّع رابطًا، واقرأ. والمنصّة
 * تُسقط بناءها على `pnpm audit --prod` — فكلُّ حزمةٍ تدخل الإنتاج سطحُ خطرٍ
 * يُحرَس إلى الأبد. وهذا الملفّ مئةُ سطرٍ تُقاس بمتّجهات آبل... بل بمتّجهات
 * أمازون المنشورة، وهي في `sigv4.test.ts`.
 */

const ALGORITHM = 'AWS4-HMAC-SHA256'
/** جسمٌ غير موقَّعٍ المحتوى — R2 يقبلها في الروابط الموقَّعة مسبقًا */
export const UNSIGNED_PAYLOAD = 'UNSIGNED-PAYLOAD'

export type SigningCredentials = {
  accessKeyId: string
  secretAccessKey: string
  region: string
  service: string
}

function sha256Hex(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex')
}

function hmac(key: Uint8Array | string, value: string): Buffer {
  return createHmac('sha256', key).update(value, 'utf8').digest()
}

/**
 * ترميزُ المسار — وهو موضعُ أكثر الأخطاء في التواقيع اليدوية.
 *
 * `encodeURIComponent` تترك `!'()*` بلا ترميز وتُرمّز ما لا يُرمَّز، وأمازون
 * تطلب RFC 3986 حرفًا بحرف. وحرفٌ واحدٌ يفترق يعني توقيعًا صحيح الشكل
 * يُردّ بـ`SignatureDoesNotMatch` بلا بيانٍ لِمَ.
 */
function uriEncode(value: string, encodeSlash: boolean): string {
  let out = ''
  for (const char of value) {
    if (/[A-Za-z0-9\-._~]/.test(char)) {
      out += char
    } else if (char === '/') {
      out += encodeSlash ? '%2F' : '/'
    } else {
      for (const byte of Buffer.from(char, 'utf8')) {
        out += `%${byte.toString(16).toUpperCase().padStart(2, '0')}`
      }
    }
  }
  return out
}

/** `20260923T101530Z` و`20260923` — الصيغتان اللتان تطلبهما أمازون. */
export function stamps(now: Date): { amzDate: string; dateStamp: string } {
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  return { amzDate, dateStamp: amzDate.slice(0, 8) }
}

function signingKey(credentials: SigningCredentials, dateStamp: string): Buffer {
  const date = hmac(`AWS4${credentials.secretAccessKey}`, dateStamp)
  const region = hmac(date, credentials.region)
  const service = hmac(region, credentials.service)
  return hmac(service, 'aws4_request')
}

function credentialScope(credentials: SigningCredentials, dateStamp: string): string {
  return `${dateStamp}/${credentials.region}/${credentials.service}/aws4_request`
}

/** الترويسات تُرتَّب باسمها المخفَّض وتُقلَّص فراغاتها — كما تطلب الصيغة. */
function canonicalHeaders(headers: Record<string, string>): {
  canonical: string
  signed: string
} {
  const entries = Object.entries(headers)
    .map(([name, value]) => [name.toLowerCase().trim(), value.trim().replace(/\s+/g, ' ')] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))

  return {
    canonical: entries.map(([name, value]) => `${name}:${value}\n`).join(''),
    signed: entries.map(([name]) => name).join(';'),
  }
}

function canonicalQuery(query: Record<string, string>): string {
  return Object.entries(query)
    .map(([key, value]) => [uriEncode(key, true), uriEncode(value, true)] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')
}

function signature(
  credentials: SigningCredentials,
  amzDate: string,
  dateStamp: string,
  canonicalRequest: string,
): string {
  const toSign = [
    ALGORITHM,
    amzDate,
    credentialScope(credentials, dateStamp),
    sha256Hex(canonicalRequest),
  ].join('\n')
  return createHmac('sha256', signingKey(credentials, dateStamp)).update(toSign, 'utf8').digest('hex')
}

/**
 * يوقّع طلبًا بترويسة `Authorization` — للرفع والحذف من الخادم.
 *
 * ويُعاد `headers` جاهزةً لـ`fetch`، فالمستدعي لا يعرف شيئًا عن الصيغة.
 */
export function signRequest(input: {
  credentials: SigningCredentials
  method: string
  url: URL
  headers: Record<string, string>
  /** تجزئةُ الجسم — `UNSIGNED_PAYLOAD` أو sha256 بالسدس عشري */
  payloadHash: string
  now?: Date
}): Record<string, string> {
  const { credentials, method, url, payloadHash } = input
  const { amzDate, dateStamp } = stamps(input.now ?? new Date())

  /*
   * `x-amz-content-sha256` ليست هنا — **يمرّرها المستدعي في `headers`**.
   *
   * وهي شرطٌ في S3 لا في الصيغة، ولو أُضيفت هنا لَما أمكن قياسُ هذا الملفّ
   * بمتّجهات أمازون المنشورة: متّجه `get-vanilla` يوقّع `host` و`x-amz-date`
   * وحدهما، فترويسةٌ زائدة تُغيّر التوقيع فيبقى الفحص يقيس شكل النصّ لا صحّة
   * الحساب.
   *
   * ⚠ وكان هذا التعليق يقول «يضيفها `r2.ts`» — **ولم يكن يضيفها**. عقدٌ كُتب
   * ولم يُنفَّذ، فلم تُرسل ولم تُوقَّع، فردّ R2 بـ403 على كلّ طلبٍ موقَّع.
   * فمن وقّع من هنا فعليه أن يضمّها إلى `headers` بنفسه — وتلك مسؤوليّة
   * المستدعي لأنّها شرطُ S3 لا شرطُ SigV4.
   */
  const headers: Record<string, string> = {
    ...input.headers,
    host: url.host,
    'x-amz-date': amzDate,
  }

  const { canonical, signed } = canonicalHeaders(headers)
  const query: Record<string, string> = {}
  url.searchParams.forEach((value, key) => {
    query[key] = value
  })

  const canonicalRequest = [
    method.toUpperCase(),
    uriEncode(url.pathname, false),
    canonicalQuery(query),
    canonical,
    signed,
    payloadHash,
  ].join('\n')

  const sig = signature(credentials, amzDate, dateStamp, canonicalRequest)
  return {
    ...headers,
    authorization:
      `${ALGORITHM} Credential=${credentials.accessKeyId}/${credentialScope(credentials, dateStamp)}, ` +
      `SignedHeaders=${signed}, Signature=${sig}`,
  }
}

/**
 * رابطٌ موقَّعٌ مسبقًا — يُسلَّم للمتصفّح فيقرأ به مباشرةً من R2 بلا مفتاح.
 *
 * والمدّة تُحسب من لحظة التوقيع، ولا تتجاوز أسبوعًا بحدّ الصيغة نفسها.
 */
export function presignUrl(input: {
  credentials: SigningCredentials
  method: string
  url: URL
  expiresInSeconds: number
  now?: Date
}): string {
  const { credentials, method, expiresInSeconds } = input
  const { amzDate, dateStamp } = stamps(input.now ?? new Date())
  const url = new URL(input.url.toString())

  const headers = { host: url.host }
  const { canonical, signed } = canonicalHeaders(headers)

  url.searchParams.set('X-Amz-Algorithm', ALGORITHM)
  url.searchParams.set('X-Amz-Credential', `${credentials.accessKeyId}/${credentialScope(credentials, dateStamp)}`)
  url.searchParams.set('X-Amz-Date', amzDate)
  url.searchParams.set('X-Amz-Expires', String(Math.min(Math.max(expiresInSeconds, 1), 604_800)))
  url.searchParams.set('X-Amz-SignedHeaders', signed)

  const query: Record<string, string> = {}
  url.searchParams.forEach((value, key) => {
    query[key] = value
  })

  const canonicalRequest = [
    method.toUpperCase(),
    uriEncode(url.pathname, false),
    canonicalQuery(query),
    canonical,
    signed,
    UNSIGNED_PAYLOAD,
  ].join('\n')

  url.searchParams.set('X-Amz-Signature', signature(credentials, amzDate, dateStamp, canonicalRequest))
  return url.toString()
}

export { sha256Hex }
