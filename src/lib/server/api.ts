import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { isServiceError } from './market-service'

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data as object, { status: 200, ...init })
}

export function fail(message: string, status = 400, code = 'BAD_REQUEST') {
  return NextResponse.json({ error: { message, code } }, { status })
}

/** يمنع تسرّب رابطٍ أو توقيعٍ إلى السجلّ — كما في `server.mjs`. */
function redactUrls(text: string): string {
  return String(text).replace(/\b[a-z+]+:\/\/[^\s'"]*/gi, '‹رابط محجوب›')
}

/*
 * الرسالةُ المكرَّرة تُكتم — **وإلّا غرق السجلُّ فيما جاء ليُظهره**.
 *
 * والمسحُ الدوريّ في `server.mjs` يطلب مسارًا داخليًّا كلَّ خمس ثوان: فعطلٌ
 * قائمٌ فيه يكتب سبعةَ عشرَ ألفَ سطرٍ في اليوم، ويدفن تحتها السطرَ الواحدَ
 * الذي يُبحث عنه. وقد وقع هذا فعلًا في البوّابة أوّلَ ما رُفع الكتمُ عن
 * الإنتاج، فكان الإصلاحُ يهدم غرضَه.
 *
 * فأوّلُ ظهورٍ يُكتب في حينه — لا يُؤجَّل ولا يُجمَّع — ثمّ لا يُعاد نصُّه
 * إلّا بعد دقيقة، ومعه عددُ ما كُتم فلا يضيع أنّه تكرّر.
 */
const LOG_WINDOW_MS = 60_000
/** سقفٌ يمنع نموَّ الخريطة بلا حدّ: الرسائل قد تحمل معرّفًا يتبدّل. */
const LOG_KEYS_MAX = 200
const logged = new Map<string, { at: number; muted: number }>()

function logOnce(message: string): void {
  const now = Date.now()
  const seen = logged.get(message)
  if (seen && now - seen.at < LOG_WINDOW_MS) {
    seen.muted += 1
    return
  }
  if (logged.size >= LOG_KEYS_MAX) logged.clear()
  logged.set(message, { at: now, muted: 0 })
  const muted = seen?.muted ?? 0
  console.error(muted > 0 ? `[api] ${message} (وكُتم ${muted} مثلُها)` : `[api] ${message}`)
}

/** للفحص وحده — يُنسى ما سُجِّل فتُقاس نافذةُ الكتم من جديد. */
export function resetLogThrottleForTests(): void {
  logged.clear()
}

/** يحوّل أي خطأ إلى استجابة عربية آمنة بلا تسريب تفاصيل داخلية. */
export function handleError(error: unknown) {
  if (isServiceError(error)) {
    return fail(error.message, error.status, error.code)
  }
  if (error instanceof ZodError || (error as { name?: string })?.name === 'ZodError') {
    const first = (error as ZodError).issues?.[0]
    return fail(first?.message ?? 'بيانات غير صحيحة', 422, 'VALIDATION_ERROR')
  }
  if (error instanceof Error) {
    /*
     * يُسجَّل في الإنتاج أيضًا — وكان في التطوير وحده.
     *
     * وهذا الفرع هو «ما لم نتوقّعه»: `ServiceError` و`ZodError` نتائجُ محكومة
     * يقرؤها العميل في الردّ، وما يبلغ هنا عطبٌ أو عطلُ بنية. فكتمُه في
     * الإنتاج يعني أنّ رفعًا يفشل على الخادم فلا يبقى منه **سطرٌ واحد** في
     * السجلّ — فيُشخَّص بالحدس بدل أن يُقرأ. والروابط تُحجب: رسائل السائق
     * والتوقيع قد تحمل رابط اتّصالٍ أو توقيعًا موقَّتًا.
     */
    logOnce(redactUrls(error.message))
    return fail(error.message, 400, 'ERROR')
  }
  return fail('حدث خطأ غير متوقع', 500, 'INTERNAL')
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return {}
  }
}
