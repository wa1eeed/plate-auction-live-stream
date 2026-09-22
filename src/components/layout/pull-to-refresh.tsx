'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { isNativeShell } from '@/lib/device'
import { haptic } from '@/lib/haptics'
import { cn } from '@/lib/utils'

/**
 * سحبٌ للتحديث — **والهيدر لا يتحرّك**.
 *
 * وارتدادُ الحاوية كان يجرّ الهيدر معه: هو `sticky` داخلها، فما يرتدّ يرتدّ
 * به. فأُوقف الارتداد (`overscroll-behavior-y: none`) وصُنع السحب بيدنا —
 * فالحركة لمؤشّرٍ نرسمه لا للصفحة كلّها.
 *
 * **ولا يُرسم في الويب**: المتصفّح له تحديثه، وسحبٌ يعترض التمرير في صفحةٍ
 * طويلة يُزعج أكثر ممّا يفيد.
 */

/** المسافة التي يقع عندها التحديث — والسحب يُقاوَم بعدها فلا يمتدّ بلا حدّ. */
const THRESHOLD = 72
/** أقلّ زمنٍ يبقى فيه الدوران — وومضةٌ أسرع من العين تُقلق ولا تطمئن. */
const MIN_SPIN_MS = 650

export function PullToRefresh() {
  const router = useRouter()
  const [native, setNative] = useState(false)
  const [pull, setPull] = useState(0)
  const [busy, setBusy] = useState(false)

  useEffect(() => setNative(isNativeShell()), [])

  const refresh = useCallback(() => {
    setBusy(true)
    haptic('success')
    router.refresh()
    window.setTimeout(() => {
      setBusy(false)
      setPull(0)
    }, MIN_SPIN_MS)
  }, [router])

  useEffect(() => {
    if (!native) return
    const scroller = document.querySelector<HTMLElement>('[data-app-scroll]')
    if (!scroller) return

    let startY = 0
    let dragging = false
    let distance = 0

    const onStart = (event: TouchEvent) => {
      /* لا يبدأ إلّا من أعلى الحاوية تمامًا — وإلّا اعترض تمريرًا عاديًّا */
      if (scroller.scrollTop > 0 || busy) return
      startY = event.touches[0]?.clientY ?? 0
      dragging = true
      distance = 0
    }

    const onMove = (event: TouchEvent) => {
      if (!dragging) return
      const current = event.touches[0]?.clientY ?? 0
      const raw = current - startY

      /* سحبٌ لأعلى يُنهي الالتقاط: صاحبُه يريد التمرير لا التحديث */
      if (raw <= 0) {
        dragging = false
        distance = 0
        setPull(0)
        return
      }

      /*
       * مقاومةٌ تتزايد: أوّلُ المسافة يتبع الإصبع، وآخرُها يشتدّ.
       *
       * وبلا مقاومة يمتدّ المؤشّر إلى نصف الشاشة فيبدو معطوبًا، ومع مقاومةٍ
       * ثابتة لا يُحسّ الفرق بين ما بلغ الحدّ وما دونه.
       */
      distance = Math.min(raw * 0.45, THRESHOLD * 1.6)
      setPull(distance)
      /* يُمنع تمرير الحاوية ما دمنا نسحب — وإلّا تحرّكت الصفحة تحت المؤشّر */
      if (event.cancelable) event.preventDefault()
    }

    const onEnd = () => {
      if (!dragging) return
      dragging = false
      if (distance >= THRESHOLD) refresh()
      else setPull(0)
    }

    /* `passive: false` شرطٌ لـ`preventDefault` في `touchmove` */
    scroller.addEventListener('touchstart', onStart, { passive: true })
    scroller.addEventListener('touchmove', onMove, { passive: false })
    scroller.addEventListener('touchend', onEnd, { passive: true })
    scroller.addEventListener('touchcancel', onEnd, { passive: true })

    return () => {
      scroller.removeEventListener('touchstart', onStart)
      scroller.removeEventListener('touchmove', onMove)
      scroller.removeEventListener('touchend', onEnd)
      scroller.removeEventListener('touchcancel', onEnd)
    }
  }, [native, busy, refresh])

  if (!native) return null

  const ready = pull >= THRESHOLD
  const progress = Math.min(pull / THRESHOLD, 1)
  const visible = busy || pull > 2

  return (
    <div
      aria-hidden={!busy}
      role="status"
      className="pointer-events-none fixed inset-x-0 z-30 flex justify-center"
      style={{
        /* أسفل الهيدر مباشرةً — والهيدر ارتفاعُه ثابت فوق المنطقة الآمنة */
        top: 'calc(var(--safe-top) + 4rem)',
      }}
    >
      <span
        className={cn(
          'mt-2 flex size-9 items-center justify-center rounded-full border border-ink-600 bg-ink-800 shadow-lg shadow-black/15 transition-opacity',
          visible ? 'opacity-100' : 'opacity-0',
        )}
        style={{
          /* ينزل مع الإصبع، ويثبت في موضعه أثناء الدوران */
          transform: `translateY(${busy ? THRESHOLD * 0.35 : pull * 0.8}px)`,
          transition: busy || pull === 0 ? 'transform 220ms cubic-bezier(.2,.8,.2,1)' : 'none',
        }}
      >
        <RefreshCw
          className={cn(
            'size-4 transition-colors',
            busy ? 'animate-spin text-gold-500' : ready ? 'text-gold-500' : 'text-muted',
          )}
          style={
            busy
              ? undefined
              : /* يدور مع السحب: الحركة تقول «اقتربتَ» قبل أن يتغيّر اللون */
                { transform: `rotate(${progress * 270}deg)` }
          }
        />
      </span>
    </div>
  )
}
