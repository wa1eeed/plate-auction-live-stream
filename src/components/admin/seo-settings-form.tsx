'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Bot, CheckCircle2, Globe, Loader2, Save, Search, Share2 } from 'lucide-react'
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
      <Explainer />

      <Section
        icon={Search}
        title="نتيجة البحث"
        hint="ما يقرؤه الباحث في جوجل قبل أن يضغط. اكتبه كما تريد أن يُقرأ لا كما تُكرَّر فيه الكلمات — تكرارها يخفض ترتيبك لا يرفعه."
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
            hint="بفاصلة بينها. لا ترفع ترتيبك وحدها — جوجل يتجاهلها منذ سنين — لكنّ محرّكات أخرى ما زالت تقرؤها، وتفيد في وصف الصفحة."
            values={form.keywords}
            onChange={(v) => set('keywords', v)}
            placeholder="لوحات مميزة، مزاد لوحات"
          />
        </div>
      </Section>

      <Section
        icon={Bot}
        title="محرّكات الإجابة"
        hint="حين يسأل أحدهم مساعدًا ذكيًّا «وين أبيع لوحتي؟» فهذه الحقول هي ما يجعله يذكرك بالاسم بدل أن يصفك وصفًا عامًّا."
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
            hint="روابط كاملة بفاصلة بينها — إكس، إنستقرام، لينكدإن، سناب. تقول للمحرّك إنّ هذه الحسابات ومنصّتك شيءٌ واحد، فيجمع ذكرها كلّها لصالحك بدل أن يراها كيانات متفرّقة."
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
        hint="من يبحث من الرياض تختلف نتائجه عمّن يبحث من خارج السعودية. وهذا ما يقول للمحرّك: هذه المنصّة تخدم هؤلاء."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="رمز المنطقة"
            value={form.geoRegion}
            onChange={(v) => set('geoRegion', v)}
            dir="ltr"
            hint="SA للسعودية كلّها، أو SA-01 للرياض تحديدًا"
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

      <Section
        icon={Share2}
        title="إثبات ملكيتك للموقع لدى جوجل"
        hint="خطوةٌ تُفعل مرّة واحدة. بدونها لا تستطيع رؤية كلمات البحث التي تصلك، ولا طلب أرشفة صفحاتك، ولا معرفة أخطاء الفهرسة."
      >
        <VerificationField
          value={form.googleSiteVerification}
          onChange={(v) => set('googleSiteVerification', v)}
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

/**
 * الفروق الثلاثة — مشروحةً لا مُختصرةً في ثلاثة أحرف.
 *
 * «SEO» و«AEO» و«GEO» اختصاراتٌ لا تقول شيئًا لمن يشغّل منصّة. وما يحتاجه هو
 * الفرق العمليّ: **مَن** يقرأ كلَّ حقل، و**متى** يظهر أثره، و**ماذا** يُملأ
 * هنا من أجله. فبدونها يملأ الحقول كلّها بالكلمات نفسها ويظنّ أنّه فعل شيئًا.
 */
