'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { CloudOff, Wifi } from 'lucide-react'
import { useNetwork } from '@/lib/hooks/use-network'
import { cn } from '@/lib/utils'

/**
 * شريطٌ يقول إنّ الاتّصال انقطع — ولا يُبدّل الشاشة.
 *
 * فمن انقطع عنه الإنترنت وهو يقرأ صفحةً لا يُراد به أن تُمحى من تحته: ما
 * يقرؤه صار قديمًا، لكنّ محوَه يُفقده مكانه بلا فائدة. والشريط يقول الحال
 * ويترك الصفحة.
 *
 * **وعلى صفحة مزادٍ الأمر أدقّ**: السعر المعروض قد لا يكون الحاليّ. ولذلك
 * يُذكر ذلك صراحةً في نصّ الشريط — لا يُترك للظنّ.
 *
 * وعند العودة يُعاد جلب الصفحة: ما فات في أثناء الانقطاع لا يُستنتج ممّا
 * في الذاكرة، والخادم هو المصدر.
 */
export function NetworkBanner() {
  const { online, justRestored } = useNetwork()
  const router = useRouter()
  const wasOffline = useRef(false)

  useEffect(() => {
    if (!online) {
      wasOffline.current = true
      return
    }
    /*
     * الجلب عند العودة **لا عند كلّ رسم**: شرطُه أنّه كان منقطعًا.
     *
     * وبلا هذا الحارس يُعاد الجلب عند أوّل تركيبٍ لأنّ `online` يبدأ `true`،
     * فيُضاف طلبٌ إلى كلّ فتحةٍ للتطبيق بلا سبب.
     */
    if (wasOffline.current) {
      wasOffline.current = false
      router.refresh()
    }
  }, [online, router])

  if (online && !justRestored) return null

  return (
    <div
      role="status"
      aria-live="polite"
      /*
       * **في سياق الصفحة لا لاصقًا ولا ثابتًا.**
       *
       * وأوّلُ صياغةٍ كانت `sticky top-0 z-50` — فزاحمت شيئين: الهيدر
       * (`sticky top-0 z-40`) فيقع أحدهما فوق الآخر، والقائمة المنسدلة
       * (`z-50`) فقد يحجب الشريطُ قائمةَ الإشعارات نفسها.
       *
       * والانقطاع حالٌ عارضة، والتنبيه الفوريّ يقوله الـtoast في لحظة الفعل.
       * فيكفي أن يُعلَن أعلى الصفحة بلا أن يُزاحم ما يُضغط.
       */
      className={cn(
        'flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-semibold',
        online ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger',
      )}
      style={{ paddingTop: 'calc(var(--safe-top) + 0.5rem)' }}
    >
      {online ? (
        <>
          <Wifi className="size-4 shrink-0" />
          <span>تم استعادة الاتّصال</span>
        </>
      ) : (
        <>
          <CloudOff className="size-4 shrink-0" />
          <span>لا اتّصال بالإنترنت — الأسعار المعروضة قد لا تكون الحاليّة</span>
        </>
      )}
    </div>
  )
}
