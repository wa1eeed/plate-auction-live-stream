'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, Eye, EyeOff, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SettingsTabs } from './settings-tabs'
import type { EditableDoc, PageSection, PageSettings, PageStep } from '@/lib/domain/types'
import { cn } from '@/lib/utils'

type Draft = Omit<PageSettings, 'updatedAt' | 'updatedByAdminId'>

const GROUPS = [
  {
    title: 'صفحات تعريفية',
    hint: 'صفحاتٌ كاملة بعنوانها وأقسامها — تُضاف أقسامها وتُحذف كما تشاء.',
    tabs: [
      { key: 'about', label: 'من نحن', hint: 'من يشغّل المنصّة وما يلتزم به' },
      { key: 'terms', label: 'الشروط والأحكام', hint: 'ما يوافق عليه المستخدم' },
    ],
  },
  {
    title: 'شرح المنصّة',
    hint: 'ما يقرؤه الزائر ليعرف كيف يبيع ويشتري.',
    tabs: [{ key: 'howItWorks', label: 'كيف تعمل المنصّة', hint: 'خطوات البائع والمشتري والقواعد' }],
  },
  {
    title: 'الواجهة الأولى',
    hint: 'ما يقرؤه الزائر في الصفحة الرئيسية أسفل اللوحات.',
    tabs: [{ key: 'trust', label: 'قسم الطمأنينة', hint: '«بِع واشترِ وأنت مطمئن» وبطاقاته' }],
  },
]

/**
 * نصوص صفحات المنصّة — تُحرَّر هنا لا في الملفّات.
 *
 * التبويبات تعرض قسمًا واحدًا في كل مرّة، والمسوّدة كلّها محفوظةٌ هنا فوقها:
 * من بدّل «من نحن» ثمّ انتقل إلى «الشروط» لا يفقد ما كتب، والحفظ واحدٌ
 * يرسل الأربعة معًا — فلا يُنشر نصفُ تعديل.
 */
export function PagesSettingsForm({ settings }: { settings: PageSettings }) {
  const router = useRouter()
  const [form, setForm] = useState<Draft>(settings)
  const [busy, setBusy] = useState(false)

  const setDoc = (key: 'about' | 'terms', value: EditableDoc) =>
    setForm((current) => ({ ...current, [key]: value }))

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      const response = await fetch('/api/admin/settings/pages', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.error?.message ?? 'تعذّر حفظ الصفحات')
        return
      }
      toast.success('حُفظت صفحات المنصّة')
      router.refresh()
    } catch {
      toast.error('تعذّر الاتصال — تحقّق من الشبكة وأعد المحاولة')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <SettingsTabs groups={GROUPS}>
        {{
          about: (
            <DocEditor
              name="من نحن"
              path="/about"
              doc={form.about}
              onChange={(value) => setDoc('about', value)}
            />
          ),
          terms: (
            <DocEditor
              name="الشروط والأحكام"
              path="/terms"
              doc={form.terms}
              onChange={(value) => setDoc('terms', value)}
            />
          ),
          howItWorks: (
            <HowItWorksEditor
              value={form.howItWorks}
              onChange={(howItWorks) => setForm((current) => ({ ...current, howItWorks }))}
            />
          ),
          trust: (
            <TrustEditor
              value={form.trust}
              onChange={(trust) => setForm((current) => ({ ...current, trust }))}
            />
          ),
        }}
      </SettingsTabs>

      {/*
        * زرّ الحفظ خارج التبويبات.
        *
        * الحمولة واحدة تحمل الأقسام الأربعة، فزرٌّ داخل كل تبويب يوهم بحفظٍ
        * جزئيّ لا يقع. وموضعه هنا يجعله ظاهرًا أيًّا كان المفتوح.
        */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-ink-600 bg-ink-800 p-4">
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          احفظ كل الصفحات
        </Button>
        <p className="text-xs text-muted">يُحفظ ما في التبويبات الأربعة معًا.</p>
      </div>
    </form>
  )
}

/* ------------------------------------------------------------ صفحة حرّة */

