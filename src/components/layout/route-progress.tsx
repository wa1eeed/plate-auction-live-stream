'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

/**
 * شريطُ تقدّمٍ للانتقال — **الجواب الفوريّ على الضغطة**.
 *
 * كلُّ صفحةٍ في المنصّة `force-dynamic`: لا شيء يُخدَم من ذاكرة العميل، فكلُّ
 * ضغطةٍ رحلةٌ كاملة إلى الخادم. وهي خمسون ملّي على اتّصالٍ جيّد فلا تُرى،
 * **وثوانٍ على جوّالٍ نام راديوه** — وليس في التطبيق ما يقول إنّ شيئًا يجري.
 *
 * فتُقرأ الضغطةُ سقوطًا: «الزرّ لا يعمل». وهو ما يُقال عن التطبيقات التي
 * تُترك مفتوحةً ثمّ يُعاد إليها — لا لأنّها جمدت، بل لأنّها صمتت.
 *
 * والشريط يُنهي هذا الصمت: يظهر خلال مئة ملّي من الضغطة، فيُعلم أنّ الطلب
 * في طريقه. وما دون المئة لا يُظهر شيئًا — ووميضٌ في كلّ انتقالٍ سريع أسوأ
 * من لا شيء.
 */

/** تأخيرٌ قبل الظهور: ما تمّ دونه لا يستحقّ وميضًا. */
const SHOW_AFTER_MS = 100

/**
 * بعد هذا يُعدّ الانتقال **عالقًا** — فيُحمَّل تحميلًا كاملًا.
 *
 * وفي App Router كلُّ ضغطة رابطٍ جلبٌ من الخادم. فإن عَلِق ذلك الجلب — على
 * وصلةٍ بقيت مفتوحةً في الجدول وقد ماتت في الشبكة، وهو ما يقع بعد أن يُعلَّق
 * الغلافُ ساعةً ثمّ يُعاد إليه — **لا يقع شيء ولا يُقال شيء**. فتُقرأ الضغطةُ
 * جمودًا: «الأزرار لا تعمل»، وهي تعمل وتنتظر ردًّا لن يأتي.
 *
 * والتحميلُ الكامل يقطع ذلك: وصلةٌ جديدة، وصفحةٌ تصل أو خطأٌ يُرى — وكلاهما
 * خيرٌ من صمت. وثماني ثوانٍ فوق أيّ انتقالٍ بطيءٍ معقول ودون صبر من ينتظر.
 */
const STUCK_AFTER_MS = 8_000

