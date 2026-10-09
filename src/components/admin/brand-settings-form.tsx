'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import Image from 'next/image'
import { Gavel, ImageUp, Loader2, Palette, Save, Trash2, Type } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  BRAND_ASSET_LIMITS,
  type BrandAsset,
  type BrandAssetKind,
  type BrandSettings,
} from '@/lib/domain/types'
import { cn } from '@/lib/utils'

type Draft = Omit<BrandSettings, 'updatedAt' | 'updatedByAdminId'>

const ASSETS: {
  key: BrandAssetKind
  label: string
  hint: string
  ratio: string
  preview: string
}[] = [
  {
    key: 'logo',
    label: 'شعار المنصّة',
    hint: 'يظهر في الترويسة والتذييل بارتفاعٍ ثابت وعرضٍ يتبع نسبته — لا يُقصّ. ويُفضَّل PNG شفّاف.',
    ratio: 'aspect-[16/9] w-32',
    preview: 'object-contain p-2',
  },
  {
    key: 'icon',
    label: 'أيقونة التبويب (Favicon)',
    hint: 'مربّعة صغيرة، ٥١٢×٥١٢ تكفي لكل المقاسات.',
    ratio: 'aspect-square w-16',
    preview: 'object-cover',
  },
  {
    key: 'ogImage',
    label: 'صورة المشاركة',
    hint: 'ما يظهر عند مشاركة الرابط في واتساب وتويتر — ١٢٠٠×٦٣٠.',
    ratio: 'aspect-[1200/630] w-40',
    preview: 'object-cover',
  },
]

/**
 * هويّة المنصّة: اسمها ولونها وشعارها ونصّ واجهتها الأولى.
 *
 * وكل ما هنا كان مكتوبًا في الكود، فتبديل اسمٍ يحتاج نشرًا. ومن ينصب نسخته
 * أوّل ما يبدّل: اسمه، ولونه، وما يُقرأ عنه أوّل ما تُفتح الصفحة.
 */
