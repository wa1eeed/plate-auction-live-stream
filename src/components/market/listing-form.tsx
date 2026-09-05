'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Gavel, HandCoins, Info, Loader2, Save, ShieldCheck, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PlateEmblemPicker } from '@/components/plate/PlateEmblemPicker'
import { SaudiLicensePlate } from '@/components/plate/SaudiLicensePlate'
import { LetterPicker } from '@/components/plate/letter-picker'
import { formatAmount, halalasToRiyals } from '@/lib/domain/money'
import {
  PLATE_TYPES,
  PLATE_FORMATS,
  PLATE_FORMAT_HINTS,
  PLATE_FORMAT_LABELS,
  PLATE_TYPE_LABELS,
  isLatinOnlyFormat,
  type PlateFormat,
  PLATE_TYPE_MAX_LETTERS,
  SALE_TYPES,
  SALE_TYPE_HINTS,
  SALE_TYPE_LABELS,
  type AuctionSettings,
  type CommissionSettings,
  type Listing,
  type PlateEmblem,
  type PlateType,
  type SaleType,
} from '@/lib/domain/types'
import {
  lettersToLatin,
  normalizeArabicLetters,
  normalizePlateNumbers,
  toArabicIndicDigits,
} from '@/lib/saudi-plate-mapping'
import { cn } from '@/lib/utils'

const DURATION_OPTIONS = [
  { value: 3600, label: 'ساعة' },
  { value: 6 * 3600, label: '6 ساعات' },
  { value: 24 * 3600, label: 'يوم' },
  { value: 3 * 24 * 3600, label: '3 أيام' },
  { value: 7 * 24 * 3600, label: 'أسبوع' },
]

const SALE_ICONS: Record<SaleType, typeof Gavel> = { auction: Gavel, fixed: Tag, offers: HandCoins }

type FormValues = {
  plateType: PlateType
  plateFormat: PlateFormat
  arabicLetters: string
  latinLetters: string
  plateNumbers: string
  description: string
  saleType: SaleType
  price: number
  startingPrice: number
  minimumIncrement: number
  reservePrice: number
  minimumOffer: number
  durationSeconds: number
}

const DEFAULTS: FormValues = {
  plateType: 'private',
  plateFormat: 'standard',
  arabicLetters: '',
  latinLetters: '',
  plateNumbers: '',
  description: '',
  saleType: 'auction',
  price: 0,
  startingPrice: 10_000,
  minimumIncrement: 500,
  reservePrice: 0,
  minimumOffer: 0,
  durationSeconds: 3 * 24 * 3600,
}

