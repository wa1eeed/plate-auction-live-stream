/**
 * حدودُ الرفع بالبايت — **مصدرٌ واحد يقرؤه الخادم والمتصفّح**.
 *
 * والخادمُ يبقى الحَكَم: يقيس البايتات المقروءة ويردّ `413`. لكنّ ردَّه
 * **قبل قراءة الجسم** لا يبلغ المتصفّحَ رسالةً — يغلق الخادمُ الوصلةَ
 * والمتصفّحُ ما زال يرفع، فيُجهَض الطلب ويقع `fetch` في `catch`، فيُقرأ
 * «تعذّر الاتّصال بالخادم»: عطلُ شبكةٍ موهوم، والملفُّ إنّما كان كبيرًا.
 *
 * فيُقاس الحجمُ في المتصفّح **قبل** أن يُرسل. وهذا لا يستبدل حراسةَ الخادم
 * ولا ينقص منها — إنّما يمنع طلبًا محكومًا بالفشل، ويقول للرافع كم ملفُّه
 * وكم الحدّ بدل أن يُحيله على الشبكة.
 */
export const UPLOAD_LIMITS = {
  'image/jpeg': 4 * 1024 * 1024,
  'image/png': 4 * 1024 * 1024,
  'image/webp': 4 * 1024 * 1024,
  'video/mp4': 24 * 1024 * 1024,
  'application/pdf': 8 * 1024 * 1024,
} as const

export type LimitedMime = keyof typeof UPLOAD_LIMITS

/** حدُّ نوعٍ ما، أو `null` لنوعٍ لا نعرفه — فيحكم فيه الخادم وحده. */
export function limitFor(mime: string): number | null {
  return (UPLOAD_LIMITS as Record<string, number | undefined>)[mime] ?? null
}

const megabytes = (bytes: number): string =>
  (bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')

/**
 * رسالةُ التجاوز، أو `null` إن كان الحجمُ مقبولًا.
 *
 * وبالميغابايت لا بالبايت: «٤٢ ميغابايت والحدّ ٢٤» يُقرأ ويُفهم، و
 * «44040192 بايت» رقمٌ يُعدّ بالأصابع.
 */
export function overLimitMessage(mime: string, bytes: number): string | null {
  const limit = limitFor(mime)
  if (limit === null || bytes <= limit) return null
  return `الملفّ ${megabytes(bytes)} ميغابايت والحدّ ${megabytes(limit)} — اختر ملفًّا أصغر`
}