export function BrandSettingsForm({ settings }: { settings: BrandSettings }) {
  const router = useRouter()
  const [form, setForm] = useState<Draft>(settings)
  const [busy, setBusy] = useState(false)
  /*
   * الأصول تُرسل حين تتغيّر وحدها.
   *
   * الحمولة تحمل البايتات، والشعار وحده قد يبلغ نصف ميغابايت — فإرساله مع كل
   * حفظٍ يُرسل ما لم يتغيّر ويُبطئ ما لا يحتاج بطئًا. والغياب من الحمولة
   * يعني «اتركه»، و`null` الصريح يعني «احذفه».
   */
  const [touched, setTouched] = useState<Partial<Record<BrandAssetKind, BrandAsset | null>>>({})

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  async function pick(kind: BrandAssetKind, file: File) {
    if (file.size > BRAND_ASSET_LIMITS[kind]) {
      toast.error(
        `الملفّ ${Math.round(file.size / 1024)} كيلوبايت، والحدّ ${Math.round(BRAND_ASSET_LIMITS[kind] / 1024)}`,
      )
      return
    }
    const buffer = await file.arrayBuffer()
    let binary = ''
    const bytes = new Uint8Array(buffer)
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    const asset: BrandAsset = {
      data: btoa(binary),
      mime: file.type,
      fileName: file.name,
      bytes: file.size,
      updatedAt: new Date().toISOString(),
    }
    setTouched((current) => ({ ...current, [kind]: asset }))
    setForm((current) => ({ ...current, [kind]: asset }))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      const response = await fetch('/api/admin/settings/brand', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          shortName: form.shortName,
          brandDisplay: form.brandDisplay,
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
          ...Object.fromEntries(
            Object.entries(touched).map(([k, v]) => [
              k,
              v && { data: v.data, mime: v.mime, fileName: v.fileName },
            ]),
          ),
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data?.error?.message ?? 'تعذّر حفظ الهويّة')
        return
      }
      toast.success('حُفظت هويّة المنصّة')
      setTouched({})
      router.refresh()
    } catch {
      toast.error('تعذّر الاتصال — تحقّق من الشبكة وأعد المحاولة')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Section icon={Type} title="الاسم" hint="يظهر في الترويسة وفي عنوان التبويب وفي بطاقة المشاركة.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="الاسم الكامل" value={form.name} onChange={(v) => set('name', v)} required />
          <Field
            label="الاسم القصير"
            value={form.shortName}
            onChange={(v) => set('shortName', v)}
            hint="في الترويسة، وفي «عنوان الصفحة — الاسم القصير»"
            required
          />
        </div>
      </Section>

      <Section
        icon={ImageUp}
        title="ما يظهر في الترويسة"
        hint="شعارٌ مكتوبٌ فيه اسم منصّتك يجعل الاسم بجانبه تكرارًا، وشعارٌ رمزيّ بلا اسم يترك الزائر لا يعرف أين هو."
      >
        <div className="grid gap-2 sm:grid-cols-3">
          {(
            [
              { value: 'logoAndName', label: 'الشعار والاسم', hint: 'الافتراضي' },
              { value: 'logoOnly', label: 'الشعار وحده', hint: 'إن كان اسمك في الشعار' },
              { value: 'nameOnly', label: 'الاسم وحده', hint: 'بلا صورة' },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => set('brandDisplay', option.value)}
              className={cn(
                'rounded-xl border p-3 text-start transition-colors',
                form.brandDisplay === option.value
                  ? 'border-gold-600 bg-gold-500/10'
                  : 'border-ink-600 bg-ink-900/40 hover:border-gold-600/40',
              )}
            >
              {/* معاينةٌ بالشكل نفسه: ما يُختار يُرى لا يُوصف */}
              <span className="mb-2 flex h-9 items-center gap-2">
                {option.value !== 'nameOnly' &&
                  (form.logo ? (
                    <Image
                      src={`data:${form.logo.mime};base64,${form.logo.data}`}
                      alt=""
                      width={80}
                      height={36}
                      unoptimized
                      className="h-9 w-auto max-w-[5rem] object-contain"
                    />
                  ) : (
                    <span className="flex size-9 items-center justify-center rounded-xl bg-gold-500 text-ink-950">
                      <Gavel className="size-4" />
                    </span>
                  ))}
                {option.value !== 'logoOnly' && (
                  <span className="truncate text-sm font-extrabold">{form.shortName}</span>
                )}
              </span>
              <span className="block text-xs font-bold">{option.label}</span>
              <span className="block text-[11px] text-muted">{option.hint}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section
        icon={Palette}
        title="اللون الأساسي"
        hint="يشتقّ منه تدرّج المنصّة كلّه — الأزرار والوسوم والحدود — في السمتين معًا."
      >
        <div className="flex flex-wrap items-center gap-4">
          <input
            type="color"
            aria-label="اللون الأساسي"
            value={form.primaryColor}
            onChange={(event) => set('primaryColor', event.target.value)}
            className="size-12 shrink-0 cursor-pointer rounded-xl border border-ink-600 bg-transparent p-1"
          />
          <Input
            dir="ltr"
            value={form.primaryColor}
            onChange={(event) => set('primaryColor', event.target.value)}
            className="w-36 text-center font-mono uppercase"
            aria-label="قيمة اللون"
          />
          {/* معاينةٌ باللون المختار قبل الحفظ — لا بعد إعادة تحميل الصفحة */}
          <span
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-ink-950"
            style={{ background: form.primaryColor }}
          >
            هكذا يظهر الزرّ
          </span>
        </div>
      </Section>

      <Section icon={ImageUp} title="الصور" hint="تُحفظ في سجلّ المنصّة وتُخدَم من رابط ثابت.">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ASSETS.map((entry) => (
            <AssetField
              key={entry.key}
              label={entry.label}
              hint={entry.hint}
              ratio={entry.ratio}
              preview={entry.preview}
              asset={form[entry.key]}
              onPick={(file) => void pick(entry.key, file)}
              onClear={() => {
                setTouched((c) => ({ ...c, [entry.key]: null }))
                setForm((c) => ({ ...c, [entry.key]: null }))
              }}
            />
          ))}
        </div>
      </Section>

      <Section icon={Type} title="نصّ الواجهة الأولى" hint="أوّل ما يقرؤه الزائر قبل أن يرى لوحة.">
        <div className="space-y-4">
          <Field label="الشارة العلوية" value={form.heroBadge} onChange={(v) => set('heroBadge', v)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="العنوان" value={form.heroTitle} onChange={(v) => set('heroTitle', v)} required />
            <Field
              label="السطر المميّز"
              value={form.heroHighlight}
              onChange={(v) => set('heroHighlight', v)}
              hint="يظهر بلون المنصّة تحت العنوان"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hero-body">الفقرة</Label>
            <Textarea
              id="hero-body"
              rows={4}
              value={form.heroBody}
              onChange={(event) => set('heroBody', event.target.value)}
            />
          </div>
        </div>
      </Section>

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          حفظ الهويّة
        </Button>
      </div>
    </form>
  )
}

export function Section({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: React.ElementType
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="surface rounded-2xl p-5">
      <div className="mb-4">
        <h3 className="flex items-center gap-2 text-sm font-extrabold">
          <Icon className="size-4 text-gold-500" />
          {title}
        </h3>
        {hint && <p className="mt-1 text-xs leading-relaxed text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

export function Field({
  label,
  value,
  onChange,
  hint,
  required,
  dir,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  hint?: string
  required?: boolean
  dir?: 'ltr'
  placeholder?: string
}) {
  const id = `f-${label.replace(/\s/g, '-')}`
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        dir={dir}
        value={value}
        placeholder={placeholder}
        required={required}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint && <p className="text-[11px] text-muted">{hint}</p>}
    </div>
  )
}

function AssetField({
  label,
  hint,
  ratio,
  preview,
  asset,
  onPick,
  onClear,
}: {
  label: string
  hint: string
  ratio: string
  preview: string
  asset: BrandAsset | null
  onPick: (file: File) => void
  onClear: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  /*
   * المعاينة من البايتات في الذاكرة لا من المسار.
   *
   * المسار يخدم ما في السجلّ، وما اختاره الأدمن لم يُحفظ بعد. فلو عُرضت منه
   * لبقيت الصورة القديمة ظاهرة حتى الحفظ — فيظنّ أنّ الاختيار لم يقع.
   */
  const src = asset ? `data:${asset.mime};base64,${asset.data}` : null

  return (
    <div>
      <p className="mb-2 text-xs font-bold">{label}</p>
      <div className={cn('relative overflow-hidden rounded-xl border border-ink-600 bg-ink-900', ratio)}>
        {src ? (
          <Image src={src} alt="" fill unoptimized className={preview} sizes="160px" />
        ) : (
          <span className="flex size-full items-center justify-center text-[11px] text-muted">
            لا صورة
          </span>
        )}
      </div>

      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onPick(file)
          event.target.value = ''
        }}
      />

      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button type="button" size="sm" variant="outline" onClick={() => input.current?.click()}>
          <ImageUp className="size-3.5" />
          {asset ? 'استبدال' : 'رفع'}
        </Button>
        {asset && (
          <Button type="button" size="sm" variant="outline" onClick={onClear} aria-label="حذف">
            <Trash2 className="size-3.5 text-danger" />
          </Button>
        )}
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-muted">{hint}</p>
    </div>
  )
}
