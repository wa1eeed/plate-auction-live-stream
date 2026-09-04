'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Gavel, Info, Loader2, Percent, Save, ShieldCheck, ShieldX, Timer } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { computeDeposit, type AuctionSettings, type DepositMode } from '@/lib/domain/types'
import { formatAmount, halalasToRiyals, riyalsToHalalas } from '@/lib/domain/money'

/** أمثلة تُظهر أثر الإعداد على أسعار حقيقية بدل تركه رقمًا مجرّدًا. */
const PREVIEW_PRICES = [10_000, 50_000, 250_000]

export function AuctionSettingsForm({ settings }: { settings: AuctionSettings }) {
  const router = useRouter()
  const [form, setForm] = useState({
    depositMode: settings.depositMode,
    depositFixed: halalasToRiyals(settings.depositFixed),
    depositPercent: settings.depositPercent,
    depositMin: halalasToRiyals(settings.depositMin),
    depositMax: halalasToRiyals(settings.depositMax),
    paymentWindowHours: settings.paymentWindowHours,
    forfeitPercent: settings.forfeitPercent,
    forfeitUndoWindowHours: settings.forfeitUndoWindowHours,
    escrowTransferWindowHours: settings.escrowTransferWindowHours,
    escrowReviewWindowHours: settings.escrowReviewWindowHours,
    extensionTriggerSeconds: settings.extensionTriggerSeconds,
    extensionDurationSeconds: settings.extensionDurationSeconds,
    extensionResetsTimer: settings.extensionResetsTimer,
    allowCustomBid: settings.allowCustomBid,
  })
  const [busy, setBusy] = useState(false)

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const previewFor = (price: number) =>
    computeDeposit(
      {
        depositMode: form.depositMode,
        depositFixed: riyalsToHalalas(form.depositFixed),
        depositPercent: form.depositPercent,
        depositMin: riyalsToHalalas(form.depositMin),
        depositMax: riyalsToHalalas(form.depositMax),
      },
      riyalsToHalalas(price),
    )

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      const response = await fetch('/api/admin/settings/auction', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data?.error?.message ?? 'تعذّر حفظ الإعدادات')
        return
      }
      toast.success('حُفظت قواعد المزاد')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <p className="flex items-start gap-2.5 rounded-2xl border border-gold-600/40 bg-gold-500/[0.06] p-4 text-xs leading-relaxed text-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-gold-500" />
        <span>
          هذه قواعد <b className="text-paper">موحّدة على كل المزادات</b> ولا يملك البائع تغييرها.
          تُطبَّق على ما يُنشر بعد الحفظ؛ المزادات الجارية تحتفظ بقواعدها وقت نشرها فلا يتغيّر
          عربون محجوز ولا مهلة سارية.
        </span>
      </p>

      {/* العربون */}
      <section className="surface rounded-2xl p-5">
        <h2 className="mb-1 flex items-center gap-2 font-bold">
          <ShieldCheck className="size-4 text-gold-500" />
          العربون
        </h2>
        <p className="mb-4 text-xs text-muted">
          يُحجز من رصيد المزايد عند أول مزايدة، ويُحسب مرّة واحدة عند نشر الإعلان.
        </p>

        <div className="mb-4 grid gap-2 sm:grid-cols-2">
          <ModeOption
            active={form.depositMode === 'percent'}
            onClick={() => set('depositMode', 'percent' as DepositMode)}
            icon={Percent}
            title="نسبة من السعر الافتتاحي"
            hint="يتناسب مع قيمة اللوحة — لوحة بمليون لا تُحجز بعربون لوحة بألف"
          />
          <ModeOption
            active={form.depositMode === 'fixed'}
            onClick={() => set('depositMode', 'fixed' as DepositMode)}
            icon={Gavel}
            title="مبلغ ثابت"
            hint="عربون واحد لكل المزادات مهما اختلفت قيمتها"
          />
        </div>

        {form.depositMode === 'percent' ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              id="depositPercent"
              label="النسبة (٪)"
              value={form.depositPercent}
              onChange={(v) => set('depositPercent', v)}
            />
            <Field
              id="depositMin"
              label="أقل عربون (ريال)"
              value={form.depositMin}
              onChange={(v) => set('depositMin', v)}
            />
            <Field
              id="depositMax"
              label="أقصى عربون (ريال)"
              value={form.depositMax}
              onChange={(v) => set('depositMax', v)}
            />
          </div>
        ) : (
          <Field
            id="depositFixed"
            label="العربون الثابت (ريال)"
            value={form.depositFixed}
            onChange={(v) => set('depositFixed', v)}
          />
        )}

        {/* معاينة الأثر */}
        <div className="mt-4 rounded-xl border border-ink-600 bg-ink-900/60 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-gold-500">
            <Info className="size-3" />
            العربون المطلوب على أسعار افتتاحية مختلفة
          </p>
          <dl className="grid grid-cols-3 gap-2 text-xs">
            {PREVIEW_PRICES.map((price) => (
              <div key={price} className="rounded-lg bg-ink-800 p-2.5 text-center">
                <dt className="text-[11px] text-muted">{price.toLocaleString('en-US')} ريال</dt>
                <dd className="mt-0.5 font-extrabold tabular-nums text-gold-500">
                  {formatAmount(previewFor(price))}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* السداد والتمديد */}
      <section className="surface rounded-2xl p-5">
        <h2 className="mb-1 flex items-center gap-2 font-bold">
          <Timer className="size-4 text-gold-500" />
          السداد والتمديد
        </h2>
        <p className="mb-4 text-xs text-muted">
          مهل الصفقة الثلاث — سداد المشتري، ونقل البائع، ومراجعتك أنت — ونافذة
          التمديد التي تمنع الحسم بسرعة اللحظة الأخيرة.
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            id="paymentWindowHours"
            label="مهلة سداد الفائز (ساعة)"
            value={form.paymentWindowHours}
            onChange={(v) => set('paymentWindowHours', v)}
          />
          <Field
            id="escrowTransferWindowHours"
            label="مهلة نقل الملكية (ساعة)"
            value={form.escrowTransferWindowHours}
            onChange={(v) => set('escrowTransferWindowHours', v)}
          />
          <Field
            id="escrowReviewWindowHours"
            label="مهلة مراجعة الإدارة (ساعة)"
            value={form.escrowReviewWindowHours}
            onChange={(v) => set('escrowReviewWindowHours', v)}
          />
          <Field
            id="extensionTriggerSeconds"
            label="نافذة التمديد (ثانية)"
            hint="صفر يعطّل التمديد"
            value={form.extensionTriggerSeconds}
            onChange={(v) => set('extensionTriggerSeconds', v)}
          />
          <Field
            id="extensionDurationSeconds"
            label="مدّة التمديد (ثانية)"
            value={form.extensionDurationSeconds}
            onChange={(v) => set('extensionDurationSeconds', v)}
          />
        </div>

        <div className="mt-4 space-y-3">
          <Toggle
            label="التمديد يعيد ضبط المؤقّت (بدل الإضافة إليه)"
            checked={form.extensionResetsTimer}
            onChange={(v) => set('extensionResetsTimer', v)}
          />
          <Toggle
            label="السماح للمزايد بإدخال مبلغ أعلى يدويًا"
            checked={form.allowCustomBid}
            onChange={(v) => set('allowCustomBid', v)}
          />
        </div>
      </section>

      {/* المصادرة */}
      <section className="surface rounded-2xl p-5">
        <h2 className="mb-1 flex items-center gap-2 font-bold">
          <ShieldX className="size-4 text-danger" />
          مصادرة عربون المتخلّف
        </h2>
        <p className="mb-4 text-xs text-muted">
          ما يُقتطع من عربون الفائز إذا انقضت مهلته دون سداد. المصادرة لا تُتاح قبل انقضاء
          المهلة — والخادم يحرس ذلك لا الواجهة.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="forfeitPercent"
            label="نسبة المصادرة (٪)"
            hint="صفر يعطّل المصادرة تمامًا · 100 يصادر كل العربون"
            value={form.forfeitPercent}
            onChange={(v) => set('forfeitPercent', v)}
          />
          <Field
            id="forfeitUndoWindowHours"
            label="مهلة التراجع عن المصادرة (ساعة)"
            hint="صفر يجعل المصادرة نهائية بلا تراجع"
            value={form.forfeitUndoWindowHours}
            onChange={(v) => set('forfeitUndoWindowHours', v)}
          />
        </div>

        <div className="mt-4 rounded-xl border border-ink-600 bg-ink-900/60 p-3.5">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-gold-500">
            <Info className="size-3.5" />
            أثر النسبة على عربون قدره {formatAmount(previewFor(50_000))} ريال
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Preview
              label="يُصادَر"
              value={Math.round((previewFor(50_000) * clampPercent(form.forfeitPercent)) / 100)}
              tone="danger"
            />
            <Preview
              label="يعود للمزايد"
              value={
                previewFor(50_000) -
                Math.round((previewFor(50_000) * clampPercent(form.forfeitPercent)) / 100)
              }
              tone="success"
            />
          </div>
        </div>
      </section>

      <Button type="submit" size="lg" disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        حفظ قواعد المزاد
      </Button>
    </form>
  )
}

