'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Bot, Globe, Loader2, Save, Search, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { BrandSettings } from '@/lib/domain/types'
import { Field, Section } from './brand-settings-form'
import { cn } from '@/lib/utils'

/** ما تقصّه محرّكات البحث عمليًّا — لا حدّ معياريّ بل عرضُ النتيجة. */
const TITLE_MAX = 60
const DESCRIPTION_MAX = 155

/**
 * ما تقرؤه الآلة عن المنصّة.
 *
 * ثلاث جهات وثلاث حاجات: **البحث** يريد عنوانًا ووصفًا لا يُقصّان،
 * و**الإجابة** تريد كيانًا بحدود — اسمًا نظاميًّا وروابط تُثبت أنّه هو نفسه
 * في مواضع أخرى — و**التوليد** يريد موضعًا: أين تعمل هذه المنصّة ولمن.
 *
 * والعدّادات هنا ليست زينة: عنوانٌ يتجاوز الحدّ يُقصّ بثلاث نقاط في نتيجة
 * البحث، ووصفٌ يتجاوزه يُقطع في منتصف جملة. ورؤية ذلك وأنت تكتب خيرٌ من
 * اكتشافه بعد أسبوع من الأرشفة.
 */
export function SeoSettingsForm({ settings }: { settings: BrandSettings }) {
  const router = useRouter()
  const [form, setForm] = useState(settings)
  const [busy, setBusy] = useState(false)

  const set = <K extends keyof BrandSettings>(key: K, value: BrandSettings[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      const response = await fetch('/api/admin/settings/brand', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          // الهويّة تُرسَل كما هي: النموذجان يكتبان في سجلٍّ واحد
          name: form.name,
          shortName: form.shortName,
          heroBadge: form.heroBadge,
          heroTitle: form.heroTitle,
          heroHighlight: form.heroHighlight,
          heroBody: form.heroBody,
          primaryColor: form.primaryColor,
          metaTitle: form.metaTitle,
          metaDescription: form.metaDescription,
          keywords: form.keywords,
          legalName: form.legalName,
          sameAs: form.sameAs,
          geoRegion: form.geoRegion,
          geoPlace: form.geoPlace,
          googleSiteVerification: form.googleSiteVerification,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data?.error?.message ?? 'تعذّر الحفظ')
        return
      }
      toast.success('حُفظت إعدادات الأرشفة')
      router.refresh()
    } catch {
      toast.error('تعذّر الاتصال — تحقّق من الشبكة وأعد المحاولة')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Section
        icon={Search}
        title="نتيجة البحث"
        hint="ما يظهر في جوجل. اكتبه كما تريد أن يُقرأ، لا كما تُكرَّر فيه الكلمات."
      >
        <div className="space-y-4">
          <Counted
            label="عنوان الصفحة"
            value={form.metaTitle}
            onChange={(v) => set('metaTitle', v)}
            max={TITLE_MAX}
          />
          <Counted
            label="الوصف"
            value={form.metaDescription}
            onChange={(v) => set('metaDescription', v)}
            max={DESCRIPTION_MAX}
            rows={3}
          />

          {/* معاينةٌ بهيئة النتيجة نفسها — يُرى فيها القصّ قبل أن يقع */}
          <div className="rounded-xl border border-ink-600 bg-ink-900/60 p-4">
            <p className="mb-2 text-[11px] font-bold text-muted">هكذا تظهر في جوجل</p>
            <p className="truncate text-xs text-success">{form.name}</p>
            <p className="truncate text-base font-semibold text-[#1a0dab] dark:text-sky-400">
              {form.metaTitle.slice(0, TITLE_MAX)}
              {form.metaTitle.length > TITLE_MAX && '…'}
            </p>
            <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted">
              {form.metaDescription.slice(0, DESCRIPTION_MAX)}
              {form.metaDescription.length > DESCRIPTION_MAX && '…'}
            </p>
          </div>

          <ListField
            label="الكلمات المفتاحية"
            hint="بفاصلة بينها. لا ترفع ترتيبك وحدها، لكنّها تصف الصفحة لمن يفهرسها."
            values={form.keywords}
            onChange={(v) => set('keywords', v)}
            placeholder="لوحات مميزة، مزاد لوحات"
          />
        </div>
      </Section>

      <Section
        icon={Bot}
        title="محرّكات الإجابة"
        hint="ما يُبنى منه تعريف الكيان في البيانات المنظَّمة — تقرؤه المساعدات التي تجيب بلا نقرة."
      >
        <div className="space-y-4">
          <Field
            label="الاسم النظامي"
            value={form.legalName}
            onChange={(v) => set('legalName', v)}
            hint="اسم المنشأة في السجل التجاري، إن اختلف عن اسم المنصّة"
          />
          <ListField
            label="الحسابات الرسمية"
            hint="روابط كاملة، بفاصلة بينها. تربط المنصّة بمواضعها الأخرى فتُعرَف كيانًا واحدًا."
            values={form.sameAs}
            onChange={(v) => set('sameAs', v)}
            placeholder="https://x.com/... ، https://instagram.com/..."
            dir="ltr"
          />
        </div>
      </Section>

      <Section
        icon={Globe}
        title="الموضع"
        hint="لمن تعمل هذه المنصّة وأين — يُقرأ في نتائج البحث المحلّي وفي إجابات المساعدات."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="رمز المنطقة"
            value={form.geoRegion}
            onChange={(v) => set('geoRegion', v)}
            dir="ltr"
            hint="ISO 3166-2 — مثل SA أو SA-01"
            placeholder="SA-01"
          />
          <Field
            label="المكان كما يُقرأ"
            value={form.geoPlace}
            onChange={(v) => set('geoPlace', v)}
            placeholder="الرياض، السعودية"
          />
        </div>
      </Section>

      <Section icon={Share2} title="التحقّق من الملكية" hint="رمز أدوات مشرفي المواقع لدى جوجل.">
        <Field
          label="Google site verification"
          value={form.googleSiteVerification}
          onChange={(v) => set('googleSiteVerification', v)}
          dir="ltr"
          hint="المحتوى وحده، لا الوسم كاملًا"
        />
      </Section>

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          حفظ إعدادات الأرشفة
        </Button>
      </div>
    </form>
  )
}

function Counted({
  label,
  value,
  onChange,
  max,
  rows,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  max: number
  rows?: number
}) {
  const id = `c-${label.replace(/\s/g, '-')}`
  const over = value.length > max
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <span className={cn('text-[11px] tabular-nums', over ? 'font-bold text-danger' : 'text-muted')}>
          {value.length} / {max}
        </span>
      </div>
      {rows ? (
        <Textarea id={id} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
      {over && <p className="text-[11px] font-semibold text-danger">يُقصّ في نتيجة البحث</p>}
    </div>
  )
}

/** قائمةٌ تُكتب سطرًا واحدًا بفواصل — أبسط من صفٍّ من الحقول لعناصر قليلة. */
function ListField({
  label,
  hint,
  values,
  onChange,
  placeholder,
  dir,
}: {
  label: string
  hint: string
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  dir?: 'ltr'
}) {
  const id = `l-${label.replace(/\s/g, '-')}`
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        dir={dir}
        rows={2}
        value={values.join('، ')}
        placeholder={placeholder}
        onChange={(event) =>
          onChange(
            event.target.value
              .split(/[،,\n]/)
              .map((entry) => entry.trim())
              .filter(Boolean),
          )
        }
      />
      <p className="text-[11px] leading-relaxed text-muted">{hint}</p>
    </div>
  )
}
