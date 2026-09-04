import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { isServiceError } from './market-service'

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data as object, { status: 200, ...init })
}

export function fail(message: string, status = 400, code = 'BAD_REQUEST') {
  return NextResponse.json({ error: { message, code } }, { status })
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
    // لا نسجّل أي أسرار — الرسالة فقط
    if (process.env.NODE_ENV !== 'production') console.error('[api]', error.message)
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
