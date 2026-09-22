/**
 * تمييز أخطاء الشبكة والخدمة — رسالةٌ لكلّ سبب.
 *
 * ورسالةٌ واحدة لكلّ شيء («حدث خطأ») تُخفي ما يحتاجه صاحبها ليتصرّف: أينتظر
 * الشبكة؟ أم يعيد الدخول؟ أم يرفع مزايدته؟ أم لا حيلة له؟ فيُعيد المحاولة
 * بلا جدوى، أو يتركها وهي تصلح.
 */

export type ApiFailure =
  /** الجهاز غير متّصل — عُرف قبل الإرسال */
  | 'offline'
  /** أُرسل ولم يُعرف مآله — **حالةٌ غير مؤكّدة** */
  | 'uncertain'
  | 'timeout'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'validation'
  | 'server'
  | 'unknown'

export const FAILURE_TEXT: Record<ApiFailure, string> = {
  offline: 'لا اتّصال بالإنترنت — تحقّق من الشبكة ثمّ أعد المحاولة.',
  /*
   * ولا تقول «فشل»: قد يكون وقع.
   *
   * انقطاعٌ بعد أن يخرج الطلب لا يعني أنّه لم يصل — فالخادم قد سجّله وردُّه
   * هو الذي ضاع. وقولُ «فشل» يدفع صاحبها إلى إعادةٍ تُنتج مزايدتين.
   */
  uncertain: 'انقطع الاتّصال قبل أن يصل الردّ — نتحقّق من حالتك الآن.',
  timeout: 'تأخّر الخادم في الردّ — أعد المحاولة.',
  unauthorized: 'انتهت جلستك — سجّل الدخول من جديد.',
  forbidden: 'لا تملك صلاحية هذا الإجراء.',
  not_found: 'لم نجد ما تطلبه — ربّما حُذف أو أُغلق.',
  conflict: 'تبدّلت الحالة قبل طلبك — حدّث الصفحة وأعد النظر.',
  rate_limited: 'محاولاتٌ كثيرة في وقتٍ قصير — انتظر قليلًا.',
  validation: 'راجع ما أدخلته.',
  server: 'عطبٌ عندنا لا عندك — نعمل عليه، أعد المحاولة بعد قليل.',
  unknown: 'تعذّر إتمام الطلب.',
}

/** أهي عمليةٌ يُعاد إرسالها بلا خطر؟ */
export function isSafeToRetry(failure: ApiFailure): boolean {
  /*
   * والمالُ يُستثنى مهما كان السبب.
   *
   * هذه الدالّة تُسأل عن **القراءات** وحدها: جلبُ قائمةٍ أو ملفٍّ شخصيّ.
   * أمّا المزايدة والسداد فلا يُعاد إرسالهما تلقائيًّا أبدًا، ولو كان الخطأ
   * «مهلة» — لأنّ المهلة لا تقول إنّ الطلب لم يصل.
   */
  return failure === 'timeout' || failure === 'server' || failure === 'unknown'
}

/** يُصنّف رمز حالةٍ من الخادم. */
export function classifyStatus(status: number): ApiFailure {
  if (status === 401) return 'unauthorized'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not_found'
  if (status === 409) return 'conflict'
  if (status === 422) return 'validation'
  if (status === 429) return 'rate_limited'
  if (status >= 500) return 'server'
  return 'unknown'
}

/**
 * يُصنّف استثناءَ `fetch` — وهو لا يفرّق بين الأسباب بنفسه.
 *
 * `fetch` يرمي `TypeError: Failed to fetch` لانقطاع الشبكة وللإجهاض ولرفض
 * CORS سواءً. فتُقرأ حالة الجهاز لتُفرَّق: منقطعٌ قبل الإرسال ⇐ `offline`،
 * ومتّصلٌ ثمّ سقط ⇐ **غير مؤكّد**.
 */
export function classifyThrown(error: unknown, online: boolean): ApiFailure {
  if (error instanceof DOMException && error.name === 'AbortError') return 'timeout'
  return online ? 'uncertain' : 'offline'
}