function Explainer() {
  const rows = [
    {
      icon: Search,
      code: 'SEO',
      title: 'ظهورك في نتائج البحث',
      who: 'جوجل وبِنق — حين يبحث أحدهم بنفسه',
      what: 'العنوان والوصف اللذان يُقرآن في النتيجة، والكلمات التي تصف صفحاتك.',
      when: 'تراه حين تبحث عن اسم منصّتك في جوجل.',
      tone: 'gold' as const,
    },
    {
      icon: Bot,
      code: 'AEO',
      title: 'ظهورك في الإجابات المباشرة',
      who: 'المساعدات التي تُجيب بلا فتح موقع',
      what: 'أسئلتك الشائعة تُرسَل بصيغة يفهمها الحاسوب، فتُقتبس إجابتك كما كتبتها.',
      when: 'يسأل أحدهم «كيف أبيع لوحتي؟» فيأتي الجواب منك أنت.',
      tone: 'success' as const,
    },
    {
      icon: Globe,
      code: 'GEO',
      title: 'ظهورك لمن حولك',
      who: 'محرّكات البحث حين تعرف موقع الباحث',
      what: 'أين تعمل منصّتك، وباسم أيّ منشأة، وبأي حسابات تُعرف.',
      when: 'يبحث أحدهم من الرياض فتُقدَّم على منصّة خارج السعودية.',
      tone: 'sky' as const,
    },
  ]

  const TONE = {
    gold: 'bg-gold-500/12 text-gold-500',
    success: 'bg-success/12 text-success',
    sky: 'bg-ink-700 text-paper',
  }

  return (
    <section className="surface rounded-2xl p-5">
      <h3 className="text-sm font-extrabold">ثلاث جهات تقرأ منصّتك — ولكلٍّ حاجة</h3>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        ما تحته ليس ثلاث نسخ من الشيء نفسه. كلٌّ يُقرأ في موضعٍ مختلف، وملؤه
        بالكلمات نفسها يُضيّع اثنين منها.
      </p>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {rows.map((row) => (
          <div key={row.code} className="rounded-xl border border-ink-600 bg-ink-900/50 p-4">
            <p className="flex items-center gap-2">
              <span className={cn('flex size-7 items-center justify-center rounded-lg', TONE[row.tone])}>
                <row.icon className="size-3.5" />
              </span>
              <span className="text-sm font-extrabold">{row.title}</span>
              <span
                dir="ltr"
                title="الاسم الشائع لهذا المجال"
                className="ms-auto rounded-md bg-ink-700 px-1.5 py-0.5 font-mono text-[10px] font-bold text-muted"
              >
                {row.code}
              </span>
            </p>

            <dl className="mt-3 space-y-2 text-[11px] leading-relaxed">
              <div>
                <dt className="font-bold text-muted">من يقرؤه</dt>
                <dd>{row.who}</dd>
              </div>
              <div>
                <dt className="font-bold text-muted">ماذا تملأ هنا</dt>
                <dd>{row.what}</dd>
              </div>
              <div>
                <dt className="font-bold text-muted">متى ترى أثره</dt>
                <dd className="text-muted">{row.when}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    </section>
  )
}

/*
 * الرمز الذي يُطلب في «وسم HTML» لدى Google Search Console.
 *
 * الصيغة التي تعطيها جوجل هي الوسم كاملًا. ومن ينسخها كما هي — وهو ما يفعله
 * الجميع — كان يُخزَّن عنده الوسم بأكمله في موضع المحتوى، فيخرج في الصفحة
 * وسمًا داخل وسم فيفشل التحقّق بلا أن يُقال له لماذا.
 */
const TOKEN_IN_TAG = /content=["']([^"']+)["']/i

export function extractToken(input: string): string {
  const trimmed = input.trim()
  const inTag = trimmed.match(TOKEN_IN_TAG)
  return (inTag ? inTag[1] : trimmed).trim()
}

function VerificationField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const done = value.length > 10

  return (
    <div className="space-y-4">
      <ol className="space-y-2 rounded-xl border border-ink-600 bg-ink-900/50 p-4 text-xs leading-relaxed">
        {[
          <>
            افتح{' '}
            <a
              href="https://search.google.com/search-console"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-gold-500 underline"
            >
              Google Search Console
            </a>{' '}
            وسجّل دخولك بحساب جوجل.
          </>,
          <>
            اضغط <b>إضافة موقع</b> واختر النوع <b>بادئة عنوان URL</b> — لا «نطاق».
          </>,
          <>
            اكتب عنوان منصّتك كاملًا، ثمّ من طرق التحقّق اختر <b>وسم HTML</b>.
          </>,
          <>
            انسخ السطر الذي تعطيك إيّاه <b>كاملًا</b> والصقه في الحقل تحت — نستخرج منه ما
            يلزم وحدنا.
          </>,
          <>
            ارجع إلى جوجل واضغط <b>تحقّق</b>. (احفظ هنا أوّلًا، ثمّ انشر التحديث على
            موقعك.)
          </>,
        ].map((step, index) => (
          <li key={index} className="flex gap-2.5">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-ink-700 text-[10px] font-bold tabular-nums">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      <div className="space-y-1.5">
        <Label htmlFor="gsc">الصق وسم جوجل هنا</Label>
        <Input
          id="gsc"
          dir="ltr"
          value={value}
          placeholder='<meta name="google-site-verification" content="..." />'
          onChange={(event) => onChange(extractToken(event.target.value))}
        />
        {done ? (
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-success">
            <CheckCircle2 className="size-3.5" />
            جاهز — سيُضاف هذا الوسم إلى كل صفحة بعد الحفظ والنشر
          </p>
        ) : (
          <p className="text-[11px] text-muted">
            الصق السطر كما نسخته من جوجل. لو لصقت الرمز وحده فهو مقبول أيضًا.
          </p>
        )}
      </div>

      {done && (
        <div className="rounded-xl border border-ink-600 bg-ink-900/50 p-3">
          <p className="mb-1.5 text-[11px] font-bold text-muted">ما سيظهر في صفحاتك</p>
          <code dir="ltr" className="block break-all font-mono text-[11px] text-gold-500">
            {`<meta name="google-site-verification" content="${value}" />`}
          </code>
        </div>
      )}
    </div>
  )
}
