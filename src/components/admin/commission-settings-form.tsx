'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Info, Loader2, Percent, Receipt, Save, Store, Tag, User } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import {
  computeCommission,
  type CommissionMode,
  type CommissionSettings,
} from '@/lib/domain/types'
import { formatAmount, halalasToRiyals, riyalsToHalalas } from '@/lib/domain/money'

/** أمثلة تُظهر أثر الإعداد على صفقات حقيقية بدل تركه رقمًا مجرّدًا. */
const PREVIEW_PRICES = [10_000, 80_000, 400_000]

type SideForm = {
  enabled: boolean
  mode: CommissionMode
  percent: number
  fixed: number
  min: number
  max: number
}

const toForm = (side: CommissionSettings['seller']): SideForm => ({
  enabled: side.enabled,
  mode: side.mode,
  percent: side.percent,
  fixed: halalasToRiyals(side.fixed),
  min: halalasToRiyals(side.min),
  max: halalasToRiyals(side.max),
})

const toDomain = (side: SideForm) => ({
  enabled: side.enabled,
  mode: side.mode,
  percent: side.percent,
  fixed: riyalsToHalalas(side.fixed),
  min: riyalsToHalalas(side.min),
  max: riyalsToHalalas(side.max),
})

export function CommissionSettingsForm({ settings }: { settings: CommissionSettings }) {
  const router = useRouter()
  const [seller, setSeller] = useState<SideForm>(toForm(settings.seller))
  const [buyer, setBuyer] = useState<SideForm>(toForm(settings.buyer))
  const [vatEnabled, setVatEnabled] = useState(settings.vatEnabled)
  const [vatPercent, setVatPercent] = useState(settings.vatPercent)
  const [busy, setBusy] = useState(false)

  const preview = (price: number) =>
    computeCommission(
      { seller: toDomain(seller), buyer: toDomain(buyer), vatEnabled, vatPercent },
      riyalsToHalalas(price),
    )

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      const response = await fetch('/api/admin/settings/commission', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ seller, buyer, vatEnabled, vatPercent }),
      })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data?.error?.message ?? 'تعذّر حفظ الإعدادات')
        return
      }
      toast.success('حُفظت إعدادات العمولة')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const anyEnabled = seller.enabled || buyer.enabled

  return (
    <form onSubmit={submit} className="space-y-5">
      <p className="flex items-start gap-2.5 rounded-2xl border border-gold-600/40 bg-gold-500/[0.06] p-4 text-xs leading-relaxed text-muted">
        <Receipt className="mt-0.5 size-4 shrink-0 text-gold-500" />
        <span>
          عمولة المشتري تُحصَّل <b className="text-paper">ضمن المبلغ المسدَّد</b> عند السداد،
          وعمولة البائع <b className="text-paper">تُقتطع من عائد البيع</b> لحظة الإفراج. وما
          تعذّر تحصيله تُقيَّد <b className="text-paper">مستحقًّا</b> ولا تتعطّل الصفقة، ويظهر لك
          في «الإيرادات» للتحصيل.
        </span>
      </p>

      <SideCard
        icon={Store}
        title="عمولة البائع"
        hint="تُقتطع من محفظة صاحب اللوحة عند اكتمال بيعها"
        prefix="seller"
        value={seller}
        onChange={setSeller}
      />
      <SideCard
        icon={User}
        title="عمولة المشتري"
        hint="تُقتطع من محفظة المشتري عند اكتمال الصفقة"
        prefix="buyer"
        value={buyer}
        onChange={setBuyer}
      />

      {/* الضريبة */}
      <section className="surface rounded-2xl p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-bold">
              <Percent className="size-4 text-gold-500" />
              ضريبة القيمة المضافة
            </h2>
            <p className="mt-1 text-xs text-muted">
              تُطبَّق على <b className="text-paper">العمولة وحدها</b> لا على قيمة اللوحة: المنصّة
              تبيع وساطة لا تبيع اللوحة، فوعاء الضريبة هو أجر الوساطة.
            </p>
          </div>
          <Switch
            checked={vatEnabled}
            onCheckedChange={setVatEnabled}
            aria-label="تفعيل ضريبة القيمة المضافة"
          />
        </div>

        {vatEnabled && (
          <div className="max-w-xs space-y-1.5">
            <Label htmlFor="vatPercent">النسبة (٪)</Label>
            <Input
              id="vatPercent"
              type="number"
              dir="ltr"
              inputMode="decimal"
              value={String(vatPercent)}
              onChange={(event) => setVatPercent(Number(event.target.value || 0))}
            />
            <p className="text-[11px] text-muted">النسبة النظامية في السعودية 15٪.</p>
          </div>
        )}
      </section>

      {/* المعاينة */}
      <section className="surface rounded-2xl p-5">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-bold text-gold-500">
          <Info className="size-3.5" />
          ما تستحقّه المنصّة على صفقات بأسعار مختلفة
        </p>

        {anyEnabled ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[30rem] text-start text-xs">
              <thead className="text-muted">
                <tr>
                  <th className="p-2 text-start font-semibold">قيمة الصفقة</th>
                  <th className="p-2 text-start font-semibold">من البائع</th>
                  <th className="p-2 text-start font-semibold">من المشتري</th>
                  <th className="p-2 text-start font-semibold">إجمالي المنصّة</th>
                </tr>
              </thead>
              <tbody>
                {PREVIEW_PRICES.map((price) => {
                  const result = preview(price)
                  return (
                    <tr key={price} className="border-t border-ink-600">
                      <td className="p-2 tabular-nums text-muted">{formatAmount(riyalsToHalalas(price))}</td>
                      <td className="p-2 tabular-nums">{formatAmount(result.seller.total)}</td>
                      <td className="p-2 tabular-nums">{formatAmount(result.buyer.total)}</td>
                      <td className="p-2 font-extrabold tabular-nums text-gold-500">
                        {formatAmount(result.total)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted">
            العمولة معطّلة على الطرفين — لا تُقتطع من أحد ولا تُقيَّد إيرادًا.
          </p>
        )}
      </section>

      <Button type="submit" size="lg" disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        حفظ إعدادات العمولة
      </Button>
    </form>
  )
}

function SideCard({
  icon: Icon,
  title,
  hint,
  prefix,
  value,
  onChange,
}: {
  icon: React.ElementType
  title: string
  hint: string
  prefix: string
  value: SideForm
  onChange: (next: SideForm) => void
}) {
  const set = <K extends keyof SideForm>(key: K, next: SideForm[K]) =>
    onChange({ ...value, [key]: next })

  return (
    <section className="surface rounded-2xl p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-bold">
            <Icon className="size-4 text-gold-500" />
            {title}
          </h2>
          <p className="mt-1 text-xs text-muted">{hint}</p>
        </div>
        <Switch
          checked={value.enabled}
          onCheckedChange={(next) => set('enabled', next)}
          aria-label={`تفعيل ${title}`}
        />
      </div>

      {value.enabled && (
        <>
          <div className="mb-4 grid gap-2 sm:grid-cols-2">
            <ModeOption
              active={value.mode === 'percent'}
              onClick={() => set('mode', 'percent')}
              icon={Percent}
              title="نسبة من قيمة الصفقة"
              hint="تتناسب مع سعر اللوحة"
            />
            <ModeOption
              active={value.mode === 'fixed'}
              onClick={() => set('mode', 'fixed')}
              icon={Tag}
              title="مبلغ ثابت"
              hint="رسم واحد مهما كان السعر"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {value.mode === 'percent' ? (
              <NumberField
                id={`${prefix}-percent`}
                label="النسبة (٪)"
                value={value.percent}
                onChange={(next) => set('percent', next)}
              />
            ) : (
              <NumberField
                id={`${prefix}-fixed`}
                label="المبلغ الثابت (ريال)"
                value={value.fixed}
                onChange={(next) => set('fixed', next)}
              />
            )}
            <NumberField
              id={`${prefix}-min`}
              label="أقل عمولة (ريال)"
              hint="صفر يعني بلا حدّ أدنى"
              value={value.min}
              onChange={(next) => set('min', next)}
            />
            <NumberField
              id={`${prefix}-max`}
              label="أقصى عمولة (ريال)"
              hint="صفر يعني بلا سقف"
              value={value.max}
              onChange={(next) => set('max', next)}
            />
          </div>
        </>
      )}
    </section>
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
        'rounded-xl border p-3.5 text-start transition-colors',
        active ? 'border-gold-500 bg-gold-500/10' : 'border-ink-600 bg-ink-900 hover:border-ink-500',
      )}
    >
      <Icon className={cn('mb-1.5 size-4', active ? 'text-gold-500' : 'text-muted')} />
      <p className="text-sm font-bold">{title}</p>
      <p className="mt-0.5 text-[11px] text-muted">{hint}</p>
    </button>
  )
}

function NumberField({
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
        inputMode="decimal"
        value={String(value)}
        onChange={(event) => onChange(Number(event.target.value || 0))}
      />
      {hint && <p className="text-[11px] text-muted">{hint}</p>}
    </div>
  )
}
