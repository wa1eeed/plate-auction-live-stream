'use client'

import { useCallback, useEffect, useState } from 'react'
import { BellOff, BellRing, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { SwitchFace } from '@/components/ui/switch'
import { PushPrimer } from './push-primer'
import {
  appVersion,
  devicePlatform,
  isApplePlatform,
  isNativeShell,
  isStandalone,
} from '@/lib/device'

/**
 * يفكّ ترميز المفتاح العامّ إلى البايتات التي يطلبها المتصفّح.
 *
 * والنوع `ArrayBuffer` صراحةً: `Uint8Array` يقبل مخزنًا مشتركًا في تعريفات
 * TypeScript الحديثة، و`applicationServerKey` لا تقبله.
 */
function decodeKey(base64Url: string): ArrayBuffer {
  const padded = (base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const raw = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i)
  return bytes.buffer
}

type State = 'loading' | 'unavailable' | 'blocked' | 'off' | 'on' | 'busy'

/**
 * إشعارات الجهاز — ما يبلغ صاحبه وهو خارج الصفحة.
 *
 * ولا يُطلب الإذن عند التحميل: نافذةُ إذنٍ تهبط على زائرٍ لم يفعل شيئًا تُرفض
 * في الغالب، والمتصفّح **لا يسأل مرّتين** — فرفضةٌ واحدة تُغلق الباب إلى الأبد
 * ولا يفتحه إلّا إعدادات المتصفّح. فيُطلب بضغطةٍ صريحة على هذا المفتاح.
 *
 * **ولا يظهر شيء** حيث لا ينفع: متصفّحٌ بلا دفع، أو نسخةٌ بلا مفاتيح في
 * بيئتها. وزرٌّ يُضغط فلا يقع شيء أسوأ من غيابه.
 */
export function PushToggle() {
  const [state, setState] = useState<State>('loading')
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [priming, setPriming] = useState(false)

  const supported =
    typeof window !== 'undefined' &&
    // الغلاف الأصيل يدفع بقناته هو، فلا يُشترط فيه ما يشترطه المتصفّح
    (isNativeShell() ||
      ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window))

  useEffect(() => {
    let alive = true

    void (async () => {
      try {
        if (!supported) {
          if (alive) setState('unavailable')
          return
        }

        /*
         * **الغلاف الأصيل يُفصل أوّلًا — قبل أيّ واجهة ويب.**
         *
         * وكان المسار واحدًا فيمرّ الغلاف بثلاثةٍ لا وجود لها فيه:
         *
         *  ١. `config.publicKey` مفتاح VAPID — للويب وحده. والغلاف يدفع بقناته
         *     (APNs/FCM)، فبلا VAPID كان يُقال «غير متاح» ويُخفى المفتاح.
         *  ٢. `Notification.permission` — و**`Notification` غير معرَّفة في
         *     WKWebView**، فيرمي `ReferenceError`.
         *  ٣. `navigator.serviceWorker.ready` — قد لا يستقرّ، و`pushManager`
         *     لا وجود له.
         *
         * والثانية هي القاتلة: الـeffect كان بلا `try`، فيُرمى الاستثناء
         * وتبقى الحالة `loading` — و`loading` تعني `return null`. **فلا يُرسم
         * مفتاحٌ إطلاقًا، ولا يُمنح إذن، ولا يُسجَّل جهاز، ولا يصل إشعار** —
         * وكلُّه بلا رسالةِ خطأ واحدة.
         */
        if (isNativeShell()) {
          const { PushNotifications } = await import('@capacitor/push-notifications')
          const status = await PushNotifications.checkPermissions().catch(() => null)
          if (!alive) return
          if (status?.receive === 'granted') {
            /* ممنوحٌ سلفًا: يُسجَّل في `NativeShell` عند كلّ إقلاع */
            setState('on')
          } else if (status?.receive === 'denied') {
            setState('blocked')
          } else {
            setState('off')
          }
          return
        }

        const config = await fetch('/api/push', { cache: 'no-store' })
          .then((response) => (response.ok ? response.json() : null))
          .catch(() => null)

        if (!alive) return
        if (!config?.enabled || !config.publicKey) {
          setState('unavailable')
          return
        }
        setPublicKey(config.publicKey)

        if (Notification.permission === 'denied') {
          setState('blocked')
          return
        }

        const registration = await navigator.serviceWorker.ready.catch(() => null)
        const existing = await registration?.pushManager.getSubscription().catch(() => null)
        if (!alive) return

        if (!existing) {
          setState('off')
          return
        }

        /*
         * إعادةُ إرسالٍ في كلّ فتح — شفاءٌ ذاتيّ.
         *
         * الاشتراك يعيش في ذاكرة الخادم كما يعيش صاحبه، فيضيع مع كلّ نشرة.
         * والجهاز يعرف اشتراكه دائمًا، فإعادتُه في كلّ فتح تُرمّم ما ضاع بلا أن
         * يُسأل صاحبه مرّة أخرى — وهو ما يُغني عن حفظه على القرص.
         */
        await fetch('/api/push', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ...existing.toJSON(),
            platform: devicePlatform(),
            appVersion: appVersion(),
          }),
        }).catch(() => undefined)

        if (alive) setState('on')
      } catch {
        /*
         * أيّ واجهةٍ ناقصة تُخفي المفتاح صامتةً — فيُعرض «مطفأ» بدل العدم.
         * ومفتاحٌ يُضغط فيُخبر بالعطب خيرٌ من مفتاحٍ لا يُرى.
         */
        if (alive) setState('off')
      }
    })()

    return () => {
      alive = false
    }
  }, [supported])

  const enable = useCallback(async () => {
    setState('busy')
    try {
      /*
       * داخل الغلاف: إذنُ النظام ورمزُ APNs/FCM — لا Web Push.
       *
       * قناتان مختلفتان بالكامل: الويب يشترك عند خادم صانع المتصفّح بمفتاحٍ
       * عامّ ويُشفَّر من طرفٍ إلى طرف، والأصيل يأخذ رمزًا من آبل أو جوجل. ولا
       * يعمل Web Push في غلاف WKWebView أصلًا.
       *
       * والتسجيل يقع في `NativeShell` متى مُنح الإذن — فيُسجَّل الجهاز في كلّ
       * إقلاعٍ لا عند أوّل تفعيلٍ وحده.
       */
      if (isNativeShell()) {
        const { PushNotifications } = await import('@capacitor/push-notifications')
        const granted = await PushNotifications.requestPermissions()
        if (granted.receive !== 'granted') {
          setState(granted.receive === 'denied' ? 'blocked' : 'off')
          return
        }
        await PushNotifications.register()
        setState('on')
        toast.success('ستصلك إشعارات المزايدات والمهل على هذا الجهاز')
        return
      }

      if (!publicKey) {
        setState('off')
        return
      }
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'blocked' : 'off')
        return
      }

      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        // بلا هذا يرفض المتصفّح: لا اشتراك صامتًا بلا إشعارٍ يُعرض
        userVisibleOnly: true,
        applicationServerKey: decodeKey(publicKey),
      })

      const saved = await fetch('/api/push', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...subscription.toJSON(),
          platform: devicePlatform(),
          appVersion: appVersion(),
        }),
      })
      if (!saved.ok) throw new Error('save failed')

      setState('on')
      toast.success('ستصلك إشعارات المزايدات والمهل على هذا الجهاز')
    } catch {
      setState('off')
      toast.error('تعذّر تفعيل الإشعارات على هذا الجهاز')
    }
  }, [publicKey])

  const disable = useCallback(async () => {
    setState('busy')
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await fetch('/api/push', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        }).catch(() => undefined)
        await subscription.unsubscribe().catch(() => undefined)
      }
      setState('off')
    } catch {
      setState('on')
    }
  }, [])

  if (state === 'loading' || state === 'unavailable') return null

  if (state === 'blocked') {
    return (
      <div className="flex items-start gap-2 rounded-xl px-3 py-2 text-[11px] leading-relaxed text-muted">
        <BellOff className="mt-0.5 size-3.5 shrink-0" />
        {/* المتصفّح لا يسأل ثانيةً بعد المنع — فيُقال أين يُرفع لا أن يُعاد الزرّ */}
        <span>
          إشعارات هذا الجهاز ممنوعة من إعدادات المتصفّح. ارفع المنع عن الموقع ثمّ أعد فتح
          الصفحة.
        </span>
      </div>
    )
  }

  /*
   * صفٌّ كامل يُضغط — لا مفتاحٌ صغير في طرفه.
   *
   * وكان المفتاح وحده هو الهدف: عرضُه نصفُ عرض الإبهام، وحوله فراغٌ لا
   * يستجيب. فيُخطئه صاحبه مرّةً ومرّتين فيظنّه معطوبًا.
   *
   * وصار الصفُّ كلُّه هدفًا — بأيقونةٍ ونصٍّ يشرح، ومفتاحٍ يُرى ولا يُضغط
   * وحده. وهو ترتيبُ صفوف الإعدادات في التطبيقات: نظرةٌ تكفي لمعرفة الحال،
   * ولمسةٌ في أيّ موضعٍ تكفي لتبديله.
   */
  const on = state === 'on'
  const busy = state === 'busy'

  return (
    <div className="px-1 py-1">
      <button
        type="button"
        disabled={busy}
        aria-pressed={on}
        onClick={() => (on ? void disable() : setPriming(true))}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start transition-colors hover:bg-ink-700/40 disabled:opacity-60"
      >
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors',
            on ? 'bg-gold-500/15 text-gold-500' : 'border border-ink-600 bg-ink-900 text-muted',
          )}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <BellRing className="size-4" />}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">إشعارات الجهاز</span>
          <span className="mt-0.5 block text-[12px] leading-relaxed text-muted">
            {busy
              ? 'لحظة…'
              : on
                ? 'تصلك تنبيهات المزايدات والمهل'
                : 'فعّلها لتعرف متى تجاوزك أحد'}
          </span>
        </span>

        {/* وجهٌ يُرى ولا يُضغط — الصفُّ كلُّه هو الهدف، وزرٌّ لا يَسَع زرًّا */}
        <SwitchFace checked={on} className={busy ? 'opacity-60' : undefined} />
      </button>

      <PushPrimer
        open={priming}
        onOpenChange={setPriming}
        /* iOS لا يمنح الإذن إلّا لمثبَّتٍ على الشاشة الرئيسية */
        /* داخل الغلاف الأصيل لا شرطَ تثبيتٍ — التطبيق مثبَّتٌ بذاته */
        needsInstallFirst={!isNativeShell() && isApplePlatform() && !isStandalone()}
        onConfirm={() => {
          setPriming(false)
          void enable()
        }}
      />
    </div>
  )
}
