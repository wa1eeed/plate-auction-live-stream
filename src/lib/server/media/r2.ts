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

/*
 * مُهَلُ الشبكة — و`fetch` بلا `signal` **لا سقفَ له**.
 *
 * وأثرُ غيابها ليس بطئًا: طلبٌ معلَّق يمسك مجرى الطلب حتى مهلة undici
 * الداخلية (٣٠٠ ثانية)، والوكيل العكسيّ أمامه ينقطع قبلها بكثير فيردّ 504
 * **بصفحة HTML** — فيقرأ صاحبُ اللوحة «تعذّر الاتّصال بالخادم» ولا يبقى في
 * السجلّ سطرٌ يقول ما وقع. فالسقفُ هنا يجعل العطل يُنطَق لا يُخمَّن.
 */
const PUT_TIMEOUT_MS = 60_000
const META_TIMEOUT_MS = 15_000

/** يطلب من R2 بسقفٍ، ويحوّل «fetch failed» إلى سببٍ يُقرأ. */
async function request(
  what: string,
  url: URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  } catch (error) {
    /*
     * `fetch failed` وحدها لا تدلّ على شيء. والسبب الحقيقيّ في `cause.code`:
     * `ENOTFOUND` معرِّفُ حسابٍ خاطئ، و`ECONNREFUSED` منفذٌ مغلق،
     * و`ConnectTimeoutError` خادمٌ لا يبلغ كلاودفلير أصلًا. وكلُّ واحدةٍ
     * تُصلَح بغير ما تُصلَح به الأخرى.
     */
    const named = error as { name?: string; message?: string; cause?: { code?: string; message?: string } }
    const why =
      named?.name === 'TimeoutError'
        ? `انقضت المهلة بعد ${Math.round(timeoutMs / 1000)} ثانية`
        : (named?.cause?.code ?? named?.cause?.message ?? named?.message ?? 'سببٌ غير معروف')
    throw new Error(`تعذّر ${what} — لم يُبلَغ R2: ${why}`)
  }
}

/**
 * رمزُ الخطأ من جسم R2 — و«403» وحدها لا تقول أيَّ شيء يُصلَح.
 *
 * R2 يردّ XML فيه `<Code>`: `SignatureDoesNotMatch` مفتاحٌ أو سرٌّ خاطئ،
 * و`NoSuchBucket` اسمُ حاويةٍ لا وجود لها، و`AccessDenied` رمزٌ بلا صلاحية
 * الكتابة. ثلاثةُ أعطالٍ تحت رقمٍ واحد، وكلٌّ له إصلاحه.
 */
async function reasonOf(response: Response): Promise<string> {
  try {
    const code = /<Code>([^<]{1,64})<\/Code>/.exec((await response.text()).slice(0, 2048))?.[1]
    return code ? ` ${code}` : ''
  } catch {
    return ''
  }
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

  /**
   * كلُّ طلبٍ يُوقَّع من هنا — **وتجزئةُ الجسم من الترويسات الموقَّعة**.
   *
   * وS3 تشترط `x-amz-content-sha256` مُرسَلةً و**موقَّعة**. وكانت مفقودةً
   * تمامًا: تعليقٌ في `sigv4.ts` يقول إنّ `r2.ts` يضيفها، و`r2.ts` لم يكن
   * يضيفها — عقدٌ كُتب ولم يُنفَّذ، ولا فحصَ يمسكه لأنّ الفحوص كانت تقيس
   * التوقيعَ بنفسه لا بما يقبله R2.
   *
   * وأثرُه أنّ R2 ردّ **403 على كلّ طلبٍ موقَّع**: الرفعُ يرمي، والحذفُ يرمي،
   * **والقراءةُ تردّ `null` صامتةً** فتُقرأ «ملفٌّ غير موجود» لا «رُفض».
   * وقِيس على حاويةٍ حقيقية: بلا توقيعها `403`، وبه `200`.
   */
  const signed = (
    method: string,
    url: URL,
    payloadHash: string,
    extra: Record<string, string> = {},
  ): Record<string, string> =>
    signRequest({
      credentials,
      method,
      url,
      headers: { ...extra, 'x-amz-content-sha256': payloadHash },
      payloadHash,
    })

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
      const headers = signed('PUT', url, sha256Hex(bytes), {
        'content-type': contentType,
        'content-length': String(bytes.byteLength),
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
      const response = await request('رفع الملفّ', url, { method: 'PUT', headers, body }, PUT_TIMEOUT_MS)
      if (!response.ok) {
        throw new Error(`تعذّر رفع الملفّ إلى R2 (${response.status}${await reasonOf(response)})`)
      }
    },

    async remove(key) {
      const url = endpoint(key)
      const headers = signed('DELETE', url, sha256Hex(''))
      const response = await request('حذف الملفّ', url, { method: 'DELETE', headers }, META_TIMEOUT_MS)
      // 404 ليس خطأً: الحذف يُطلب بعد فشلٍ جزئيّ فيجد ما لم يُكتب
      if (!response.ok && response.status !== 404) {
        throw new Error(`تعذّر حذف الملفّ من R2 (${response.status}${await reasonOf(response)})`)
      }
    },

    async read(key) {
      const url = endpoint(key)
      const headers = signed('GET', url, UNSIGNED_PAYLOAD)
      const response = await request('قراءة الملفّ', url, { headers }, META_TIMEOUT_MS)
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