export function RouteProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [active, setActive] = useState(false)
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stuckTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /*
   * البدء يُلتقط من الضغطة نفسها في **طور الالتقاط** على المستند.
   *
   * ولا يُعتمد على `useLinkStatus`: هي داخل `Link` وحدها، وفي المنصّة روابطُ
   * كثيرة ومكوّناتٌ تنقل بـ`router.push`. والالتقاط على المستند يغطّيها
   * جميعًا بموضعٍ واحد، ولا يحتاج أن يُلفَّ كلُّ رابطٍ بمكوّن.
   */
  useEffect(() => {
    const clear = () => {
      if (showTimer.current) clearTimeout(showTimer.current)
      showTimer.current = null
      if (stuckTimer.current) clearTimeout(stuckTimer.current)
      stuckTimer.current = null
    }

    const onClick = (event: MouseEvent) => {
      /* ما لم يكن ضغطةً يسارية بلا مُعدِّل فليس انتقالًا في هذا التبويب */
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const anchor = (event.target as Element | null)?.closest?.('a')
      if (!anchor) return

      const href = anchor.getAttribute('href')
      if (!href || anchor.target === '_blank' || anchor.hasAttribute('download')) return

      let target: URL
      try {
        target = new URL(href, window.location.href)
      } catch {
        return
      }
      /* خارجيٌّ أو تنزيل: يتولّاه المتصفّح ولا شأن للموجِّه به */
      if (target.origin !== window.location.origin) return
      /* المكان نفسه: لا انتقال ولا شريط */
      if (target.pathname === window.location.pathname && target.search === window.location.search) {
        return
      }

      clear()
      showTimer.current = setTimeout(() => setActive(true), SHOW_AFTER_MS)

      /*
       * والحارس: إن لم يصل المسار في مدّته، يُحمَّل الهدفُ تحميلًا كاملًا.
       *
       * ولا يُحمَّل تبويبٌ مخفيّ: صاحبُه غادره، وتحميلٌ في غيبته يضيع ويُعيد
       * الطلبَ بلا أن يراه أحد.
       */
      const destination = target.href
      stuckTimer.current = setTimeout(() => {
        if (document.visibilityState !== 'visible') return
        window.location.assign(destination)
      }, STUCK_AFTER_MS)

      /*
       * ⚠ **ولا يُسأل `defaultPrevented` بعد التوزيع** — وقد جُرّب فسقط.
       *
       * `<Link>` يمنع السلوك الافتراضي في **كلّ** ضغطة ليتولّى التنقّل بنفسه.
       * فشرطُ «من منع لم يُرِد انتقالًا» يُلغي الحارس في كلّ ضغطة رابطٍ —
       * أي في الحالات التي بُني لها وحدها. قِيس بجلبٍ مُعلَّقٍ عمدًا: مرّت
       * أربعَ عشرةَ ثانية والصفحة على حالها ولم يقع إنقاذ.
       *
       * والحارسُ يكفيه ما مرّ من فحص: رابطٌ داخليٌّ إلى مسارٍ آخر، بضغطةٍ
       * يسارية بلا مُعدِّل. وما نُقر عليه كذلك يُقصد الذهابُ إليه — والتحميلُ
       * الكامل هو ما كان يفعله المتصفّح لولا الموجِّه.
       */
    }

    document.addEventListener('click', onClick, { capture: true })
    /*
     * علامةٌ تقول إنّ المستمع قائم — مقبضٌ للفحص، ولقراءة الحال على الجهاز.
     *
     * والضغطةُ قبل الترطيب لا يُمسكها شيء: المكوّن عميلٌ ومستمعُه يُركَّب في
     * أثرٍ بعد التركيب. وهي ضغطةٌ واحدة على صفحةٍ وصلت لتوّها — والمشكلة
     * المقصودة تقع بعد طول بقاء، حيث الترطيب تمّ منذ دهر.
     */
    document.documentElement.dataset.routeProgress = 'ready'
    return () => {
      document.removeEventListener('click', onClick, { capture: true })
      delete document.documentElement.dataset.routeProgress
      clear()
    }
  }, [])

  /*
   * وصلَ المسار الجديد — فينتهي الشريط مهما كان سببُ بدئه.
   *
   * **والاعتماد على النصّ لا على الكائن.** `useSearchParams` تردّ كائنًا
   * جديدًا مع كلّ تصيير، فوضعُه في قائمة الاعتماد يُشغّل هذا الأثر في كلّ
   * مرّة — فيُطفأ الشريط في الإطار التالي لإشعاله، ولا يُرى قطّ. وقد وقع:
   * قِيس بخادمٍ أُبطئ تسعمئة ملّي فلم تظهر إشارةٌ قبل وصول الصفحة.
   */
  const search = searchParams.toString()
  useEffect(() => {
    if (showTimer.current) clearTimeout(showTimer.current)
    showTimer.current = null
    /* وصل المسار، فلا انتقالَ عالقًا يُنقَذ */
    if (stuckTimer.current) clearTimeout(stuckTimer.current)
    stuckTimer.current = null
    setActive(false)
  }, [pathname, search])

  if (!active) return null

  return (
    <div
      /*
       * `aria-hidden`: الانتقال يُعلنه تبدّلُ الصفحة نفسها لقارئ الشاشة،
       * وشريطٌ يُنطق في كلّ ضغطةٍ ثرثرةٌ لا خبر.
       */
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden bg-transparent"
      style={{ marginTop: 'var(--safe-top)' }}
    >
      <span className="route-progress-bar block h-full w-full bg-gold-500" />
    </div>
  )
}
