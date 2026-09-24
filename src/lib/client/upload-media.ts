import { uploadRejection } from '@/lib/domain/upload-limits'

export type UploadResult = { key: string; width: number | null; height: number | null }
export type UploadPurpose = 'banner' | 'story' | 'poster'

/** خطأٌ برسالةٍ عربية جاهزة للعرض — لا `Error` عامّ يُترجمه المستدعي. */
export class UploadError extends Error {}

/** مهلةُ الرفع — تسع مئةَ ميغابايت على وصلةٍ متواضعة ولا تُبقي الحقل معلَّقًا. */
const UPLOAD_TIMEOUT_MS = 10 * 60 * 1000

const megabytes = (bytes: number): string =>
  (bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')

/**
 * يرفع ملفًّا إلى الخادم — **بـ`XMLHttpRequest` لا `fetch`**.
 *
 * و`fetch` أنظف، لكنّه **لا يقول كم خرج من الملفّ** قبل أن ينقطع: يرمي
 * `TypeError` مجرَّدًا لكلّ سبب — حجبٌ من إضافةٍ في المتصفّح، أو قطعٌ من
 * وكيلٍ عكسيّ، أو شبكةٌ ماتت. وثلاثتُها تُصلَح بغير ما تُصلَح به الأخرى.
 *
 * و`xhr.upload.onprogress` يعطي الرقم الفاصل: **صفرُ بايت خرجت** يعني أنّ
 * الطلب لم يغادر الجهاز أصلًا (إضافةٌ حاجبة، أو سياسةٌ محلّية)، وأكثرُ من
 * صفر يعني أنّه خرج ومات في الطريق. وقد ضاع يومٌ في التفريق بينهما.
 *
 * ويعطي مع ذلك ما تحتاجه الواجهة: تقدّمًا حقيقيًّا بدل دوّارةٍ لا تقول شيئًا.
 */
export function uploadMedia(
  file: File,
  purpose: UploadPurpose,
  onProgress?: (fraction: number) => void,
): Promise<UploadResult> {
  const mime = file.type.trim().toLowerCase()

  /*
   * يُفحص قبل أن يُرسل شيء — ولو كان الخادم سيفحصه.
   *
   * فالخادم يردّ `413` على ترويسة الحجم **قبل قراءة الجسم**، فيغلق الوصلة
   * والمتصفّح ما زال يضخّ، فيُجهَض الطلب بلا رسالةٍ تصل.
   */
  const rejected = uploadRejection(mime, file.size)
  if (rejected) return Promise.reject(new UploadError(rejected))

  return new Promise<UploadResult>((resolve, reject) => {
    const form = new FormData()
    form.append('file', file)
    form.append('purpose', purpose)

    const xhr = new XMLHttpRequest()
    const started = Date.now()
    let sent = 0

    /** وصفُ ما وقع بالأرقام — يُلحق بكلّ رسالة عطلٍ شبكيّ. */
    const trace = () => {
      const seconds = Math.max(Math.round((Date.now() - started) / 1000), 0)
      return `أُرسل ${megabytes(sent)} من ${megabytes(file.size)} ميغابايت في ${seconds} ثانية`
    }

    xhr.upload.addEventListener('progress', (event) => {
      sent = event.loaded
      if (event.lengthComputable && event.total > 0) onProgress?.(event.loaded / event.total)
    })

    xhr.addEventListener('load', () => {
      /*
       * الجسم يُقرأ نصًّا ثمّ يُحاوَل تحليله — لا `JSON.parse` رأسًا.
       *
       * فردٌّ غيرُ JSON (صفحة 504 من وكيلٍ عكسيّ، أو جسمٌ فارغ) يرمي في
       * التحليل، فيُقرأ انقطاعَ شبكةٍ لا وجود له.
       */
      let data: Record<string, unknown> | null = null
      try {
        data = xhr.responseText ? (JSON.parse(xhr.responseText) as Record<string, unknown>) : null
      } catch {
        data = null
      }

      if (xhr.status < 200 || xhr.status >= 300) {
        const message = (data?.error as { message?: string } | undefined)?.message
        reject(new UploadError(message ?? `تعذّر الرفع — ردّ الخادم ${xhr.status}`))
        return
      }
      /* ردٌّ ناجحٌ بلا مفتاح ليس نجاحًا — ولا يُمرَّر فراغٌ إلى النموذج */
      if (typeof data?.key !== 'string') {
        reject(new UploadError(`تعذّر الرفع — ردٌّ غير مفهوم من الخادم (${xhr.status})`))
        return
      }
      resolve(data as unknown as UploadResult)
    })

    /*
     * `error` بلا حالةٍ ولا جسم — والرقمُ وحده يفرّق:
     *
     *   أُرسل صفر  → لم يغادر الطلبُ الجهاز: إضافةٌ حاجبة أو سياسةٌ محلّية
     *   أُرسل بعضه → خرج ومات في الطريق: وكيلٌ قطع أو شبكةٌ انقطعت
     */
    xhr.addEventListener('error', () => {
      reject(
        new UploadError(
          sent === 0
            ? `لم يغادر الطلبُ متصفّحك — لم تُرسل بايتة واحدة (${trace()}). ` +
              'الأرجحُ إضافةٌ حاجبة أو حمايةُ خصوصية. جرّب نافذةً خاصّة.'
            : `انقطع الاتّصال بالخادم — ${trace()}`,
        ),
      )
    })

    xhr.addEventListener('timeout', () => {
      reject(new UploadError(`انقضت مهلة الرفع — ${trace()}`))
    })

    xhr.addEventListener('abort', () => {
      reject(new UploadError(`أُلغي الرفع — ${trace()}`))
    })

    xhr.open('POST', '/api/admin/media')
    xhr.timeout = UPLOAD_TIMEOUT_MS
    xhr.send(form)
  })
}
