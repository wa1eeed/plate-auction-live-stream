import { uploadRejection } from '@/lib/domain/upload-limits'

export type UploadResult = { key: string; width: number | null; height: number | null }
export type UploadPurpose = 'banner' | 'story' | 'poster'

/** خطأٌ برسالةٍ عربية جاهزة للعرض — لا `Error` عامّ يُترجمه المستدعي. */
export class UploadError extends Error {}

/**
 * مهلةُ الرفع المباشر — بقدر عمر الرابط الموقَّع لا أقلّ.
 *
 * ورابطُ الرفع يعيش ربع ساعة، فمهلةٌ أقصر منه تقطع رفعًا كان سيتمّ.
 */
const DIRECT_TIMEOUT_MS = 15 * 60 * 1000
/** والرفعُ عبر الخادم محدودٌ بأربعةٍ وعشرين ميغابايت، فدقيقتان تكفيانه. */
const PROXY_TIMEOUT_MS = 2 * 60 * 1000

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

async function postJson(
  url: string,
  body: unknown,
  ms: number,
): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: timeout(ms),
  })
  const data = await readJson(response)
  if (!response.ok) {
    const message = (data?.error as { message?: string } | undefined)?.message
    throw new UploadError(message ?? `تعذّر الرفع — ردّ الخادم ${response.status}`)
  }
  if (!data) throw new UploadError(`ردٌّ غير مفهوم من الخادم (${response.status})`)
  return data
}

/**
 * الرفعُ عبر الخادم — الطريق القديم، ويبقى مسلكًا لا أثرًا.
 *
 * فمحرّك القرص لا يوقّع روابط، والتطوير والفحص يعملان عليه. فبلا هذا المسلك
 * تحتاج المجموعةُ حاويةً وسرًّا لتمرّ.
 */
async function viaServer(file: File, purpose: UploadPurpose): Promise<UploadResult> {
  const form = new FormData()
  form.append('file', file)
  form.append('purpose', purpose)

  const response = await fetch('/api/admin/media', {
    method: 'POST',
    body: form,
    signal: timeout(PROXY_TIMEOUT_MS),
  })
  const data = await readJson(response)
  if (!response.ok) {
    const message = (data?.error as { message?: string } | undefined)?.message
    throw new UploadError(message ?? `تعذّر الرفع — ردّ الخادم ${response.status}`)
  }
  if (typeof data?.key !== 'string') {
    throw new UploadError(`ردٌّ غير مفهوم من الخادم (${response.status})`)
  }
  return data as unknown as UploadResult
}

/**
 * يرفع ملفًّا — **مباشرةً إلى المخزن حيث أمكن، وعبر الخادم حيث لا**.
 *
 * وثلاثُ خطوات: يُوقَّع رابطٌ لمفتاحٍ في بادئة الحجر، ثمّ يرفع المتصفّح إليه
 * بلا أن يمرّ بايتٌ بخادمنا، ثمّ يُؤكَّد فيقرأ الخادمُ **رأسَ الملفّ** من
 * المخزن ويحكم عليه وينقله إلى موضعه.
 *
 * والحكمُ كلُّه بعد الرفع لا قبله — وهو ثمنُ ألّا تمرّ البايتات بنا. لكنّ ما
 * لم يُصدَّق لا يُنقل ولا يُقدَّم: يبقى في حاويةٍ لا نطاقَ لها حتى يُمحى.
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

  const signed = await postJson('/api/admin/media/sign', { purpose, mime, size: file.size }, 30_000)

  /* محرّكٌ لا يوقّع — فيُرفع عبر الخادم كما كان */
  if (signed.unsupported === true || typeof signed.url !== 'string') {
    return viaServer(file, purpose)
  }

  const put = await fetch(signed.url as string, {
    method: 'PUT',
    /* النوع موقَّعٌ في الرابط — فمخالفتُه هنا تُردّ من المخزن نفسه */
    headers: { 'content-type': mime },
    body: file,
    signal: timeout(DIRECT_TIMEOUT_MS),
  })
  if (!put.ok) {
    throw new UploadError(`تعذّر الرفع إلى المخزن (${put.status}) — أعد المحاولة`)
  }

  const confirmed = await postJson(
    '/api/admin/media/confirm',
    { purpose, key: signed.key },
    60_000,
  )
  if (typeof confirmed.key !== 'string') {
    throw new UploadError('تعذّر تأكيد الرفع — أعد المحاولة')
  }
  return confirmed as unknown as UploadResult
}
