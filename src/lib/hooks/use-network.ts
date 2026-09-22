'use client'

import { useEffect, useState } from 'react'
import { isNativeShell } from '@/lib/device'

/**
 * حالة الشبكة — من النظام لا من فشل الطلبات.
 *
 * و`navigator.onLine` وحدها **لا يُوثق بها**: تقول «متّصل» لمن اتّصل بموجّهٍ
 * بلا إنترنت، وتتأخّر في الغلاف. فتُقدَّم إضافة Capacitor عليها حيث توجد،
 * وتبقى الأحداث `online`/`offline` سندًا للويب.
 *
 * ولماذا لا يُكتشف الانقطاع من فشل الطلب؟ لأنّ الفشل يقع **بعد** المهلة —
 * فيُزايد صاحبها في أثنائها وهو يحسب نفسه متّصلًا، ثمّ يُخبَر بالفشل بعد
 * عشر ثوانٍ. والحالة تُعرف قبل أن يُضغط زرٌّ.
 */

export type NetworkState = {
  online: boolean
  /** صار متّصلًا بعد انقطاع — يُستعمل لإعلان العودة مرّةً */
  justRestored: boolean
}

export function useNetwork(): NetworkState {
  /*
   * يبدأ **متّصلًا** لا مجهولًا.
   *
   * وأوّلُ رسمٍ يقع قبل أن تُقرأ حالة النظام، فبدءُ «غير متّصل» يُظهر شريط
   * انقطاعٍ يومض ثمّ يختفي في كلّ فتحةٍ للتطبيق — وهو أسوأ من تأخّرٍ لحظة.
   */
  const [online, setOnline] = useState(true)
  const [justRestored, setJustRestored] = useState(false)

  useEffect(() => {
    let cancelled = false
    let removeNative: (() => void) | undefined
    let restoredTimer: ReturnType<typeof setTimeout> | null = null

    const apply = (next: boolean) => {
      if (cancelled) return
      setOnline((previous) => {
        /* العودة تُعلَن مرّةً ثمّ تُطفأ — لا تبقى راية مرفوعة */
        if (!previous && next) {
          setJustRestored(true)
          if (restoredTimer) clearTimeout(restoredTimer)
          restoredTimer = setTimeout(() => {
            if (!cancelled) setJustRestored(false)
          }, 4_000)
        }
        return next
      })
    }

    const onWeb = () => apply(navigator.onLine)
    window.addEventListener('online', onWeb)
    window.addEventListener('offline', onWeb)

    if (isNativeShell()) {
      void (async () => {
        try {
          const { Network } = await import('@capacitor/network')
          const status = await Network.getStatus()
          apply(status.connected)
          const handle = await Network.addListener('networkStatusChange', (state) => {
            apply(state.connected)
          })
          if (cancelled) void handle.remove()
          else removeNative = () => void handle.remove()
        } catch {
          /* لا إضافة: تبقى أحداث الويب وحدها */
        }
      })()
    } else if (typeof navigator !== 'undefined') {
      apply(navigator.onLine)
    }

    return () => {
      cancelled = true
      window.removeEventListener('online', onWeb)
      window.removeEventListener('offline', onWeb)
      if (restoredTimer) clearTimeout(restoredTimer)
      removeNative?.()
    }
  }, [])

  return { online, justRestored }
}
