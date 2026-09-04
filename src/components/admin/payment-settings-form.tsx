'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { AlertTriangle, CheckCircle2, CreditCard, Building2, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { PaymentSettings, TapMode } from '@/lib/domain/types'

/**
 * إعدادات الدفع.
 *
 * **لا تظهر هنا أي مفاتيح سرّية ولا تُدخَل.** المفاتيح من متغيّرات البيئة
 * وحدها، وما نعرضه هو حالة تهيئتها فقط. الأدمن يختار البيئة العاملة لا المفتاح.
 */
export function PaymentSettingsForm({
  settings,
  tap,
}: {
  settings: PaymentSettings
  /** هل مفتاح كل بيئة مضبوط في متغيّرات البيئة؟ */
  tap: Record<TapMode, boolean>
}) {
  const router = useRouter()
  const [form, setForm] = useState({
    tapEnabled: settings.tapEnabled,
    tapMode: settings.tapMode,
    bankTransferEnabled: settings.bankTransferEnabled,
    bankName: settings.bankName,
    bankAccountName: settings.bankAccountName,
    bankIban: settings.bankIban,
    bankAccountNumber: settings.bankAccountNumber,
    bankInstructions: settings.bankInstructions,
  })
  const [busy, setBusy] = useState(false)

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const activeKeyReady = tap[form.tapMode]

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      const response = await fetch('/api/admin/settings/payments', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data?.error?.message ?? 'تعذّر حفظ الإعدادات')
        return
      }
      toast.success('حُفظت إعدادات الدفع')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    // `method="post"`: ارتدادُ النموذج إلى GET يكتب مفتاح البوابة في الرابط
    <form method="post" onSubmit={submit} className="space-y-5">
      {/* بوابة Tap */}
      <section className="rounded-2xl border border-ink-600 bg-ink-800 p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-bold">
              <CreditCard className="size-4 text-gold-500" />
              بوابة Tap
            </h2>
            <p className="mt-1 text-xs text-muted">
              دفع بالبطاقة يضيف الرصيد فورًا بلا تدخّل منك.
            </p>
          </div>
          <Switch
            checked={form.tapEnabled}
            onCheckedChange={(value) => set('tapEnabled', value)}
            aria-label="تفعيل بوابة Tap"
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-semibold">البيئة العاملة</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <ModeOption
              mode="test"
              selected={form.tapMode === 'test'}
              ready={tap.test}
              onSelect={() => set('tapMode', 'test')}
            />
            <ModeOption
              mode="live"
              selected={form.tapMode === 'live'}
              ready={tap.live}
              onSelect={() => set('tapMode', 'live')}
            />
          </div>
        </fieldset>

        {!activeKeyReady && (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-danger/40 bg-danger/[0.06] p-3 text-xs text-danger">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            مفتاح هذه البيئة غير مضبوط. أضف{' '}
            <code dir="ltr" className="font-bold">
              {form.tapMode === 'live' ? 'TAP_LIVE_SECRET_KEY' : 'TAP_TEST_SECRET_KEY'}
            </code>{' '}
            إلى متغيّرات البيئة وأعد التشغيل — لا يمكن التفعيل بدونه.
          </p>
        )}

        {form.tapEnabled && form.tapMode === 'live' && activeKeyReady && (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-gold-600/50 bg-gold-500/[0.08] p-3 text-xs text-gold-600">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            البيئة الحقيقية مفعّلة — كل عملية دفع تخصم مالًا فعليًا من بطاقة المستخدم.
          </p>
        )}

        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          المفاتيح السرّية تُقرأ من متغيّرات البيئة ولا تُخزَّن في قاعدة البيانات ولا تظهر في
          أي واجهة. عنوان الويبهوك لدى Tap يجب أن يكون{' '}
          <code dir="ltr">/api/webhooks/tap</code>.
        </p>
      </section>

      {/* الحوالة البنكية */}
      <section className="rounded-2xl border border-ink-600 bg-ink-800 p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-bold">
              <Building2 className="size-4 text-gold-500" />
              الحوالة البنكية
            </h2>
            <p className="mt-1 text-xs text-muted">
              تظهر بيانات الحساب للمستخدم، ويُضاف الرصيد بعد تحقّقك من الحوالة.
            </p>
          </div>
          <Switch
            checked={form.bankTransferEnabled}
            onCheckedChange={(value) => set('bankTransferEnabled', value)}
            aria-label="تفعيل الحوالة البنكية"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="bankName"
            label="اسم البنك"
            value={form.bankName}
            onChange={(value) => set('bankName', value)}
            placeholder="مصرف الراجحي"
          />
          <Field
            id="bankAccountName"
            label="اسم صاحب الحساب"
            value={form.bankAccountName}
            onChange={(value) => set('bankAccountName', value)}
            placeholder="شركة سوق اللوحات"
          />
          <Field
            id="bankIban"
            label="الآيبان"
            value={form.bankIban}
            onChange={(value) => set('bankIban', value.toUpperCase())}
            placeholder="SA0000000000000000000000"
            ltr
          />
          <Field
            id="bankAccountNumber"
            label="رقم الحساب (اختياري)"
            value={form.bankAccountNumber}
            onChange={(value) => set('bankAccountNumber', value)}
            ltr
          />
        </div>

        <div className="mt-4 space-y-1.5">
          <Label htmlFor="bankInstructions">تعليمات إضافية للمستخدم</Label>
          <textarea
            id="bankInstructions"
            value={form.bankInstructions}
            onChange={(event) => set('bankInstructions', event.target.value)}
            rows={3}
            maxLength={400}
            placeholder="مثال: قد يستغرق التحقّق من الحوالة يوم عمل واحد."
            className="w-full rounded-xl border border-ink-600 bg-ink-900 px-3 py-2 text-base outline-none focus-visible:border-gold-600 sm:text-sm"
          />
        </div>

        {form.bankTransferEnabled && !form.bankIban && (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-danger/40 bg-danger/[0.06] p-3 text-xs text-danger">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            بلا آيبان لن يظهر خيار الحوالة للمستخدم — لن نعرض حسابًا ناقصًا يُحوّل إليه.
          </p>
        )}
      </section>

      <Button type="submit" size="lg" disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        حفظ الإعدادات
      </Button>
    </form>
  )
}

function ModeOption({
  mode,
  selected,
  ready,
  onSelect,
}: {
  mode: TapMode
  selected: boolean
  ready: boolean
  onSelect: () => void
}) {
  const live = mode === 'live'
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex items-start gap-3 rounded-xl border p-3 text-start transition-colors',
        selected ? 'border-gold-600 bg-gold-500/[0.07]' : 'border-ink-600 hover:border-ink-500',
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2 font-bold">
          {live ? 'حقيقية' : 'تجريبية'}
          <Badge variant={ready ? 'success' : 'danger'}>
            {ready ? (
              <>
                <CheckCircle2 className="size-3" /> المفتاح مضبوط
              </>
            ) : (
              <>
                <AlertTriangle className="size-3" /> بلا مفتاح
              </>
            )}
          </Badge>
        </span>
        <span className="mt-0.5 block text-xs text-muted">
          {live ? 'عمليات دفع فعلية بأموال حقيقية' : 'بطاقات اختبار Tap بلا خصم فعلي'}
        </span>
      </span>
    </button>
  )
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  ltr,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  ltr?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        dir={ltr ? 'ltr' : undefined}
      />
    </div>
  )
}
