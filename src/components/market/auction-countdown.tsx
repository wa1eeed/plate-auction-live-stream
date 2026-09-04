'use client'

import { useEffect, useRef, useState } from 'react'
import { Clock3, Timer, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCountdown } from '@/lib/hooks/use-countdown'
import { useSound } from '@/lib/hooks/use-sound'
import {
  compactCountdown,
  countdownUrgency,
  elapsedRatio,
  splitCountdown,
  UNIT_LABELS,
  visibleUnits,
  type CountdownUnit,
  type CountdownUrgency,
} from '@/lib/domain/countdown'

/** ألوان كل مرحلة إلحاح — نقطة واحدة تحكم مظهر العدّاد كلّه. */
const TONE: Record<CountdownUrgency, { text: string; ring: string; bar: string; chip: string }> = {
  normal: {
    text: 'text-paper',
    ring: 'border-ink-600 bg-ink-900',
    bar: 'bg-ink-500',
    chip: 'border-ink-600 bg-ink-800 text-muted',
  },
  soon: {
    text: 'text-gold-400',
    ring: 'border-gold-600/50 bg-gold-500/[0.07]',
    bar: 'bg-gold-500',
    chip: 'border-gold-600/50 bg-gold-500/12 text-gold-400',
  },
  urgent: {
    text: 'text-danger',
    ring: 'border-danger/50 bg-danger/[0.07]',
    bar: 'bg-danger',
    chip: 'border-danger/50 bg-danger/12 text-danger',
  },
  final: {
    text: 'text-danger',
    ring: 'border-danger/70 bg-danger/[0.12]',
    bar: 'bg-danger',
    chip: 'border-danger/70 bg-danger/20 text-danger',
  },
  ended: {
    text: 'text-muted',
    ring: 'border-ink-600 bg-ink-900',
    bar: 'bg-ink-600',
    chip: 'border-ink-600 bg-ink-800 text-muted',
  },
}

const URGENCY_NOTE: Partial<Record<CountdownUrgency, string>> = {
  soon: 'يقترب الحسم',
  urgent: 'الدقائق الأخيرة',
  final: 'الثواني الأخيرة',
}

/**
 * يكتشف تمديد المزاد.
 *
 * التمديد يصل لحظيًا عبر WebSocket فيقفز `endsAt` إلى الأمام والعدّاد يزيد
 * فجأة. بلا إشارة يظنّ المزايد أن العدّاد اختلّ — فنومض ونعلن «مُدّد المزاد».
 */
function useExtensionFlash(endsAt: string | null): boolean {
  const previous = useRef<number | null>(null)
  const [flashing, setFlashing] = useState(false)

  useEffect(() => {
    const next = endsAt ? new Date(endsAt).getTime() : null
    const before = previous.current
    previous.current = next

    if (before === null || next === null || next <= before) return
    setFlashing(true)
    const id = setTimeout(() => setFlashing(false), 2_600)
    return () => clearTimeout(id)
  }, [endsAt])

  return flashing
}

type BaseProps = {
  endsAt: string | null
  serverTime: string | null
  /** مدّة المزاد كاملة بالثواني — لرسم شريط ما مضى */
  durationSeconds?: number
  /** يوقف العدّاد على قيمة ثابتة (مزاد منتهٍ) */
  frozenMs?: number | null
  className?: string
}

/**
 * العدّاد التنازلي للمزاد.
 *
 * مبنيّ على ثلاثة مبادئ تعتمدها منصّات المزاد الجادّة:
 *  1. **الوقت من الخادم** لا من جهاز الزائر — ساعة غير مضبوطة لا تُقدّم مزادًا
 *     ولا تؤخّره (`useCountdown`).
 *  2. **الإلحاح متدرّج** لا ثابت: اللون والنبض يشتدّان كلّما اقترب الحسم.
 *  3. **الأرقام لا ترتجف**: عرض ثابت لكل كتلة وأرقام جدولية، فلا يتحرّك
 *     التخطيط ستّين مرة في الدقيقة.
 */
/**
 * تكّة كل ثانية في العشر الأخيرة.
 *
 * العشر وحدها لا الدقيقة كاملة: صوت يتكرّر ستّين مرة يصير ضجيجًا يُسكِته
 * المزايد فيفقد التنبيه قيمته وقت الحسم. و`useSound` صامت افتراضيًا، فلا
 * يسمع شيئًا من لم يُشغّل الصوت بنفسه.
 */
function useFinalTicks(remaining: number) {
  const { play } = useSound()
  const lastSecond = useRef<number | null>(null)

  useEffect(() => {
    const second = Math.ceil(remaining / 1000)
    if (remaining <= 0 || second > 10) {
      lastSecond.current = null
      return
    }
    if (lastSecond.current === second) return
    lastSecond.current = second
    play('tick')
  }, [remaining, play])
}

