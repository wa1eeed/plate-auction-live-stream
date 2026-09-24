import { contentTypeOf, type MediaDriver } from './driver'
import { isPublicKey, isSafeKey } from './keys'
import { presignUrl, sha256Hex, signRequest, UNSIGNED_PAYLOAD, type SigningCredentials } from './sigv4'

export type R2Config = {
  accountId: string
  /** حاويةُ ما تحت `platform/` — هي التي يُربط بها النطاق العامّ */
  bucket: string
  /**
   * حاويةُ ما تحت `users-files/` — **ولا نطاقَ يُربط بها**.
   *
   * وفصلُها حاويةً مستقلّة ليس ترتيبًا: **ربطُ نطاقٍ مخصّص بحاوية R2 يجعلها
   * كلَّها مقروءةً علنًا عبره** — لا البادئة التي تختارها. فلو سكنت وثائقُ
   * المستخدمين حاويةَ البنرات لصار `cdn.…/users-files/usr_1/proof.pdf`
   * مفتوحًا لمن بلغه، بلا جلسةٍ ولا أثر — ويسقط الفصلُ كلُّه.
   *
   * و`null` تعني أنّها لم تُضبط، فتُستعمل حاويةُ البنرات — وهو مقبولٌ ما لم
   * يُربط نطاقٌ عامّ، ويُمنع إن رُبط. انظر `assertPrivateIsolation`.
   */
  privateBucket: string | null
  accessKeyId: string
  secretAccessKey: string
  /** نطاقُ التقديم العامّ — `https://cdn.mazad.nx.sa` بلا شرطةٍ في آخره */
  publicBaseUrl: string | null
}

/**
 * يرفض الضبطَ الذي يكشف وثائق المستخدمين.
 *
 * نطاقٌ عامٌّ مربوطٌ بحاويةٍ تسكنها `users-files/` = كشفٌ صامت. ويُرمى هنا
 * لا يُسجَّل تحذيرًا: تحذيرٌ في سجلٍّ لا يقرؤه أحد لا يمنع تسريبًا.
 */
export function assertPrivateIsolation(config: Pick<R2Config, 'bucket' | 'privateBucket' | 'publicBaseUrl'>): void {
  if (!config.publicBaseUrl) return
  if (config.privateBucket && config.privateBucket !== config.bucket) return
  throw new Error(
    'R2_PUBLIC_BASE_URL مضبوطٌ بلا R2_PRIVATE_BUCKET مستقلّة — ' +
      'والنطاق المخصّص يجعل الحاوية كلَّها علنيّة، فتنكشف ملفّات المستخدمين. ' +
      'أنشئ حاويةً ثانيةً بلا نطاق واضبط R2_PRIVATE_BUCKET عليها.',
  )
}

/**
 * محرّك Cloudflare R2 — عبر واجهة S3 وتوقيع SigV4.
 *
 * والمنطقة `auto` والخدمة `s3`: R2 لا مناطق فيه، لكنّ الصيغة تشترط اسمًا في
 * نطاق الاعتماد — و`auto` هو ما يقبله.
 */
export function r2Driver(config: R2Config): MediaDriver {
  const credentials: SigningCredentials = {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    region: 'auto',
    service: 's3',
  }

  assertPrivateIsolation(config)

  /** الحاوية تُختار **بالبادئة**: العامّ في حاويته، والخاصّ في حاويته. */
  const bucketOf = (key: string): string =>
    isPublicKey(key) ? config.bucket : (config.privateBucket ?? config.bucket)

  const endpoint = (key: string): URL => {
    if (!isSafeKey(key)) throw new Error('مفتاح غير صالح')
    return new URL(`https://${config.accountId}.r2.cloudflarestorage.com/${bucketOf(key)}/${key}`)
  }

  return {
    kind: 'r2',

    async put(key, bytes, contentType) {
      const url = endpoint(key)
      /*
       * تجزئةُ الجسم تُحسب ولا تُترك `UNSIGNED-PAYLOAD`.
       *
       * التوقيع حينئذٍ يشمل ما رُفع: بايتاتٌ بُدِّلت في الطريق تُردّ من R2
       * نفسه. والملفّات هنا ميغاباياتٌ معدودة، فالحساب لا يُذكر.
       */
      const headers = signRequest({
        credentials,
        method: 'PUT',
        url,
        headers: { 'content-type': contentType, 'content-length': String(bytes.byteLength) },
        payloadHash: sha256Hex(bytes),
      })

      /*
       * `ArrayBuffer` صراحةً لا `Uint8Array`.
       *
       * تعريفات TypeScript الحديثة تجعل `Uint8Array` قد يستند إلى مخزنٍ
       * مشترك (`ArrayBufferLike`)، و`BodyInit` لا تقبله. والنسخُ هنا يقطع
       * الاشتراك ويعطي مخزنًا خالصًا — وهو الفخّ نفسه الذي وقع في
       * `applicationServerKey` بمفتاح الدفع.
       */
      const body = bytes.slice().buffer as ArrayBuffer
      const response = await fetch(url, { method: 'PUT', headers, body })
      if (!response.ok) {
        throw new Error(`تعذّر رفع الملفّ إلى R2 (${response.status})`)
      }
    },

    async remove(key) {
      const url = endpoint(key)
      const headers = signRequest({
        credentials,
        method: 'DELETE',
        url,
        headers: {},
        payloadHash: sha256Hex(''),
      })
      const response = await fetch(url, { method: 'DELETE', headers })
      // 404 ليس خطأً: الحذف يُطلب بعد فشلٍ جزئيّ فيجد ما لم يُكتب
      if (!response.ok && response.status !== 404) {
        throw new Error(`تعذّر حذف الملفّ من R2 (${response.status})`)
      }
    },

    async read(key) {
      const url = endpoint(key)
      const headers = signRequest({
        credentials,
        method: 'GET',
        url,
        headers: {},
        payloadHash: UNSIGNED_PAYLOAD,
      })
      const response = await fetch(url, { headers })
      if (!response.ok) return null
      return {
        bytes: new Uint8Array(await response.arrayBuffer()),
        contentType: response.headers.get('content-type') ?? contentTypeOf(key),
      }
    },

    publicUrl(key) {
      if (!isSafeKey(key)) throw new Error('مفتاح غير صالح')
      /*
       * بلا نطاقٍ عامٍّ مضبوط يُقدَّم من التطبيق.
       *
       * وهو **مخرجٌ لا خيار**: كلُّ بايت فدّيو يمرّ حينئذٍ بالخادم، ووصلةٌ
       * طويلة لكلّ مشاهد تزاحم ما تحتاجه المزايدة اللحظية. فيُضبط
       * `R2_PUBLIC_BASE_URL` في الإنتاج، ويبقى هذا لنشرةٍ لم يُربط نطاقها بعد.
       */
      return config.publicBaseUrl ? `${config.publicBaseUrl}/${key}` : `/api/media/${key}`
    },

    async signedUrl(key, expiresInSeconds) {
      return presignUrl({
        credentials,
        method: 'GET',
        url: endpoint(key),
        expiresInSeconds,
      })
    },
  }
}