export function ListingForm({
  listing,
  governance,
  commission,
}: {
  listing?: Listing
  /** قواعد المنصّة المطبَّقة — تُعرض للبائع ولا تُعدَّل من هنا */
  governance: AuctionSettings
  /** إعدادات العمولة — ليعرف البائع ما يُقتطع قبل أن يسعّر */
  commission: CommissionSettings
}) {
  const router = useRouter()
  const [emblem, setEmblem] = useState<PlateEmblem>(listing?.emblem ?? 'palm-swords-black')
  const [customEmblemUrl, setCustomEmblemUrl] = useState(listing?.customEmblemUrl ?? '')

  const form = useForm<FormValues>({
    defaultValues: listing
      ? {
  plateType: listing.plateType,
  plateFormat: listing.plateFormat,
          arabicLetters: listing.arabicLetters,
          latinLetters: listing.latinLetters,
          plateNumbers: listing.plateNumbers,
          description: listing.description ?? '',
          saleType: listing.saleType,
          price: halalasToRiyals(listing.price),
          startingPrice: halalasToRiyals(listing.startingPrice),
          minimumIncrement: halalasToRiyals(listing.minimumIncrement),
          reservePrice: halalasToRiyals(listing.reservePrice),
          minimumOffer: halalasToRiyals(listing.minimumOffer),
          durationSeconds: listing.durationSeconds,
        }
      : DEFAULTS,
  })

  const { register, watch, setValue, handleSubmit, formState } = form
  const plateType = watch('plateType')
  const plateFormat = watch('plateFormat')
  // الرياضية بلا عربية أصلًا — فحقلاها يُخفيان ولا يُطلبان
  const latinOnly = isLatinOnlyFormat(plateFormat)
  const saleType = watch('saleType')
  const arabicLetters = watch('arabicLetters')
  const plateNumbers = watch('plateNumbers')
  const maxLetters = PLATE_TYPE_MAX_LETTERS[plateType]

  const normalizedLetters = useMemo(
    () => normalizeArabicLetters(arabicLetters, maxLetters),
    [arabicLetters, maxLetters],
  )
  const normalizedNumbers = useMemo(() => normalizePlateNumbers(plateNumbers, 4), [plateNumbers])

  useEffect(() => {
    setValue('latinLetters', lettersToLatin(normalizedLetters))
  }, [normalizedLetters, setValue])

  const onSubmit = handleSubmit(async (values) => {
    const payload = {
      ...values,
      arabicLetters: normalizedLetters,
      plateNumbers: normalizedNumbers,
      latinLetters: values.latinLetters.toUpperCase(),
      emblem,
      customEmblemUrl: emblem === 'custom' ? customEmblemUrl || null : null,
      description: values.description || null,
      price: Number(values.price),
      startingPrice: Number(values.startingPrice),
      minimumIncrement: Number(values.minimumIncrement),
      reservePrice: Number(values.reservePrice),
      minimumOffer: Number(values.minimumOffer),
      durationSeconds: Number(values.durationSeconds),
    }

    try {
      const response = await fetch(listing ? `/api/listings/${listing.id}` : '/api/listings', {
        method: listing ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data?.error?.message ?? 'تعذّر حفظ اللوحة')
        return
      }
      toast.success(listing ? 'حُفظت التعديلات' : 'أُضيفت اللوحة كمسودة — انشرها لتظهر في السوق')
      router.push('/account/listings')
      router.refresh()
    } catch {
      toast.error('تعذّر الاتصال — تحقّق من الشبكة وأعد المحاولة')
    }
  },
  // ورفضُ التحقّق يُقال أيضًا: ضغطة بلا أثر ظاهر تبدو عطلًا
  () => toast.error('راجِع الحقول المعلَّمة بالأحمر'))

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* ------------------------------------------------ اللوحة */}
      <section className="space-y-4 rounded-2xl border border-ink-600 bg-ink-800 p-5">
        <h2 className="font-bold">بيانات اللوحة</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>نوع اللوحة</Label>
            <Select value={plateType} onValueChange={(v) => setValue('plateType', v as PlateType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {PLATE_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/*
            * نوع الإصدار — شكل اللوحة لا صنف مركبتها.
            *
            * محورٌ مستقلّ: لوحةٌ خصوصية قد تصدر طويلةً أو اعتيادية أو رياضية.
            * والاختيار بالبطاقات لا بقائمة منسدلة: الفرق شكليّ، فيُرى لا
            * يُوصف — ومن يقرأ «طويلة» و«اعتيادية» في قائمة لا يعرف أيّهما أراد.
            */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label>نوع الإصدار</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {PLATE_FORMATS.map((format) => (
                <button
                  key={format}
                  type="button"
                  onClick={() => setValue('plateFormat', format, { shouldValidate: true })}
                  className={cn(
                    'rounded-xl border p-3 text-start transition-colors',
                    plateFormat === format
                      ? 'border-gold-600 bg-gold-500/10'
                      : 'border-ink-600 bg-ink-900/40 hover:border-gold-600/40',
                  )}
                >
                  <span className="mb-2 flex h-12 items-center justify-center">
                    <SaudiLicensePlate
                      plateType={plateType}
                      plateFormat={format}
                      arabicLetters={watch('arabicLetters') || 'ا ب ج'}
                      latinLetters={watch('latinLetters') || 'ABJ'}
                      plateNumbers={watch('plateNumbers') || '1234'}
                      emblem={emblem}
                      size="fill"
                      showReflection={false}
                      className="h-12"
                    />
                  </span>
                  <span className="block text-xs font-bold">{PLATE_FORMAT_LABELS[format]}</span>
                  <span className="mt-0.5 block text-[10px] leading-relaxed text-muted">
                    {PLATE_FORMAT_HINTS[format]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="plateNumbers">أرقام اللوحة (1–4)</Label>
            {/*
              * خطأ الحقل يُقال عند الحقل.
              *
              * كان النموذج بلا قاعدة واحدة ولا رسالة: من يترك الأرقام فارغة
              * يضغط «حفظ» فلا يحدث شيء ظاهر — ولا يعرف أين الخلل في أطول
              * نموذج في مسار البائع.
              */}
            <Input
              id="plateNumbers"
              dir="ltr"
              inputMode="numeric"
              aria-invalid={formState.errors.plateNumbers ? true : undefined}
              aria-describedby={formState.errors.plateNumbers ? 'plateNumbers-error' : undefined}
              {...register('plateNumbers', {
                required: 'أدخل رقم اللوحة',
                validate: (value) =>
                  normalizePlateNumbers(String(value ?? ''), 4).length > 0 || 'رقم اللوحة أرقامٌ من 1 إلى 4',
              })}
            />
            {formState.errors.plateNumbers && (
              <p id="plateNumbers-error" className="text-[11px] font-semibold text-danger">
                {String(formState.errors.plateNumbers.message)}
              </p>
            )}
            <p className="text-xs text-muted">
              عربي: <span className="font-bold text-paper">{toArabicIndicDigits(normalizedNumbers) || '—'}</span>
            </p>
          </div>

          {/*
            * الحروف تُدخَل عربيةً ولو كانت اللوحة رياضية.
            *
            * اللوحة السعودية تُسجَّل بحروفها العربية أيًّا كان إصدارها،
            * واللاتينية تُشتقّ منها بجدول المرور المعتمد. والرياضية لا تطبع
            * إلّا اللاتينية — فما يتغيّر هو **ما يُطبَع** لا ما يُدخَل.
            */}
          <LetterPicker
            value={normalizedLetters}
            onChange={(letters) => setValue('arabicLetters', letters, { shouldDirty: true })}
            maxLetters={maxLetters}
          />

          <div className="space-y-1.5">
            {/* <output> لا <div>: قيمة محسوبة لا يكتبها المستخدم، و`htmlFor`
                يربط التسمية بها فيقرؤها قارئ الشاشة كحقل له اسم */}
            <Label htmlFor="latinLetters">الحروف اللاتينية</Label>
            <output
              id="latinLetters"
              dir="ltr"
              className="flex h-12 items-center justify-center rounded-xl border border-ink-600 bg-ink-900 text-lg font-extrabold tracking-[0.3em]"
            >
              {watch('latinLetters') || '—'}
            </output>
            <p className="text-[11px] leading-relaxed text-muted">
              تُشتقّ من الحروف العربية حسب جدول لوحات المرور المعتمد.
              {latinOnly && (
                <>
                  {' '}
                  <b className="text-gold-500">
                    واللوحة الرياضية لا تطبع إلا هذه الحروف والأرقام اللاتينية.
                  </b>
                </>
              )}
            </p>
          </div>
        </div>

        <PlateEmblemPicker
          value={emblem}
          onChange={setEmblem}
          plateType={plateType}
          arabicLetters={normalizedLetters || 'ا'}
          latinLetters={watch('latinLetters') || 'A'}
          plateNumbers={normalizedNumbers || '1'}
          customUrl={customEmblemUrl}
          onCustomUrlChange={setCustomEmblemUrl}
        />

        <div className="space-y-1.5">
          <Label htmlFor="description">وصف اللوحة</Label>
          <Textarea id="description" rows={3} placeholder="ما يميّز هذه اللوحة؟" {...register('description')} />
        </div>
      </section>

      {/* ------------------------------------------------ طريقة البيع */}
      <section className="space-y-4 rounded-2xl border border-ink-600 bg-ink-800 p-5">
        <h2 className="font-bold">طريقة البيع</h2>

        <div className="grid gap-2 sm:grid-cols-3">
          {SALE_TYPES.map((type) => {
            const Icon = SALE_ICONS[type]
            const selected = saleType === type
            return (
              <button
                key={type}
                type="button"
                onClick={() => setValue('saleType', type)}
                aria-pressed={selected}
                className={cn(
                  'rounded-xl border p-4 text-start transition-colors',
                  selected
                    ? 'border-gold-500 bg-gold-500/10'
                    : 'border-ink-600 bg-ink-900 hover:border-ink-500',
                )}
              >
                <Icon className={cn('mb-2 size-5', selected ? 'text-gold-500' : 'text-muted')} />
                <p className="font-bold">{SALE_TYPE_LABELS[type]}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{SALE_TYPE_HINTS[type]}</p>
              </button>
            )
          })}
        </div>

        {saleType === 'fixed' && (
          <NumberField id="price" label="سعر البيع (ريال)" register={register} />
        )}

        {saleType === 'offers' && (
          <NumberField
            id="minimumOffer"
            label="أقل عرض مقبول (ريال) — اتركه صفرًا لقبول أي عرض"
            register={register}
          />
        )}

        {saleType === 'auction' && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <NumberField
                id="startingPrice"
                label="السعر الافتتاحي (ريال)"
                hint="اتركه صفرًا لمزاد مفتوح يبدأ من أول مزايدة"
                register={register}
              />
              <NumberField
                id="minimumIncrement"
                label="الحد الأدنى للزيادة (ريال)"
                hint="أقل فرق بين مزايدة وأخرى"
                register={register}
              />
              <NumberField
                id="reservePrice"
                label="السعر الاحتياطي (سرّي)"
                hint="اتركه صفرًا للبيع بأي مبلغ"
                register={register}
                highlight
              />
            </div>

            <ExplainerBox title="ما السعر الاحتياطي؟">
              هو <b>أقل مبلغ تقبل البيع عنده</b>، ويبقى سرًّا لا يغادر خوادمنا: لا يراه أي مزايد،
              ولا يظهر في أي صفحة أو واجهة. يرى المزايدون «تحقّق» أو «لم يتحقّق» فقط.
              <br />
              <b>لماذا؟</b> لو ظهر الرقم لتحوّل المزاد إلى مساومة عليه ولما تجاوزه أحد.
              <br />
              <b>ماذا يحدث عند انتهاء الوقت؟</b> إن بلغته أعلى مزايدة رست اللوحة على صاحبها،
              وإن لم تبلغه فلا بيع وتُفكّ عرابين الجميع. واتركه صفرًا إن كنت تقبل البيع بأي مبلغ.
            </ExplainerBox>

            <div className="space-y-1.5">
              <Label>مدة المزاد</Label>
              <Select
                value={String(watch('durationSeconds'))}
                onValueChange={(v) => setValue('durationSeconds', Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

          </div>
        )}

        {/*
         * القواعد تُقال لأصحاب الطرق الثلاث لا للمزاد وحده — والعمولة أوّلها.
         *
         * البائع يسعّر لوحته على أساس ما سيصله، وكان لا يكتشف عمولتنا إلا في
         * بطاقة التسوية بعد أن رست الصفقة. ورسمٌ يُكتشف بعد الالتزام يُفسد
         * الثقة أكثر ممّا يجمع.
         */}
        <div className="mt-4">
          <GovernanceNotice
            governance={governance}
            commission={commission}
            auction={saleType === 'auction'}
          />
        </div>
      </section>

      <p className="rounded-xl border border-ink-600 bg-ink-800/60 p-4 text-xs leading-relaxed text-muted">
        معاينة اللوحة رقمية للاستخدام البصري داخل السوق، وليست لوحة رسمية ولا وثيقة حكومية.
        يُسدَّد الثمن عبر المنصّة ويُحجز أمانةً، ويصلك بعد نقلك الملكية وتحقّق الإدارة منها.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {listing ? 'حفظ التعديلات' : 'حفظ كمسودة'}
        </Button>
        <Button type="button" variant="ghost" size="lg" onClick={() => router.back()}>
          إلغاء
        </Button>
      </div>
    </form>
  )
}

function NumberField({
  id,
  label,
  hint,
  register,
  highlight,
}: {
  id: keyof FormValues
  label: string
  /** سطر توضيحي أسفل الحقل — يغني عن تخمين معنى القيمة */
  hint?: string
  register: ReturnType<typeof useForm<FormValues>>['register']
  highlight?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={String(id)} className={highlight ? 'text-gold-500' : undefined}>
        {label}
      </Label>
      <Input
        id={String(id)}
        type="number"
        dir="ltr"
        inputMode="numeric"
        className={highlight ? 'border-gold-600/60' : undefined}
        aria-describedby={hint ? `${String(id)}-hint` : undefined}
        {...register(id, { valueAsNumber: true })}
      />
      {hint && (
        <p id={`${String(id)}-hint`} className="text-[11px] text-muted">
          {hint}
        </p>
      )}
    </div>
  )
}

/** صندوق شرح لقاعدة قد تُساء فهمها — يُفضَّل على تلميح من سطر واحد. */
function ExplainerBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-ink-600 bg-ink-900/60 p-3.5">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-gold-500">
        <Info className="size-3.5" />
        {title}
      </p>
      <p className="text-xs leading-relaxed text-muted">{children}</p>
    </div>
  )
}



/**
 * قواعد المنصّة المطبَّقة على كل مزاد.
 *
 * تُعرض ولا تُعدَّل: البائع يحتاج أن يعرف العربون والمهلة قبل النشر، لكن
 * ضبطها مركزيًا هو ما يضمن قاعدة واحدة على الجميع.
 */
function GovernanceNotice({
  governance,
  commission,
  auction,
}: {
  governance: AuctionSettings
  /** عمولة البائع كما تُحتسب الآن — تُقتطع من حصيلته لا من محفظته */
  commission: CommissionSettings
  /** صفوف المزاد تُعرض لصاحب المزاد وحده */
  auction: boolean
}) {
  /*
   * العمولة نصًّا لا رقمًا واحدًا: قد تكون نسبةً أو مبلغًا ثابتًا، ولها حدّان.
   * والضريبة على العمولة وحدها — تُقال هنا كما تُقال في كل موضع آخر.
   */
  const fee = commission.seller
  const sellerFee = !fee.enabled
    ? 'بلا عمولة'
    : [
        fee.mode === 'percent' ? `${fee.percent}٪ من قيمة الصفقة` : `${formatAmount(fee.fixed)} ريال`,
        fee.min > 0 ? `بحدّ أدنى ${formatAmount(fee.min)}` : null,
        fee.max > 0 ? `وأقصى ${formatAmount(fee.max)}` : null,
        commission.vatEnabled ? `+ ضريبة ${commission.vatPercent}٪ على العمولة` : null,
      ]
        .filter(Boolean)
        .join(' · ')

  const deposit =
    governance.depositMode === 'fixed'
      ? `${formatAmount(governance.depositFixed)} ريال`
      : `${governance.depositPercent}٪ من السعر الافتتاحي (بحد أدنى ${formatAmount(
          governance.depositMin,
        )} وأقصى ${formatAmount(governance.depositMax)} ريال)`

  return (
    <div className="rounded-xl border border-ink-600 bg-ink-900/60 p-4">
      <p className="mb-2.5 flex items-center gap-1.5 text-xs font-bold text-gold-500">
        <ShieldCheck className="size-3.5" />
        قواعد المنصّة المطبَّقة على عرضك
      </p>
      <dl className="grid gap-2.5 text-xs sm:grid-cols-2">
        <Rule label="عمولة المنصّة عليك" value={sellerFee} />
        <Rule label="مهلة سداد المشتري" value={`${governance.paymentWindowHours} ساعة`} />
        {auction && <Rule label="العربون المطلوب من كل مزايد" value={deposit} />}
        {auction && (
          <Rule
            label="التمديد التلقائي"
            value={
              governance.extensionTriggerSeconds > 0
                ? `${governance.extensionDurationSeconds / 60} د عند مزايدة في آخر ${
                    governance.extensionTriggerSeconds / 60
                  } د`
                : 'معطّل'
            }
          />
        )}
        {auction && (
          <Rule
            label="المبلغ المخصّص"
            value={governance.allowCustomBid ? 'مسموح للمزايد' : 'غير مسموح'}
          />
        )}
      </dl>
      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        قواعد موحّدة تضبطها إدارة المنصّة، فلا تختلف من بائع لآخر. والعمولة
        تُقتطع من حصيلتك عند الإفراج لا من محفظتك — فما يصلك هو قيمة الصفقة بعدها.
      </p>
    </div>
  )
}

function Rule({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="mt-0.5 font-bold">{value}</dd>
    </div>
  )
}