export function AuctionCountdown({
  endsAt,
  serverTime,
  durationSeconds,
  frozenMs = null,
  className,
}: BaseProps) {
  const remaining = useCountdown(endsAt, serverTime, frozenMs)
  const urgency = countdownUrgency(remaining)
  const parts = splitCountdown(remaining)
  const units = visibleUnits(parts)
  const tone = TONE[urgency]
  const extended = useExtensionFlash(endsAt)
  const ratio = durationSeconds ? elapsedRatio(remaining, durationSeconds * 1000) : null
  useFinalTicks(remaining)

  if (urgency === 'ended') {
    return (
      <div
        className={cn(
          'flex items-center justify-center gap-2 rounded-2xl border border-ink-600 bg-ink-900 px-4 py-5 text-sm font-bold text-muted',
          className,
        )}
      >
        <Clock3 className="size-4" />
        انتهى وقت المزاد
      </div>
    )
  }

  return (
    <div
      className={cn('rounded-2xl border p-3 transition-colors sm:p-4', tone.ring, className)}
      // يقرؤه قارئ الشاشة مرة كل دقيقة لا كل ثانية
      role="timer"
      aria-label={`الوقت المتبقّي ${compactCountdown(remaining)}`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-bold text-muted">
          <Timer className="size-3.5" />
          الوقت المتبقّي
        </span>

        {extended ? (
          <span className="flex animate-[rise_0.3s_ease-out] items-center gap-1 rounded-full border border-success/50 bg-success/12 px-2 py-0.5 text-[11px] font-bold text-success">
            <Zap className="size-3" />
            مُدّد المزاد
          </span>
        ) : (
          URGENCY_NOTE[urgency] && (
            <span
              className={cn(
                'rounded-full border px-2 py-0.5 text-[11px] font-bold',
                tone.chip,
                urgency === 'final' && 'animate-[pulse-ring_1.4s_ease-out_infinite]',
              )}
            >
              {URGENCY_NOTE[urgency]}
            </span>
          )
        )}
      </div>

      {/* كتل الأرقام — تُقرأ من اليسار لليمين كالساعة */}
      <div dir="ltr" className="flex items-stretch justify-center gap-1 sm:gap-1.5">
        {units.map((unit, index) => (
          <div key={unit} className="flex items-stretch gap-1 sm:gap-1.5">
            {index > 0 && (
              <span
                aria-hidden
                className={cn('self-center pb-4 text-base font-bold opacity-40 sm:text-xl', tone.text)}
              >
                :
              </span>
            )}
            <Segment
              value={parts[unit]}
              unit={unit}
              tone={tone.text}
              // الثواني وحدها تنبض في الدقيقة الأخيرة — نبض الجميع تشويش
              pulse={urgency === 'final' && unit === 'seconds'}
            />
          </div>
        ))}
      </div>

      {ratio !== null && (
        <div className="mt-3.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
            <div
              className={cn('h-full rounded-full transition-[width] duration-1000 ease-linear', tone.bar)}
              style={{ width: `${Math.round(ratio * 100)}%` }}
            />
          </div>
          <p className="mt-1.5 text-center text-[11px] text-muted">
            مضى {Math.round(ratio * 100)}٪ من مدّة المزاد
          </p>
        </div>
      )}
    </div>
  )
}

function Segment({
  value,
  unit,
  tone,
  pulse,
}: {
  value: number
  unit: CountdownUnit
  tone: string
  pulse: boolean
}) {
  return (
    /*
      * الخانة تضيق على الجوال.
      *
      * أربع خانات بعرض 3.25rem وفواصلها تتجاوز عرض العمود على 390px، فيُقصّ
      * العدّاد أو يخرج عن صندوقه — وهو أوّل ما يُنظر إليه في صفحة مزاد.
      */
    <div className="flex min-w-[2.5rem] flex-col items-center sm:min-w-[3.25rem]">
      <span
        className={cn(
          'w-full rounded-lg bg-ink-800/70 py-1.5 text-center text-2xl font-extrabold leading-none tabular-nums sm:rounded-xl sm:text-4xl',
          tone,
          pulse && 'motion-safe:animate-[count-flash_1s_ease-out_infinite]',
        )}
      >
        {String(value).padStart(2, '0')}
      </span>
      <span className="mt-1 text-[10px] font-semibold text-muted">{UNIT_LABELS[unit]}</span>
    </div>
  )
}

/**
 * شريط عدّاد لبطاقة المزاد.
 *
 * يقع مباشرة تحت اللوحة ويأخذ عرض البطاقة كاملًا: الوقت هو ما يحسم قرار
 * المزايد، فإخفاؤه في شارة صغيرة بين التفاصيل يدفنه. والأرقام كبيرة جدولية
 * فتُقرأ من مسافة تصفّح الشبكة.
 */
export function CardCountdown({
  endsAt,
  serverTime,
  frozenMs = null,
  className,
}: BaseProps) {
  const remaining = useCountdown(endsAt, serverTime, frozenMs)
  const urgency = countdownUrgency(remaining)
  const parts = splitCountdown(remaining)
  const units = visibleUnits(parts)
  const tone = TONE[urgency]
  const extended = useExtensionFlash(endsAt)

  if (urgency === 'ended') {
    return (
      <p className="flex items-center justify-center gap-1.5 border-y border-ink-700 bg-ink-900/60 py-2.5 text-xs font-bold text-muted">
        <Clock3 className="size-3.5" />
        انتهى المزاد
      </p>
    )
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-2.5 border-y py-2.5 transition-colors',
        urgency === 'normal'
          ? 'border-ink-700 bg-ink-900/60'
          : cn(tone.ring, 'border-x-0 rounded-none'),
        className,
      )}
      role="timer"
      aria-label={`الوقت المتبقّي ${compactCountdown(remaining)}`}
    >
      {extended ? (
        <span className="flex items-center gap-1.5 text-xs font-bold text-success">
          <Zap className="size-3.5" />
          مُدّد المزاد
        </span>
      ) : (
        <>
          <Clock3 className={cn('size-3.5 shrink-0', tone.text)} />
          <span dir="ltr" className="flex items-baseline gap-1">
            {units.map((unit, index) => (
              <span key={unit} className="flex items-baseline gap-1">
                {index > 0 && (
                  <span aria-hidden className={cn('text-sm font-bold opacity-40', tone.text)}>
                    :
                  </span>
                )}
                <span className="flex flex-col items-center">
                  <span className={cn('text-lg font-extrabold leading-none tabular-nums', tone.text)}>
                    {String(parts[unit]).padStart(2, '0')}
                  </span>
                  <span className="mt-0.5 text-[9px] font-semibold text-muted">
                    {UNIT_LABELS[unit]}
                  </span>
                </span>
              </span>
            ))}
          </span>
        </>
      )}
    </div>
  )
}

