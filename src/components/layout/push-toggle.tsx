'use client'

import { useCallback, useEffect, useState } from 'react'
import { BellOff, BellRing, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'

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

  const supported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window

  useEffect(() => {
    let alive = true

    void (async () => {
      if (!supported) {
        if (alive) setState('unavailable')
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
       * الاشتراك محفوظٌ عندنا في ملفّ، لكنّ الملفّ قد يُفقد أو يُنشر على
       * خادمٍ جديد بلا حجمٍ مربوط. والجهاز يعرف اشتراكه دائمًا، فإعادتُه
       * تُرمّم ما ضاع بلا أن يُسأل صاحبه مرّة أخرى.
       */
      await fetch('/api/push', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(existing.toJSON()),
      }).catch(() => undefined)

      if (alive) setState('on')
    })()

    return () => {
      alive = false
    }
  }, [supported])

  const enable = useCallback(async () => {
    if (!publicKey) return
    setState('busy')
    try {
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
        body: JSON.stringify(subscription.toJSON()),
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

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl px-3 py-2">
      <span className="flex items-center gap-2 text-sm font-semibold text-muted">
        {state === 'busy' ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <BellRing className="size-3.5" />
        )}
        إشعارات الجهاز
      </span>
      <Switch
        checked={state === 'on'}
        disabled={state === 'busy'}
        aria-label="إشعارات الجهاز"
        onCheckedChange={(next) => void (next ? enable() : disable())}
      />
    </div>
  )
}
