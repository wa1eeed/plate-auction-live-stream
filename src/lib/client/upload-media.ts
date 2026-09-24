import { uploadRejection } from '@/lib/domain/upload-limits'

export type UploadResult = { key: string; width: number | null; height: number | null }
export type UploadPurpose = 'banner' | 'story' | 'poster'

/** خطأٌ برسالةٍ عربية جاهزة للعرض — لا `Error` عامّ يُترجمه المستدعي. */
export class UploadError extends Error {}

/** مهلةُ الرفع — تسع مئةَ ميغابايت على وصلةٍ متواضعة ولا تُبقي الحقل معلَّقًا. */
const UPLOAD_TIMEOUT_MS = 10 * 60 * 1000

const timeout = (ms: number): AbortSignal | undefined =>
  typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(ms) : undefined

/**
 * يقرأ الردّ نصًّا ثمّ يحاول تحليله — ولا يُستدعى `json()` رأسًا.
 *
 * فردٌّ غيرُ JSON (صفحة 504 من وكيلٍ عكسيّ، أو جسمٌ فارغ) يرمي في التحليل
 * فيُقرأ انقطاعَ شبكةٍ لا وجود له. وقد وقع ذلك فعلًا وأضاع ساعات.
 */
async function readJson(response: Response): Promise<Record<string, unknown> | null> {
  const raw = await response.text()
  if (!raw) return null
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
}

/**
 * يرفع ملفًّا إلى الخادم، فيكتبه على القرص ويردّ مفتاحه.
 *
 * والحكمُ على البايتات في الخادم: النوعُ يُطابَق برأس الملفّ لا بترويسته،
 * ونسبةُ البنر تُقاس. فما يصل إلى القرص قد مرّ بذلك كلِّه.
 */
export async function uploadMedia(file: File, purpose: UploadPurpose): Promise<UploadResult> {
  const mime = file.type.trim().toLowerCase()

  /*
   * يُفحص قبل أن يُرسل شيء — ولو كان الخادم سيفحصه.
   *
   * فالخادم يردّ `413` على ترويسة الحجم **قبل قراءة الجسم**، فيغلق الوصلة
   * والمتصفّح ما زال يضخّ، فيُجهَض الطلب بلا رسالةٍ تصل. وقد قُرئ ذلك
   * «تعذّر الاتّصال بالخادم» مرّتين، والشبكةُ سليمة.
   */
  const rejected = uploadRejection(mime, file.size)
  if (rejected) throw new UploadError(rejected)

  const form = new FormData()
  form.append('file', file)
  form.append('purpose', purpose)

  const started = Date.now()
  let response: Response
  try {
    response = await fetch('/api/admin/media', {
      method: 'POST',
      body: form,
      signal: timeout(UPLOAD_TIMEOUT_MS),
    })
  } catch (error) {
    /*
     * **الرقمان اللذان يفرّقان بين ثلاثة أعطالٍ تحت رسالةٍ واحدة.**
     *
     * وصلةٌ تموت لا تُخلّف حالةً ولا جسمًا: المتصفّح يرمي `TypeError` مجرَّدًا
     * لكلّ سبب — قطعٌ من وكيلٍ عكسيّ، أو شبكةٌ انقطعت، أو خادمٌ مات. ولا
     * يُعرف أيُّها إلّا بالزمن: ثانيةٌ تعني رفضًا فوريًّا، وستّون تعني مهلةَ
     * بوّابة، وستُّمئة تعني أنّ الملفّ أكبر من أن يصعد في المدّة المتاحة.
     *
     * فيُذكران في الرسالة نفسها. ورقمان في يد من يقرأ أنفعُ من سجلٍّ يُطلب
     * منه أن يفتحه — وقد كلّف غيابُهما يومًا.
     */
    const seconds = Math.round((Date.now() - started) / 1000)
    const megabytes = (file.size / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')
    if ((error as { name?: string })?.name === 'TimeoutError') {
      throw new UploadError(
        `انقضت مهلة الرفع بعد ${seconds} ثانية (${megabytes} ميغابايت) — الشبكة بطيئة`,
      )
    }
    throw new UploadError(
      `تعذّر الاتّصال بالخادم — انقطع بعد ${seconds} ثانية من رفع ${megabytes} ميغابايت`,
    )
  }

  const data = await readJson(response)
  if (!response.ok) {
    const message = (data?.error as { message?: string } | undefined)?.message
    throw new UploadError(message ?? `تعذّر الرفع — ردّ الخادم ${response.status}`)
  }
  /* ردٌّ بحالة 200 بلا مفتاح ليس نجاحًا — ولا يُمرَّر فراغٌ إلى النموذج */
  if (typeof data?.key !== 'string') {
    throw new UploadError(`تعذّر الرفع — ردٌّ غير مفهوم من الخادم (${response.status})`)
  }
  return data as unknown as UploadResult
}
