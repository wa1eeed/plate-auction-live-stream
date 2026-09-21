'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { BellOff, BellRing, Loader2, Save, ShieldAlert, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  NOTIFICATION_TYPE_LABELS,
  PUSH_TEMPLATE_VARIABLES,
  type MobileSettings,
} from '@/lib/domain/types'
import { cn } from '@/lib/utils'

type Draft = Omit<MobileSettings, 'updatedAt' | 'updatedByAdminId'>

const PLATFORM_LABELS: Record<string, string> = {
  web: 'الويب',
  ios: 'آيفون',
  android: 'أندرويد',
}

/**
 * إعدادات التطبيق — ما يُدفَع ونصُّه، والأجهزة، والنسخ.
 *
 * ونصُّ القالب يُحفظ في السجلّ لا في الكود: تبديل عبارةٍ في إشعارٍ يصل ألفَ
 * جهاز لا ينبغي أن ينتظر نشرةً جديدة. وما يحتاج نشرةً — الأيقونة الأصيلة،
 * ومعرّف الحزمة، والأذونات — لا يُعرض هنا كي لا يُظنّ أنّه يُبدَّل بضغطة.
 */
export function MobileSettingsForm({
  settings,
  devices,
  webPushReady,
  nativePushReady,
  applePushReady,
}: {
  settings: MobileSettings
  devices: Record<string, number>
  webPushReady: boolean
  /** أندرويد عبر FCM */
  nativePushReady: boolean
  /** iOS عبر APNs مباشرةً — قناةٌ مستقلّة لا تمرّ بـFCM */
  applePushReady: boolean
}) {
  const router = useRouter()
  const [form, setForm] = useState<Draft>({
    pushTypes: settings.pushTypes,
    minVersion: settings.minVersion,
    recommendedVersion: settings.recommendedVersion,
  })
  const [busy, setBusy] = useState(false)

  const total = Object.values(devices).reduce((sum, count) => sum + count, 0)
  const types = Object.entries(form.pushTypes)

  function setTemplate(key: string, patch: Partial<Draft['pushTypes'][string]>) {
    setForm((current) => ({
      ...current,
      pushTypes: { ...current.pushTypes, [key]: { ...current.pushTypes[key], ...patch } },
    }))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      const response = await fetch('/api/admin/settings/mobile', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data?.error?.message ?? 'تعذّر الحفظ')
        return
      }
      toast.success('حُفظت إعدادات التطبيق')
      router.refresh()
    } catch {
      toast.error('تعذّر الاتصال — أعد المحاولة')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {/* ------------------------------------------------------ نظرة عامة */}
      <section className="rounded-2xl border border-ink-600 bg-ink-800 p-4">
        <h2 className="mb-3 text-sm font-bold">نظرة عامة</h2>

        {(!webPushReady || !nativePushReady || !applePushReady) && (
          /*
           * تهيئةٌ ناقصة تُقال صراحةً.
           *
           * بلا مفاتيح VAPID لا يُرسَل شيء — ولا يظهر للمستخدم مفتاحُ تفعيل
           * أصلًا. ومنصّةٌ تظنّ أنّها تُنبّه ولا أحد يصله شيء أسوأ من واحدةٍ
           * تقول «لا دفع هنا».
           */
          <p className="mb-3 flex items-start gap-2 rounded-xl border border-danger/50 bg-danger/10 px-3 py-2 text-[12px] leading-relaxed text-danger">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <span>
              {!webPushReady && (
                <>
                  <b>دفع الويب معطّل</b> — لم تُضبط <code className="font-mono">VAPID_PUBLIC_KEY</code>{' '}
                  و<code className="font-mono">VAPID_PRIVATE_KEY</code>.{' '}
                </>
              )}
              {!nativePushReady && (
                <>
                  <b>دفع أندرويد معطّل</b> — لم يُضبط حساب خدمة{' '}
                  <code className="font-mono">FCM_PROJECT_ID</code> و
                  <code className="font-mono">FCM_CLIENT_EMAIL</code> و
                  <code className="font-mono">FCM_PRIVATE_KEY</code>.{' '}
                </>
              )}
              {!applePushReady && (
                <>
                  <b>دفع iOS معطّل</b> — لم يُضبط مفتاح APNs:{' '}
                  <code className="font-mono">APNS_KEY_ID</code> و
                  <code className="font-mono">APNS_TEAM_ID</code> و
                  <code className="font-mono">APNS_KEY_P8</code>.{' '}
                </>
              )}
              وما يُحفظ هنا يبقى محفوظًا ويعمل متى ضُبطت.
            </span>
          </p>
        )}

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="أجهزة مسجَّلة" value={total} icon={Smartphone} />
          {Object.entries(PLATFORM_LABELS).map(([key, label]) => (
            <Stat key={key} label={label} value={devices[key] ?? 0} />
          ))}
        </dl>
      </section>

      {/* -------------------------------------------- الإشعارات وقوالبها */}
      <section className="rounded-2xl border border-ink-600 bg-ink-800 p-4">
        <h2 className="text-sm font-bold">الإشعارات وقوالبها</h2>
        <p className="mb-4 mt-1 text-[12px] leading-relaxed text-muted">
          ما يُدفَع إلى جهازٍ مقفل. والمطفأ يبقى في الجرس يُقرأ متى فُتحت المنصّة.
          المتغيّرات المسموحة: {PUSH_TEMPLATE_VARIABLES.join('، ')} — وهي بياناتٌ علنية.
          {/*
            * ولا تُتاح المبالغ: الحمولة تمرّ بخادم صانع المتصفّح، وسومُ غيرك
            * محجوبٌ عنك في الواجهة — فوضعُه هنا يهدم الحجب من بابٍ آخر.
            */}
          <strong className="text-paper"> ولا تُتاح المبالغ.</strong>
        </p>

        <div className="space-y-3">
          {types.map(([key, template]) => (
            <div
              key={key}
              className={cn(
                'rounded-xl border p-3 transition-colors',
                template.enabled ? 'border-ink-600 bg-ink-900/40' : 'border-ink-700 bg-ink-900/20',
              )}
            >
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-[13px] font-bold">
                  {template.enabled ? (
                    <BellRing className="size-3.5 text-gold-500" />
                  ) : (
                    <BellOff className="size-3.5 text-muted" />
                  )}
                  {NOTIFICATION_TYPE_LABELS[key] ?? key}
                </span>
                <Switch
                  checked={template.enabled}
                  aria-label={`دفع ${NOTIFICATION_TYPE_LABELS[key] ?? key}`}
                  onCheckedChange={(enabled) => setTemplate(key, { enabled })}
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                <Input
                  value={template.title}
                  disabled={!template.enabled}
                  maxLength={60}
                  aria-label="العنوان"
                  placeholder="العنوان"
                  onChange={(event) => setTemplate(key, { title: event.target.value })}
                />
                <Input
                  value={template.body}
                  disabled={!template.enabled}
                  maxLength={160}
                  aria-label="النصّ"
                  placeholder="النصّ"
                  onChange={(event) => setTemplate(key, { body: event.target.value })}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------- نسخ التطبيق */}
      <section className="rounded-2xl border border-ink-600 bg-ink-800 p-4">
        <h2 className="text-sm font-bold">نسخ التطبيق</h2>
        <p className="mb-4 mt-1 text-[12px] leading-relaxed text-muted">
          تُحفظ ولا تُلزِم أحدًا اليوم. البنية جاهزة لإلزامٍ لاحق، ولا يقع بلا إعدادٍ صريح:
          تطبيقٌ يوقف صاحبه عن المزايدة لأنّ رقمًا في الخادم تبدّل خطرٌ لا يُتحمَّل.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="minVersion">أقلّ نسخة مدعومة</Label>
            <Input
              id="minVersion"
              dir="ltr"
              placeholder="1.0.0"
              value={form.minVersion ?? ''}
              onChange={(event) =>
                setForm((current) => ({ ...current, minVersion: event.target.value || null }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="recommendedVersion">النسخة المستحسنة</Label>
            <Input
              id="recommendedVersion"
              dir="ltr"
              placeholder="1.2.0"
              value={form.recommendedVersion ?? ''}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  recommendedVersion: event.target.value || null,
                }))
              }
            />
          </div>
        </div>
      </section>

      <Button type="submit" size="lg" disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        حفظ
      </Button>
    </form>
  )
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: number
  icon?: React.ElementType
}) {
  return (
    <div className="rounded-xl border border-ink-600 bg-ink-900/40 px-3 py-2.5">
      <dt className="flex items-center gap-1.5 text-[11px] text-muted">
        {Icon && <Icon className="size-3" />}
        {label}
      </dt>
      <dd className="mt-0.5 text-lg font-bold tabular-nums">{value}</dd>
    </div>
  )
}
