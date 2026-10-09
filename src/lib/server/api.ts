import { randomUUID } from 'node:crypto'
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

/**
 * و**المفتاحُ الرسالةُ وحدها، والرمزُ يُطبع معها ولا يدخل فيه.**
 *
 * فالرمز يتبدّل في كلّ نداء — فلو دخل المفتاحَ لصار كلُّ سطرٍ جديدًا، ولعاد
 * الغرقُ الذي بُني هذا الحارسُ له: عطلٌ قائمٌ في المسح الدوريّ يكتب سبعةَ
 * عشرَ ألفَ سطرٍ في اليوم. وقد كُسر بذلك فعلًا حين أُضيف الرمز، فأمسكه
 * الاختبارُ القائم.
 */
function logOnce(message: string, trace?: string): void {
  const now = Date.now()
  const seen = logged.get(message)
  if (seen && now - seen.at < LOG_WINDOW_MS) {
    seen.muted += 1
    return
  }
  if (logged.size >= LOG_KEYS_MAX) logged.clear()
  logged.set(message, { at: now, muted: 0 })
  const muted = seen?.muted ?? 0
  const head = trace ? `[api] [${trace}]` : '[api]'
  console.error(muted > 0 ? `${head} ${message} (وكُتم ${muted} مثلُها)` : `${head} ${message}`)
}

/** للفحص وحده — يُنسى ما سُجِّل فتُقاس نافذةُ الكتم من جديد. */
export function resetLogThrottleForTests(): void {
  logged.clear()
}

/**
 * يحوّل أي خطأ إلى استجابة عربية آمنة بلا تسريب تفاصيل داخلية.
 *
 * وثلاثُ طبقات: `ServiceError` رسالةٌ كُتبت للمستخدم فتمرّ كما هي؛ وخطأُ
 * التحقّق يُقال أيُّ حقلٍ أخطأ؛ وما عداهما يُكتم نصُّه ويُسجَّل برمزٍ يُذكر.
 */
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
     * **ما لم نتوقّعه: يُسجَّل كاملًا، ويُقال للمستخدم جملةٌ واحدة.**
     *
     * و`ServiceError` و`ZodError` نتائجُ محكومةٌ كُتبت ليقرأها المستخدم. وما
     * يبلغ هنا عطبٌ أو عطلُ بنية، ونصُّه نصُّ السائق أو المكتبة.
     *
     * وكان نصُّه يُرسل كما هو. فظهر على شاشة مزايدٍ في الإنتاج:
     * `Failed query: insert into "deposits" (...) values ($1, …) params:
     * dep_…, D26-…, lst_…, usr_…, 500000, held, …` — أسماءُ الجداول
     * وأعمدتُها ومعرّفاتُ الصفوف ومبالغُها، في نافذةٍ فوق صفحة المزاد. وهي
     * خريطةُ المخطَّط تُعطى لمن يقرؤها، ورعبٌ لمن لا يقرؤها.
     *
     * والتوثيق فوق هذه الدالّة كان يقول «بلا تسريب تفاصيل داخلية» — وكان
     * الكود يقول غير ذلك. فعاد إلى ما وُثّق.
     *
     * **ورمزٌ قصيرٌ يصل الشاشةَ بالسجلّ.** فجملةٌ عامّةٌ وحدها تُعمي الدعم:
     * «ما عمل معي» لا يُشخَّص. والرمزُ يُعرض للمستخدم ويُكتب مع النصّ
     * الكامل، فيُبحث عنه في السجلّ فيُقرأ العطبُ بعينه.
     */
    const trace = randomUUID().slice(0, 8)
    logOnce(redactUrls(error.message), trace)
    return fail(
      `تعذّر إتمام العملية — خللٌ غير متوقّع. أعد المحاولة، وإن تكرّر فأبلغ الدعم بالرمز ${trace}.`,
      500,
      'INTERNAL',
    )
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
