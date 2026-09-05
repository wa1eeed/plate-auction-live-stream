'use client'

import { AlertTriangle, Clock3 } from 'lucide-react'
import { useSignedCountdown } from '@/lib/hooks/use-countdown'
import { compactCountdown, countdownUrgency } from '@/lib/domain/countdown'
import { cn } from '@/lib/utils'

/**
 * مهلة الصفقة: عدٌّ إلى الموعد، ثمّ عدٌّ منه.
 *
 * كان يُقال «يتبقّى ٠٠:٠٠» بعد انقضاء المهلة — رقمٌ ميّت لا يقول شيئًا، ومن
 * تأخّر لا يعرف أتأخّر ساعةً أم ثلاثة أيام. والفرق بينهما ليس تجميلًا: مهلة
 * السداد يتبعها اقتطاعٌ من العربون وإعادةُ إرساء، فمقدار التأخّر هو نفسه
 * مقدار الخطر.
 *
 * فالعدّاد يعبر الصفر إلى «تأخّر منذ …» ويقلب لونه، ويبقى المرجع وقت الخادم
 * لا ساعة الجهاز — كعدّاد المزاد سواء.
 */
export function DeadlineMeter({
  deadline,
  serverTime,
  label = 'يتبقّى للسداد',
  overdueLabel = 'تأخّر السداد منذ',
  className,
}: {
  deadline: string
  /** مرجع وقت الخادم، فلا ينحرف العدّ بساعة الجهاز */
  serverTime: string
  label?: string
  overdueLabel?: string
  className?: string
}) {
  const signed = useSignedCountdown(deadline, serverTime)
  const overdue = signed <= 0
  const magnitude = Math.abs(signed)
  const urgency = countdownUrgency(Math.max(0, signed))
  const text = compactCountdown(magnitude)

  return (
    <span
      role="timer"
      aria-label={`${overdue ? overdueLabel : label} ${text}`}
      className={cn(
        'inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold transition-colors',
        overdue
          ? 'border-danger/60 bg-danger/12 text-danger'
          : urgency === 'urgent' || urgency === 'final'
            ? 'border-danger/50 bg-danger/[0.07] text-danger'
            : urgency === 'soon'
              ? 'border-gold-600/55 bg-gold-500/12 text-gold-400'
              : 'border-ink-600 bg-ink-900 text-muted',
        // النبض للمتأخّر وحده: ما زال في المهلة لا يُفزَّع
        overdue && 'motion-safe:animate-[pulse-ring_1.8s_ease-out_infinite]',
        className,
      )}
    >
      {overdue ? (
        <AlertTriangle className="size-3.5 shrink-0" />
      ) : (
        <Clock3 className="size-3.5 shrink-0" />
      )}
      <span className="font-semibold opacity-90">{overdue ? overdueLabel : label}</span>
      <span dir="ltr" className="text-sm tabular-nums">
        {text}
      </span>
    </span>
  )
}
