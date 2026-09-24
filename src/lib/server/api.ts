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
    console.error('[api]', redactUrls(error.message))
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
