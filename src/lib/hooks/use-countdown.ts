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
  return Math.max(0, useSignedCountdown(endsAt, serverTime, frozenMs))
}

/**
 * كالعدّاد، لكنّه يمضي إلى السالب بعد الموعد.
 *
 * `useCountdown` يقصّ عند الصفر لأنّ مزادًا انتهى لا يُعدّ بعده شيء. أمّا
 * المهلة فما بعدها معنًى: صفقةٌ تأخّر سدادها ساعتين ليست كصفقةٍ تأخّرت
 * يومين، ومن يقرأ «انتهت المهلة» لا يعرف أين هو من العقوبة. فالسالب هنا
 * مقصود، ومن أراد القصّ فليقصّ.
 */
export function useSignedCountdown(
  endsAt: string | null,
  serverTime: string | null,
  frozenMs?: number | null,
) {
  const offsetRef = useRef(0)

  // القيمة الابتدائية تُشتقّ من قيمتين قادمتين من الخادم فقط، فتتطابق مع
  // تصيير الخادم ولا تحدث وميضة «0» قبل أول تحديث للعدّاد.
  const [remaining, setRemaining] = useState(() => {
    if (frozenMs !== null && frozenMs !== undefined) return frozenMs
    if (!endsAt || !serverTime) return 0
    return new Date(endsAt).getTime() - new Date(serverTime).getTime()
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
    const read = () => target - (Date.now() - offsetRef.current)

    let timer: ReturnType<typeof setTimeout> | null = null

    /*
     * **نبضةٌ في الثانية، مُحاذاةً لحافّتها — لا عشرٌ في الثانية.**
     *
     * كانت `setInterval(tick, 100)`: عشرُ إعاداتِ تصييرٍ في الثانية **لكلّ
     * بطاقة**. واثنتا عشرة بطاقةً في السوق تعني مئةً وعشرين إعادةً في
     * الثانية، تجري ما دامت الصفحة مفتوحة. والمعروض ثوانٍ لا أعشارها، فتسعٌ
     * من كلّ عشرٍ كانت تُنتج النصَّ نفسه.
     *
     * والمحاذاة تُصلح ما هو أدقّ: النبضة تقع عند حافّة الثانية لا بعدها
     * بكسرٍ عشوائيّ، فيتبدّل الرقم في لحظته لا متأخّرًا عنها بما يصل إلى
     * تسعين ملّي.
     */
    const schedule = () => {
      const remaining = read()
      setRemaining(remaining)
      if (remaining <= 0) return

      /* ما يفصلنا عن حافّة الثانية التالية — وبحدٍّ أدنى يمنع دورةً محمومة */
      const toEdge = ((remaining % 1000) + 1000) % 1000
      timer = setTimeout(schedule, Math.max(toEdge || 1000, 50))
    }

    /*
     * **ولا نبض وهي مخفيّة.**
     *
     * عدّادٌ لا يراه أحد لا يُحسب: التطبيق في الخلفية كان يُعيد التصيير
     * بلا انقطاع حتى يُعلّق النظام العمليّة — استنزافُ بطّاريةٍ لا يُقابله
     * شيءٌ يُرى. وعند العودة يُقرأ الوقت فورًا، فما يظهر صحيحٌ لا قديم.
     */
    const stop = () => {
      if (timer) clearTimeout(timer)
      timer = null
    }

    const onVisibility = () => {
      stop()
      if (document.visibilityState === 'visible') schedule()
      else setRemaining(read())
    }

    if (document.visibilityState === 'visible') schedule()
    else setRemaining(read())

    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [endsAt, frozenMs])

  return remaining
}