function ModeOption({
  active,
  onClick,
  icon: Icon,
  title,
  hint,
}: {
  active: boolean
  onClick: () => void
  icon: React.ElementType
  title: string
  hint: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex items-start gap-3 rounded-xl border p-3 text-start transition-colors',
        active ? 'border-gold-600 bg-gold-500/[0.07]' : 'border-ink-600 hover:border-ink-500',
      )}
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', active ? 'text-gold-500' : 'text-muted')} />
      <span className="min-w-0">
        <span className="block font-bold">{title}</span>
        <span className="mt-0.5 block text-xs text-muted">{hint}</span>
      </span>
    </button>
  )
}

function Field({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string
  label: string
  hint?: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        dir="ltr"
        inputMode="numeric"
        value={String(value)}
        onChange={(event) => onChange(Number(event.target.value || 0))}
      />
      {hint && <p className="text-[11px] text-muted">{hint}</p>}
    </div>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-xl border border-ink-600 bg-ink-900/60 p-3">
      <span className="text-sm font-semibold">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  )
}


const clampPercent = (value: number) => Math.max(0, Math.min(100, value))

function Preview({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'danger' | 'success'
}) {
  return (
    <div className="rounded-lg border border-ink-600 bg-ink-800 p-2.5 text-center">
      <p className="text-muted">{label}</p>
      <p
        className={cn(
          'mt-0.5 font-extrabold tabular-nums',
          tone === 'danger' ? 'text-danger' : 'text-success',
        )}
      >
        {formatAmount(value)}
        <span className="ms-1 text-[10px] font-normal text-muted">ريال</span>
      </p>
    </div>
  )
}
