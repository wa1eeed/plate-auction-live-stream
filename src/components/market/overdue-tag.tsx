'use client'

import { AlertTriangle } from 'lucide-react'
import { useSignedCountdown } from '@/lib/hooks/use-countdown'
import { compactCountdown } from '@/lib/domain/countdown'
import { cn } from '@/lib/utils'

/**
 * وسمُ التأخّر — يظهر وحده إن انقضت المهلة، ومعه مقدارُ ما انقضى.
 *
 * الحالة تقول «بانتظار السداد» ولا تقول أمضت المهلة أم لا، ولا كم مضى منها.
 * والفرق ليس وصفًا: مهلةٌ تجاوزها صاحبها بساعةٍ يُذكَّر، وبثلاثة أيام يُصادَر
 * عربونه ويُعاد إرساء اللوحة — فالمقدار هو الحالة.
 *
 * ولا يُرسم شيء قبل انقضائها: وسمٌ رماديّ يقول «في المهلة» ضجيجٌ في جدول.
 */
export function OverdueTag({
  deadline,
  serverTime,
  className,
  label = 'متأخّر',
}: {
  /** موعد الاستحقاق — `null` يعني لا مهلة فلا وسم */
  deadline: string | null
  /** مرجع وقت الخادم، فلا ينحرف العدّ بساعة الجهاز */
  serverTime: string
  className?: string
  label?: string
}) {
  const signed = useSignedCountdown(deadline, serverTime)
  if (!deadline || signed > 0) return null

  return (
    <span
      role="timer"
      aria-label={`${label} منذ ${compactCountdown(-signed)}`}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-danger/60 bg-danger/12 px-2 py-0.5 text-[10px] font-bold leading-none text-danger',
        className,
      )}
    >
      <AlertTriangle className="size-3 shrink-0" />
      {label}
      <span dir="ltr" className="tabular-nums opacity-90">
        {compactCountdown(-signed)}
      </span>
    </span>
  )
}
