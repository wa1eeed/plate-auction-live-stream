'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * عدّاد يعتمد وقت الخادم.
 *
 * يُحسب فرق الساعة بين الجهاز والخادم مرة واحدة عند كل تحديث للحالة، ثم
 * يُعرض `endsAt - (now - offset)` — فلا تؤثر ساعة الجهاز غير المضبوطة على
 * صحة العد، والخادم يبقى المرجع الوحيد لنهاية المزاد.
 */
export function useCountdown(endsAt: string | null, serverTime: string | null, frozenMs?: number | null) {
  const offsetRef = useRef(0)

  // القيمة الابتدائية تُشتقّ من قيمتين قادمتين من الخادم فقط، فتتطابق مع
  // تصيير الخادم ولا تحدث وميضة «0» قبل أول تحديث للعدّاد.
  const [remaining, setRemaining] = useState(() => {
    if (frozenMs !== null && frozenMs !== undefined) return frozenMs
    if (!endsAt || !serverTime) return 0
    return Math.max(0, new Date(endsAt).getTime() - new Date(serverTime).getTime())
  })

  useEffect(() => {
    if (!serverTime) return
    offsetRef.current = Date.now() - new Date(serverTime).getTime()
  }, [serverTime])

  useEffect(() => {
    if (frozenMs !== null && frozenMs !== undefined) {
      setRemaining(frozenMs)
      return
    }
    if (!endsAt) {
      setRemaining(0)
      return
    }
    const target = new Date(endsAt).getTime()
    const tick = () => setRemaining(Math.max(0, target - (Date.now() - offsetRef.current)))
    tick()
    const id = setInterval(tick, 100)
    return () => clearInterval(id)
  }, [endsAt, frozenMs])

  return remaining
}
