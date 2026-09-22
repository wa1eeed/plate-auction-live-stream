'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { appVersion, devicePlatform, isNativeShell } from '@/lib/device'

/**
 * الطبقة الأصيلة — ما لا يقدر عليه المتصفّح.
 *
 * تُصيَّر في كلّ صفحة ولا ترسم شيئًا. وكلُّ ما فيها **يصمت في الويب**:
 * الاستيراد نفسه لا يقع إلّا داخل الغلاف، فلا تُحمَّل حزمٌ أصيلة على زائرٍ
 * فتح المنصّة من متصفّحه.
 */
export function NativeShell() {
  const router = useRouter()
  const pathname = usePathname()

  /* ------------------------------------------------ الإقلاع وشريط الحالة */
  /*
   * علامةٌ على الجذر تقول «نحن في غلافٍ أصيل».
   *
   * ويُقرأ منها CSS ما يُخفى وما يُظهر — بدل شرطٍ يُحسب في كلّ مكوّن ويُخطئ
   * في الترطيب. وتُوضع بعد الترطيب لأنّ الخادم لا يعرف أين تُعرض صفحتُه.
   */
  useEffect(() => {
    if (!isNativeShell()) return
    document.documentElement.setAttribute('data-native', devicePlatform())
    return () => document.documentElement.removeAttribute('data-native')
  }, [])

  useEffect(() => {
    if (!isNativeShell()) return
    let cancelled = false
    let themeObserver: MutationObserver | undefined

    void (async () => {
      const [{ SplashScreen }, { StatusBar, Style }] = await Promise.all([
        import('@capacitor/splash-screen'),
        import('@capacitor/status-bar'),
      ])
      if (cancelled) return

      /*
       * تُخفى بأمرٍ لا بمؤقّت — و`launchAutoHide: false` في الإعداد.
       *
       * المؤقّت يخمّن متى صارت الصفحة جاهزة: إن قصُر ظهرت شاشةٌ بيضاء تحته،
       * وإن طال انتظر صاحبُه بلا سبب. وهذا السطر يقع بعد أوّل رسمٍ فعليّ.
       */
      await SplashScreen.hide().catch(() => undefined)

      /*
       * **متراكبٌ على أندرويد، وأسلوبُه من السمة لا ثابتًا.**
       *
       * التراكب يجعل خلفية الهيدر تمتدّ تحت الشريط فيُقرأ الوقت عليها، وهو
       * ما تفعله التطبيقات الأصيلة. وبلاه يحجز النظام شريطًا بلونٍ منفصل
       * فيظهر خطٌّ فاصلٌ أعلى الشاشة يقول «هذه نافذة».
       *
       * و`setOverlaysWebView` لا وجود له على iOS — يُتجاهَل هناك بلا خطأ،
       * وiOS متراكبٌ أصلًا مع `viewport-fit: cover`.
       *
       * والأسلوب يُشتقّ من `data-theme` على الجذر: `Style.Light` في
       * Capacitor تعني **محتوًى داكنًا على خلفية فاتحة** — والعكس يجعل
       * الأيقونات بيضاء على أبيض فتختفي الساعة والشبكة.
       */
      const applyStatusBar = async () => {
        /*
         * `light` صراحةً، وما عداها داكن.
         *
         * والسمة الأساسية في المنصّة **داكنة**، و`data-theme="light"` هي
         * التي تُضبط على الجذر. فاختبارُ `=== 'dark'` يُخطئ حين لا تُضبط
         * السمة أصلًا: يحسبها فاتحةً فتصير الأيقونات داكنةً على داكن.
         */
        const light = document.documentElement.dataset.theme === 'light'
        await StatusBar.setStyle({ style: light ? Style.Light : Style.Dark }).catch(() => undefined)
        /* اللون يُقرأ من السمة نفسها فلا يتناقض مع خلفية الصفحة */
        const bg = getComputedStyle(document.documentElement)
          .getPropertyValue('--status-bar-color')
          .trim()
        if (bg) await StatusBar.setBackgroundColor({ color: bg }).catch(() => undefined)
      }

      /*
       * والتراكب يُطلب مرّةً: هو حالُ النافذة لا حالُ الصفحة.
       */
      await StatusBar.setOverlaysWebView({ overlay: true }).catch(() => undefined)
      await applyStatusBar()

      /*
       * ويُعاد عند تبدّل السمة — فمن بدّلها ليلًا لا تختفي عنه ساعتُه.
       */
      const observer = new MutationObserver(() => void applyStatusBar())
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme'],
      })
      themeObserver = observer
    })()

    return () => {
      cancelled = true
      themeObserver?.disconnect()
    }
  }, [])

  /* ------------------------------------------------------- زرّ الرجوع */
  useEffect(() => {
    if (!isNativeShell()) return
    let remove: (() => void) | undefined

    void (async () => {
      const { App } = await import('@capacitor/app')
      const handle = await App.addListener('backButton', ({ canGoBack }) => {
        /*
         * الرجوع يتبع التاريخ، والجذرُ يُصغَّر ولا يُغلق.
         *
         * إغلاقُ التطبيق من الصفحة الأولى يُفقد المزايدَ مكانه ويُطفئ اتصاله
         * اللحظيّ؛ والتصغير يُبقيه حيًّا في الخلفية كما يتوقّع من أيّ تطبيق.
         */
        if (canGoBack) router.back()
        else void App.minimizeApp().catch(() => undefined)
      })
      remove = () => void handle.remove()
    })()

    return () => remove?.()
  }, [router])

  /* --------------------------------------- العودة من الخلفية: الخادم أصدق */
  useEffect(() => {
    if (!isNativeShell()) return
    let remove: (() => void) | undefined

    void (async () => {
      const { App } = await import('@capacitor/app')
      const handle = await App.addListener('appStateChange', ({ isActive }) => {
        /*
         * ما على الشاشة بعد الرجوع **قديمٌ حتمًا**: السعر تبدّل، والمهلة
         * انقضت بعضها، وربّما بيعت اللوحة. فيُعاد الجلب من الخادم لا يُعرض
         * ما في الذاكرة — والبثّ اللحظيّ يتكفّل بما بعدها.
         *
         * وهو المسلك نفسه في الويب عند `visibilitychange`.
         */
        if (isActive) router.refresh()
      })
      remove = () => void handle.remove()
    })()

    return () => remove?.()
  }, [router])

  /* ------------------------------------------------- الروابط العميقة */
  useEffect(() => {
    if (!isNativeShell()) return
    let remove: (() => void) | undefined

    void (async () => {
      const { App } = await import('@capacitor/app')
      const handle = await App.addListener('appUrlOpen', ({ url }) => {
        /*
         * يُؤخذ **المسار وحده** من الرابط، ولا يُفتح ما جاء من نطاقٍ آخر.
         *
         * الرابط يصل من خارج التطبيق — من إشعار أو رسالة — فقبولُه كما هو
         * يعني أن يُفتح في غلافنا ما يختاره غيرنا. والمسار الداخليّ يمرّ
         * بالموجّه، فتُطبَّق عليه حراسةُ الصفحات كما لو كُتب في العنوان.
         */
        try {
          const target = new URL(url)
          const origin = new URL(window.location.href).origin
          if (target.origin !== origin) return
          router.push(`${target.pathname}${target.search}`)
        } catch {
          // رابطٌ غير صالح يُهمَل — ولا يُفتح شيء
        }
      })
      remove = () => void handle.remove()
    })()

    return () => remove?.()
  }, [router])

  /* ------------------------------------------- تسجيل الجهاز للدفع الأصيل */
  useEffect(() => {
    if (!isNativeShell()) return
    let removers: Array<() => void> = []

    void (async () => {
      const { PushNotifications } = await import('@capacitor/push-notifications')

      /*
       * لا يُطلب الإذن هنا.
       *
       * الطلب يقع من شاشة التمهيد بضغطةٍ صريحة — ونافذةُ النظام **لا تُعاد**:
       * رفضةٌ واحدة تُغلق الباب. وهنا يُقرأ ما مُنح من قبلُ فحسب، فيُسجَّل
       * الجهاز في كلّ إقلاعٍ ما دام الإذن قائمًا.
       */
      const status = await PushNotifications.checkPermissions().catch(() => null)
      if (status?.receive !== 'granted') return

      const registration = await PushNotifications.addListener(
        'registration',
        (token) => {
          void fetch('/api/push', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              platform: devicePlatform(),
              // رمز APNs/FCM يقوم مقام عنوان الويب — والمفتاحان لا محلّ لهما
              endpoint: token.value,
              keys: null,
              appVersion: appVersion(),
            }),
          }).catch(() => undefined)
        },
      )

      const tapped = await PushNotifications.addListener(
        'pushNotificationActionPerformed',
        (action) => {
          /*
           * الضغط يفتح ما يخصّ الإشعار، ثمّ **يُجلب من الخادم**.
           *
           * ما في حمولة الدفع نصٌّ كُتب لحظةَ الإرسال، وقد مضى عليه وقت —
           * فلا يُعرض سعرًا ولا حالة. الوجهة منه، والحقيقة من الخادم.
           */
          const href = (action.notification.data as { href?: string } | undefined)?.href
          if (typeof href === 'string' && href.startsWith('/')) router.push(href)
        },
      )

      await PushNotifications.register().catch(() => undefined)
      removers = [() => void registration.remove(), () => void tapped.remove()]
    })()

    return () => removers.forEach((remove) => remove())
  }, [router])

  /* ----------------------------- إخفاء الإقلاع عند أوّل تنقّلٍ داخل التطبيق */
  useEffect(() => {
    if (!isNativeShell()) return
    void import('@capacitor/splash-screen')
      .then(({ SplashScreen }) => SplashScreen.hide())
      .catch(() => undefined)
  }, [pathname])

  return null
}