function DocEditor({
  name,
  path,
  doc,
  onChange,
}: {
  name: string
  /** مسار الصفحة العلني — يُقال ليُعرف أين يظهر ما يُكتب */
  path: string
  doc: EditableDoc
  onChange: (value: EditableDoc) => void
}) {
  const set = <K extends keyof EditableDoc>(key: K, value: EditableDoc[K]) =>
    onChange({ ...doc, [key]: value })

  const setSection = (index: number, section: PageSection) =>
    set('sections', doc.sections.map((item, i) => (i === index ? section : item)))

  const move = (index: number, by: number) => {
    const next = [...doc.sections]
    const target = index + by
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    set('sections', next)
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-ink-600 bg-ink-800 p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-bold">{name}</h3>
            <p className="mt-1 text-xs text-muted">
              تظهر على{' '}
              <span dir="ltr" className="font-bold text-paper">
                {path}
              </span>
            </p>
          </div>
          {/*
            * النشر زرٌّ لا مفتاحٌ صغير.
            *
            * إخفاء صفحة قرارٌ يُتّخذ ويُرى أثره في التذييل فورًا، فيُكتب بحاله
            * لا برمزٍ يُخمَّن — و«ظاهرة للناس» تُقرأ بلا شرح.
            */}
          <button
            type="button"
            onClick={() => set('published', !doc.published)}
            aria-pressed={doc.published}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-colors',
              doc.published
                ? 'border-success/50 bg-success/10 text-success'
                : 'border-ink-600 bg-ink-900 text-muted hover:text-paper',
            )}
          >
            {doc.published ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
            {doc.published ? 'ظاهرة للناس' : 'مخفيّة'}
          </button>
        </div>

        <div className="space-y-4">
          <Field
            id={`${path}-title`}
            label="عنوان الصفحة"
            value={doc.title}
            onChange={(value) => set('title', value)}
          />
          <AreaField
            id={`${path}-intro`}
            label="سطر تحت العنوان"
            hint="جملة تُقرأ قبل الأقسام — اتركها فارغة إن لم تلزم."
            rows={2}
            value={doc.intro}
            onChange={(value) => set('intro', value)}
          />
        </div>
      </div>

      <div className="space-y-3">
        {doc.sections.map((section, index) => (
          <div key={index} className="rounded-2xl border border-ink-600 bg-ink-800 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-muted">القسم {index + 1}</span>
              <div className="flex items-center gap-1">
                <IconButton label="أعلى" onClick={() => move(index, -1)} disabled={index === 0}>
                  <ArrowUp className="size-3.5" />
                </IconButton>
                <IconButton
                  label="أسفل"
                  onClick={() => move(index, 1)}
                  disabled={index === doc.sections.length - 1}
                >
                  <ArrowDown className="size-3.5" />
                </IconButton>
                <IconButton
                  label="احذف القسم"
                  danger
                  disabled={doc.sections.length <= 1}
                  onClick={() => set('sections', doc.sections.filter((_, i) => i !== index))}
                >
                  <Trash2 className="size-3.5" />
                </IconButton>
              </div>
            </div>
            <div className="space-y-3">
              <Field
                id={`${path}-h-${index}`}
                label="عنوان القسم"
                value={section.heading}
                onChange={(heading) => setSection(index, { ...section, heading })}
              />
              <AreaField
                id={`${path}-b-${index}`}
                label="نصّ القسم"
                rows={4}
                value={section.body}
                onChange={(body) => setSection(index, { ...section, body })}
              />
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          onClick={() => set('sections', [...doc.sections, { heading: '', body: '' }])}
        >
          <Plus className="size-4" />
          أضف قسمًا
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------- كيف تعمل المنصّة */

function HowItWorksEditor({
  value,
  onChange,
}: {
  value: PageSettings['howItWorks']
  onChange: (value: PageSettings['howItWorks']) => void
}) {
  const set = <K extends keyof PageSettings['howItWorks']>(
    key: K,
    next: PageSettings['howItWorks'][K],
  ) => onChange({ ...value, [key]: next })

  return (
    <div className="space-y-5">
      <Panel title="رأس الصفحة" hint="تظهر على /how-it-works">
        <Field id="hiw-title" label="العنوان" value={value.title} onChange={(v) => set('title', v)} />
        <AreaField
          id="hiw-intro"
          label="السطر تحته"
          rows={2}
          value={value.intro}
          onChange={(v) => set('intro', v)}
        />
      </Panel>

      <StepsPanel
        title="خطوات البائع"
        heading={value.sellerTitle}
        onHeading={(v) => set('sellerTitle', v)}
        steps={value.sellerSteps}
        onSteps={(v) => set('sellerSteps', v)}
        idPrefix="seller"
      />

      <StepsPanel
        title="خطوات المشتري"
        heading={value.buyerTitle}
        onHeading={(v) => set('buyerTitle', v)}
        steps={value.buyerSteps}
        onSteps={(v) => set('buyerSteps', v)}
        idPrefix="buyer"
      />

      <Panel title="صندوق السعر الاحتياطي">
        <Field
          id="hiw-reserve-title"
          label="العنوان"
          value={value.reserveTitle}
          onChange={(v) => set('reserveTitle', v)}
        />
        <AreaField
          id="hiw-reserve-body"
          label="النصّ"
          rows={4}
          value={value.reserveBody}
          onChange={(v) => set('reserveBody', v)}
        />
      </Panel>

      <Panel title="قواعد التداول" hint="قائمة نقاط — تُضاف وتُحذف كما تشاء.">
        <Field
          id="hiw-rules-title"
          label="عنوان القائمة"
          value={value.rulesTitle}
          onChange={(v) => set('rulesTitle', v)}
        />
        <div className="space-y-2">
          {value.rules.map((rule, index) => (
            <div key={index} className="flex items-start gap-2">
              <Textarea
                aria-label={`القاعدة ${index + 1}`}
                rows={2}
                value={rule}
                onChange={(event) =>
                  set('rules', value.rules.map((r, i) => (i === index ? event.target.value : r)))
                }
              />
              <IconButton
                label={`احذف القاعدة ${index + 1}`}
                danger
                disabled={value.rules.length <= 1}
                onClick={() => set('rules', value.rules.filter((_, i) => i !== index))}
              >
                <Trash2 className="size-3.5" />
              </IconButton>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={() => set('rules', [...value.rules, ''])}>
            <Plus className="size-4" />
            أضف قاعدة
          </Button>
        </div>
      </Panel>

      <Panel
        title="السداد ونقل الملكية"
        hint="سطر العمولة يُضاف تلقائيًا أسفل هذا النصّ من إعدادات العمولة السارية — فلا تكتبه هنا."
      >
        <Field
          id="hiw-settle-title"
          label="العنوان"
          value={value.settlementTitle}
          onChange={(v) => set('settlementTitle', v)}
        />
        <AreaField
          id="hiw-settle-body"
          label="النصّ"
          rows={5}
          value={value.settlementBody}
          onChange={(v) => set('settlementBody', v)}
        />
      </Panel>
    </div>
  )
}

function StepsPanel({
  title,
  heading,
  onHeading,
  steps,
  onSteps,
  idPrefix,
}: {
  title: string
  heading: string
  onHeading: (value: string) => void
  steps: PageStep[]
  onSteps: (value: PageStep[]) => void
  idPrefix: string
}) {
  return (
    <Panel title={title} hint="أربع خطوات ثابتة — لكلٍّ أيقونتها في التصميم، فلا تُزاد ولا تُنقص.">
      <Field
        id={`${idPrefix}-heading`}
        label="عنوان المجموعة"
        value={heading}
        onChange={onHeading}
      />
      {steps.map((step, index) => (
        <div key={index} className="rounded-xl border border-ink-600 bg-ink-900/50 p-3">
          <p className="mb-2 text-xs font-bold text-muted">الخطوة {index + 1}</p>
          <div className="space-y-3">
            <Field
              id={`${idPrefix}-${index}-title`}
              label="عنوان الخطوة"
              value={step.title}
              onChange={(value) =>
                onSteps(steps.map((s, i) => (i === index ? { ...s, title: value } : s)))
              }
            />
            <AreaField
              id={`${idPrefix}-${index}-body`}
              label="شرح الخطوة"
              rows={3}
              value={step.body}
              onChange={(value) =>
                onSteps(steps.map((s, i) => (i === index ? { ...s, body: value } : s)))
              }
            />
          </div>
        </div>
      ))}
    </Panel>
  )
}

/* ------------------------------------------------------- قسم الطمأنينة */

function TrustEditor({
  value,
  onChange,
}: {
  value: PageSettings['trust']
  onChange: (value: PageSettings['trust']) => void
}) {
  return (
    <div className="space-y-5">
      <Panel title="العنوان والمقدّمة" hint="أسفل اللوحات في الصفحة الرئيسية.">
        <Field
          id="trust-title"
          label="العنوان"
          value={value.title}
          onChange={(title) => onChange({ ...value, title })}
        />
        <AreaField
          id="trust-body"
          label="الفقرة تحته"
          rows={3}
          value={value.body}
          onChange={(body) => onChange({ ...value, body })}
        />
      </Panel>

      <Panel title="البطاقات الستّ" hint="ستّ بطاقات ثابتة — لكلٍّ أيقونتها، فلا تُزاد ولا تُنقص.">
        {value.features.map((feature, index) => (
          <div key={index} className="rounded-xl border border-ink-600 bg-ink-900/50 p-3">
            <p className="mb-2 text-xs font-bold text-muted">البطاقة {index + 1}</p>
            <div className="space-y-3">
              <Field
                id={`trust-${index}-title`}
                label="عنوان البطاقة"
                value={feature.title}
                onChange={(title) =>
                  onChange({
                    ...value,
                    features: value.features.map((f, i) => (i === index ? { ...f, title } : f)),
                  })
                }
              />
              <AreaField
                id={`trust-${index}-body`}
                label="نصّ البطاقة"
                rows={3}
                value={feature.body}
                onChange={(body) =>
                  onChange({
                    ...value,
                    features: value.features.map((f, i) => (i === index ? { ...f, body } : f)),
                  })
                }
              />
            </div>
          </div>
        ))}
      </Panel>
    </div>
  )
}

/* ------------------------------------------------------------- لبنات */

function Panel({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-ink-600 bg-ink-800 p-4 sm:p-5">
      <h3 className="font-bold">{title}</h3>
      {hint && <p className="mt-1 text-xs leading-relaxed text-muted">{hint}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  )
}

function Field({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}

function AreaField({
  id,
  label,
  hint,
  rows,
  value,
  onChange,
}: {
  id: string
  label: string
  hint?: string
  rows: number
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} rows={rows} value={value} onChange={(event) => onChange(event.target.value)} />
      {hint && <p className="text-[11px] leading-relaxed text-muted">{hint}</p>}
    </div>
  )
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-lg border border-ink-600 bg-ink-900 transition-colors disabled:opacity-35',
        danger ? 'text-danger hover:border-danger/50' : 'text-muted hover:text-paper',
      )}
    >
      {children}
    </button>
  )
}
