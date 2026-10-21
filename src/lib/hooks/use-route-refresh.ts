'use client'

import { useCallback, useEffect, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'

/**
 * **إنعاشُ المسار — يُنتظر حتى يصل الجديد.**
 *
 * و`router.refresh()` لا يُنتظر: يُنادى فيعود فورًا والجلبُ يمضي في الخلف.
 * فيقع هذا في كلّ صفحةٍ فيها أمر:
 *
 *   ضغطة ← دوّارة ← ردُّ الخادم ← `refresh()` ← **تتوقّف الدوّارة** ←
 *   …لحظة… ← تتبدّل الصفحةُ وحدها
 *
 * فيُقرأ التبدّلُ تحديثًا تلقائيًّا لا أثرًا لضغطةٍ وقعت — وهو ما شكاه صاحبُ
 * المنصّة: «بعد اتخاذ اكشن يتم تحديث الصفحه و يظهر اللودر لوهله».
 *
 * وهذه تُعيد وعدًا يتحقّق حين يستقرّ التصيير بالبيانات الجديدة. فيصير في كلّ
 * موضعٍ سطرٌ واحد — `await refresh()` مكان `router.refresh()` — فيبقى
 * `busy` القائمُ في `finally` صادقًا إلى النهاية. فعلٌ واحدٌ متّصل.
 *
 * > **وما لا يحتاج إنعاشًا لا يُنعَش.** فصفحةٌ تجلب حالها بنفسها — كصفحة
 * > اللوحة عبر `useListing` — يكفيها جلبُها، وإنعاشُ المسار فوقه رحلةٌ
 * > ثانيةٌ تُعيد بناء الشجرة كلِّها بلا خبرٍ جديد.
 */

/**
 * حدٌّ أقصى للانتظار.
 *
 * و`isPending` قد لا يرتفع أصلًا إن لم يكن ثمّ ما يُعاد تصييره، أو قد يعلق
 * جلبٌ على وصلةٍ ماتت. ووعدٌ لا يتحقّق يعني زرًّا معطَّلًا إلى الأبد — وهو
 * عطبٌ أسوأ ممّا جاء هذا ليُصلحه. فيُحلّ القيدُ بعد هذه المدّة على كلّ حال.
 */
const WAIT_CEILING_MS = 10_000

export function useRouteRefresh(): { refreshing: boolean; refresh: () => Promise<void> } {
  const router = useRouter()
  const [refreshing, startTransition] = useTransition()
  const waiting = useRef<(() => void)[]>([])
  const started = useRef(false)

  const settle = useCallback(() => {
    started.current = false
    for (const resolve of waiting.current.splice(0)) resolve()
  }, [])

  useEffect(() => {
    if (refreshing) {
      started.current = true
      return
    }
    /* هبط `isPending` بعد ارتفاعه — فقد استقرّ التصيير بالجديد */
    if (started.current) settle()
  }, [refreshing, settle])

  /* ومغادرةُ المكوّن تُحلّ ما ينتظر: وعدٌ معلَّقٌ بعد الإزالة لا يتحقّق أبدًا */
  useEffect(() => settle, [settle])

  const refresh = useCallback(
    () =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(settle, WAIT_CEILING_MS)
        waiting.current.push(() => {
          clearTimeout(timer)
          resolve()
        })
        startTransition(() => router.refresh())
      }),
    [router, settle],
  )

  return { refreshing, refresh }
}
