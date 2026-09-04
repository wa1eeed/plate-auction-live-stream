'use client'

import { Loader2, Radio, WifiOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ConnectionStatus } from '@/lib/hooks/use-listing'

/*
 * «مزاد مباشر» لا «متصل لحظيًا».
 *
 * الحالة تقنيّة والوسم يُقرأ من زائر لا يعنيه المقبس: ما يعنيه أن ما يراه
 * يحدث الآن. والنبض على الأيقونة يقول ذلك بلا كلمة — وهو ما يُنتظر من مؤشّر
 * البثّ في كل واجهة حديثة.
 */
const MAP: Record<
  ConnectionStatus,
  {
    label: string
    icon: typeof Radio
    variant: 'muted' | 'success' | 'gold' | 'danger'
    spin: boolean
    pulse: boolean
  }
> = {
  connecting: { label: 'جارٍ الاتصال', icon: Loader2, variant: 'muted', spin: true, pulse: false },
  live: { label: 'مزاد مباشر', icon: Radio, variant: 'success', spin: false, pulse: true },
  reconnecting: { label: 'إعادة الاتصال…', icon: Loader2, variant: 'gold', spin: true, pulse: false },
  offline: { label: 'انقطع الاتصال', icon: WifiOff, variant: 'danger', spin: false, pulse: false },
}

export function ConnectionBadge({ status, className }: { status: ConnectionStatus; className?: string }) {
  const entry = MAP[status]
  const Icon = entry.icon
  return (
    <Badge variant={entry.variant} className={className}>
      {entry.pulse ? (
        // حلقة تتمدّد خلف الأيقونة ثم تتلاشى — نبضٌ يُرى ولا يُزعج
        <span className="relative flex size-3 items-center justify-center">
          <span
            aria-hidden
            className="absolute inline-flex size-3 animate-ping rounded-full bg-success/60 motion-reduce:hidden"
          />
          <Icon className="relative size-3" />
        </span>
      ) : (
        <Icon className={cn('size-3', entry.spin && 'animate-spin')} />
      )}
      {entry.label}
    </Badge>
  )
}
