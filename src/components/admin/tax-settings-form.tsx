'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Building2, CircleCheckBig, Loader2, Save, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { TaxSettings } from '@/lib/domain/types'
import { isValidCrNumber, isValidVatNumber } from '@/lib/domain/zatca'

/**
 * بيانات المنشأة الضريبية.
 *
 * ما يُكتب هنا يُنسخ في **كل فاتورة** تصدر بعده، ولا يُعدَّل فيما صدر. ولذلك
 * يُتحقّق من الرقم الضريبي وأنت تكتبه لا عند أوّل فاتورة مرفوضة: خانةٌ ناقصة
 * تُكتشف في ثانيتها لا بعد مئة فاتورة.
 */
export function TaxSettingsForm({ settings }: { settings: TaxSettings }) {
  const router = useRouter()
  const [form, setForm] = useState(settings)
  const [busy, setBusy] = useState(false)

  const set = <K extends keyof TaxSettings>(key: K, value: TaxSettings[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const vatOk = isValidVatNumber(form.vatNumber)
  const crOk = !form.crNumber || isValidCrNumber(form.crNumber)
  const ready = Boolean(form.legalName && form.city) && vatOk && crOk

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      const response = await fetch('/api/admin/settings/tax', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          enabled: form.enabled,
          legalName: form.legalName,
          vatNumber: form.vatNumber,
          crNumber: form.crNumber,
          street: form.street,
          buildingNumber: form.buildingNumber,
          district: form.district,
          city: form.city,
          postalCode: form.postalCode,
          additionalNumber: form.additionalNumber,
          country: form.country,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data?.error?.message ?? 'تعذّر حفظ بيانات المنشأة')
        return
      }
      toast.success('حُفظت بيانات المنشأة الضريبية')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <section className="surface rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 font-bold">
              <Building2 className="size-4 text-gold-500" />
              الفوترة الإلكترونية
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              فاتورة ضريبية مبسّطة عن كل عمولة، برمز QR بترميز TLV وسلسلة تجزئة تربط كل فاتورة
              بسابقتها. والتوريد الخاضع هو الوساطة لا قيمة اللوحة.
            </p>
          </div>
          <Switch
            checked={form.enabled}
            onCheckedChange={(value) => set('enabled', value)}
            aria-label="تفعيل الفوترة الضريبية"
          />
        </div>

        {form.enabled && !ready && (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-danger/40 bg-danger/[0.06] p-3 text-xs leading-relaxed text-danger">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            أكمل اسم المنشأة ورقمها الضريبي ومدينتها. ولا تُصدَر فاتورة ببيانات ناقصة — الامتناع
            أسلم من إصدار باطل.
          </p>
        )}
      </section>

      <section className="surface space-y-4 rounded-2xl p-5">
        <h3 className="font-bold">هوية المنشأة</h3>

        <div className="space-y-1.5">
          <Label htmlFor="tax-legal-name">الاسم النظامي</Label>
          <Input
            id="tax-legal-name"
            value={form.legalName}
            onChange={(event) => set('legalName', event.target.value)}
            placeholder="كما في السجل الضريبي"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="tax-vat-number">الرقم الضريبي</Label>
            <Input
              id="tax-vat-number"
              dir="ltr"
              inputMode="numeric"
              maxLength={15}
              value={form.vatNumber}
              onChange={(event) => set('vatNumber', event.target.value.replace(/\D/g, ''))}
              placeholder="300000000000003"
              className={cn(form.vatNumber && !vatOk && 'border-danger')}
            />
            <p
              className={cn(
                'flex items-center gap-1.5 text-xs',
                form.vatNumber ? (vatOk ? 'text-success' : 'text-danger') : 'text-muted',
              )}
            >
              {form.vatNumber && vatOk && <CircleCheckBig className="size-3.5" />}
              خمس عشرة خانة، تبدأ بـ3 وتنتهي بـ3، والخانة الحادية عشرة 1.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tax-cr-number">الرقم الموحّد للمنشأة</Label>
            <Input
              id="tax-cr-number"
              dir="ltr"
              inputMode="numeric"
              maxLength={10}
              value={form.crNumber}
              onChange={(event) => set('crNumber', event.target.value.replace(/\D/g, ''))}
              placeholder="7000000000"
              className={cn(form.crNumber && !crOk && 'border-danger')}
            />
            <p className="text-xs text-muted">عشر خانات — اختياري.</p>
          </div>
        </div>
      </section>

      <section className="surface space-y-4 rounded-2xl p-5">
        <h3 className="font-bold">العنوان الوطني</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="tax-building" label="رقم المبنى" value={form.buildingNumber} onChange={(v) => set('buildingNumber', v)} numeric />
          <Field id="tax-street" label="الشارع" value={form.street} onChange={(v) => set('street', v)} />
          <Field id="tax-district" label="الحي" value={form.district} onChange={(v) => set('district', v)} />
          <Field id="tax-city" label="المدينة" value={form.city} onChange={(v) => set('city', v)} />
          <Field id="tax-postal" label="الرمز البريدي" value={form.postalCode} onChange={(v) => set('postalCode', v)} numeric />
          <Field id="tax-additional" label="الرقم الإضافي" value={form.additionalNumber} onChange={(v) => set('additionalNumber', v)} numeric />
          <Field id="tax-country" label="الدولة" value={form.country} onChange={(v) => set('country', v)} />
        </div>
      </section>

      {/*
        * ما تبقّى للمرحلة الثانية.
        *
        * قولُه هنا يمنع ظنّ الاكتمال: ما بُني يغطّي الإصدار، والربط يحتاج
        * شهادة من الهيئة — وهي إجراءُ منشأة لا سطرُ برمجة.
        */}
      <p className="rounded-2xl border border-ink-600 bg-ink-900/50 p-4 text-xs leading-relaxed text-muted">
        هذا يغطّي <b className="text-paper">مرحلة الإصدار</b>: الحقول الإلزامية ورمز QR وسلسلة
        التجزئة. أمّا <b className="text-paper">الربط والتكامل</b> فيحتاج شهادة تشفير معتمدة من
        الهيئة وربطًا بمنصّة «فاتورة» — تُستخرج باسم المنشأة ثم تُضاف في متغيّرات البيئة.
      </p>

      <Button type="submit" disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        حفظ
      </Button>
    </form>
  )
}

function Field({
  id,
  label,
  value,
  onChange,
  numeric = false,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  numeric?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        dir={numeric ? 'ltr' : undefined}
        inputMode={numeric ? 'numeric' : undefined}
        onChange={(event) => onChange(numeric ? event.target.value.replace(/\D/g, '') : event.target.value)}
      />
    </div>
  )
}
