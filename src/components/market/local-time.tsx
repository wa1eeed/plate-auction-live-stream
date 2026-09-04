'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * ختم زمني **بتوقيت جهاز المستخدم** أيًّا كان.
 *
 * لماذا مكوّن عميل؟ لأن الخادم لا يعرف منطقة الزائر الزمنية، فلو صيّرناه على
 * الخادم لظهر بتوقيت الخادم ثم تغيّر عند الترطيب — وهو اختلاف يشتكي منه React
 * ويُربك القارئ. لذلك:
 *  • يُصيَّر أولًا بتوقيت الرياض (مرجع المنصّة) فيقرؤه من لا جافاسكربت لديه.
 *  • ثم يتحوّل بعد التركيب إلى توقيت الجهاز.
 *  • و`suppressHydrationWarning` يمنع تحذيرًا نعرف سببه ونقصده.
 *
 * وسم `<time dateTime>` يحمل القيمة المطلقة بصيغة ISO، فتقرؤها الأدوات
 * والمساعدات الآلية مهما اختلف ما نعرضه.
 */
export function LocalTime({
  iso,
  mode = 'full',
  className,
}: {
  iso: string | null
  /** `full` تاريخ ووقت بالثواني · `datetime` بلا ثوانٍ · `time` وقت فقط · `date` تاريخ فقط */
  mode?: 'full' | 'datetime' | 'time' | 'date'
  className?: string
}) {
  const [zone, setZone] = useState<string | undefined>('Asia/Riyadh')

  // بعد التركيب فقط: المنطقة الفعلية للجهاز
  useEffect(() => setZone(undefined), [])

  if (!iso) return <span className={className}>—</span>
  const date = new Date(iso)

  /* التاريخ رقمي بالشرطة المائلة لا باسم شهر — صيغة واحدة في المنصّة كلّها */
  const dateParts: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }
  const options: Intl.DateTimeFormatOptions =
    mode === 'date'
      ? dateParts
      : mode === 'time'
      ? { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }
      : mode === 'datetime'
        ? { ...dateParts, hour: '2-digit', minute: '2-digit', hour12: false }
        : {
            ...dateParts,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          }

  const formatted = new Intl.DateTimeFormat('ar-SA-u-nu-latn', {
    ...options,
    timeZone: zone,
  }).format(date)

  const zoneName =
    zone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'التوقيت المحلي'

  return (
    <time
      dateTime={iso}
      title={`${formatted} — ${zoneName}`}
      suppressHydrationWarning
      className={cn('tabular-nums', className)}
    >
      {formatted}
    </time>
  )
}

/** يعرض منطقة جهاز القارئ — يوضّح مرجع الأوقات في الجداول الطويلة. */
export function LocalZoneNote({ className }: { className?: string }) {
  const [zone, setZone] = useState<string | null>(null)
  useEffect(() => {
    setZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
  }, [])
  if (!zone) return null
  return (
    <span className={cn('text-[11px] text-muted', className)} suppressHydrationWarning>
      كل الأوقات بتوقيت جهازك ({zone})
    </span>
  )
}
