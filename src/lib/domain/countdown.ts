/**
 * تفكيك العدّ التنازلي ومراحل إلحاحه — منطق نقيّ يشاركه العرض والاختبار.
 */

export type CountdownParts = {
  days: number
  hours: number
  minutes: number
  seconds: number
  totalMs: number
}

export function splitCountdown(ms: number): CountdownParts {
  const totalMs = Math.max(0, ms)
  const totalSeconds = Math.floor(totalMs / 1000)
  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
    totalMs,
  }
}

/**
 * مرحلة الإلحاح.
 *
 * التدرّج مقصود: المزايد لا يحتاج تنبيهًا وأمامه يومان، ويحتاجه بشدّة في
 * الدقيقة الأخيرة. ومنصّات المزاد العالمية تتّفق على هذا التدرّج تقريبًا،
 * وحدوده هنا مربوطة بنافذة التمديد التلقائي المعتادة (5 دقائق).
 */
export type CountdownUrgency = 'ended' | 'final' | 'urgent' | 'soon' | 'normal'

export const URGENCY_THRESHOLDS = {
  /** أقل من دقيقة: كل ثانية تُحسب */
  final: 60_000,
  /** أقل من خمس دقائق: نافذة التمديد التلقائي المعتادة */
  urgent: 5 * 60_000,
  /** أقل من ساعة: يقترب الحسم */
  soon: 60 * 60_000,
} as const

export function countdownUrgency(ms: number): CountdownUrgency {
  if (ms <= 0) return 'ended'
  if (ms < URGENCY_THRESHOLDS.final) return 'final'
  if (ms < URGENCY_THRESHOLDS.urgent) return 'urgent'
  if (ms < URGENCY_THRESHOLDS.soon) return 'soon'
  return 'normal'
}

/**
 * الوحدات المعروضة: نسقط الوحدات الكبرى الصفرية فلا يرى المزايد «٠٠ يوم».
 * ونُبقي دائمًا ثلاث وحدات على الأقل حتى لا يقفز عرض العدّاد ويتغيّر عرضه.
 */
export type CountdownUnit = 'days' | 'hours' | 'minutes' | 'seconds'

export function visibleUnits(parts: CountdownParts): CountdownUnit[] {
  if (parts.days > 0) return ['days', 'hours', 'minutes', 'seconds']
  return ['hours', 'minutes', 'seconds']
}

export const UNIT_LABELS: Record<CountdownUnit, string> = {
  days: 'يوم',
  hours: 'ساعة',
  minutes: 'دقيقة',
  seconds: 'ثانية',
}

/** نسبة ما مضى من المزاد (0..1) — تعطي المزايد سياقًا لا رقمًا مجرّدًا. */
export function elapsedRatio(remainingMs: number, totalDurationMs: number): number {
  if (totalDurationMs <= 0) return 0
  const elapsed = totalDurationMs - Math.max(0, remainingMs)
  return Math.min(1, Math.max(0, elapsed / totalDurationMs))
}

/**
 * نصّ مختصر للحالات التي لا تتّسع لكتل الأرقام (بطاقات السوق والشارات).
 *
 * الدقّة تتبع القرب: مزاد أمامه أيام يُعرض بالأيام والساعات — عدّ الثواني فيه
 * ضجيج على بطاقة تعرض عشرات اللوحات. وما دون اليوم تظهر الثواني لأنها تُحسب.
 */
export function compactCountdown(ms: number): string {
  const { days, hours, minutes, seconds } = splitCountdown(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  if (ms <= 0) return 'انتهى'
  if (days > 0) {
    const dayLabel = days === 1 ? 'يوم' : days === 2 ? 'يومان' : 'أيام'
    return `${days} ${dayLabel} و${hours} س`
  }
  if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  return `${pad(minutes)}:${pad(seconds)}`
}