/**
 * عدّاد بخانات — رقميّ رسميّ في مساحة صغيرة.
 *
 * ثلاث خانات مربّعة بأرقام جدولية وتسمية تحت كلٍّ، بلا نقطتين ولا كلمات
 * موصولة («يومان و23 س»). والصيغة الرقمية تُقرأ بلمحة ولا يتغيّر عرضها بتغيّر
 * القيمة — فلا يرقص الصفّ حولها كل ثانية.
 *
 * ويُلوَّن بالإلحاح: ذهبيّ حين يقترب الحسم، وأحمر نابض في دقائقه الأخيرة.
 */
export function TileCountdown({ endsAt, serverTime, frozenMs = null, className }: BaseProps) {
  const remaining = useCountdown(endsAt, serverTime, frozenMs)
  const urgency = countdownUrgency(remaining)
  const parts = splitCountdown(remaining)
  const units = visibleUnits(parts)
  const tone = TONE[urgency]

  if (urgency === 'ended') {
    return (
      <p className={cn('flex items-center gap-1.5 text-[11px] font-bold text-muted', className)}>
        <Clock3 className="size-3.5" />
        انتهى المزاد
      </p>
    )
  }

  return (
    <div
      dir="ltr"
      role="timer"
      aria-label={`الوقت المتبقّي ${compactCountdown(remaining)}`}
      className={cn('flex items-start gap-0.5', className)}
    >
      {/*
        * الوحدات كلّها حتى الثانية.
        *
        * والخانة صغيرة لتتّسع الأربع في عمودٍ ضيّق بلا أن تزاحم السعر: الثانية
        * هي ما يجعل العدّاد **حيًّا** لا صورةً لوقتٍ مضى.
        */}
      {units.map((unit) => (
        <span key={unit} className="flex w-8 flex-col items-center">
          <span
            className={cn(
              'flex h-6 w-full items-center justify-center rounded-md border text-[13px] font-extrabold leading-none tabular-nums',
              urgency === 'normal' ? 'border-ink-600 bg-ink-900/60 text-paper' : tone.chip,
              urgency === 'final' && 'animate-pulse-ring',
            )}
          >
            {String(parts[unit]).padStart(2, '0')}
          </span>
          <span className="mt-1 text-[8px] font-semibold leading-none text-muted">
            {UNIT_LABELS[unit]}
          </span>
        </span>
      ))}
    </div>
  )
}

/**
 * نسخة مضغوطة لسطر واحد — للأشرطة والقوائم الضيّقة.
 */
export function CompactCountdown({
  endsAt,
  serverTime,
  frozenMs = null,
  className,
  withIcon = true,
}: BaseProps & { withIcon?: boolean }) {
  const remaining = useCountdown(endsAt, serverTime, frozenMs)
  const urgency = countdownUrgency(remaining)
  const extended = useExtensionFlash(endsAt)

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-bold transition-colors',
        extended ? 'border-success/50 bg-success/12 text-success' : TONE[urgency].chip,
        urgency === 'final' && 'motion-safe:animate-[pulse-ring_1.4s_ease-out_infinite]',
        className,
      )}
      role="timer"
      aria-label={`الوقت المتبقّي ${compactCountdown(remaining)}`}
    >
      {withIcon &&
        (extended ? <Zap className="size-3" /> : <Clock3 className="size-3 shrink-0" />)}
      <span dir="ltr" className="tabular-nums">
        {extended ? 'مُدّد' : compactCountdown(remaining)}
      </span>
    </span>
  )
}
