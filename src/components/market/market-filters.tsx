'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Gavel, HandCoins, LayoutGrid, Search, SlidersHorizontal, Tag, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Label } from '@/components/ui/label'
import { useTablistKeys, tabIndexOf } from '@/components/ui/tablist'
import { cn } from '@/lib/utils'
import { PLATE_TYPES, PLATE_TYPE_LABELS, SALE_TYPE_LABELS } from '@/lib/domain/types'
import type { SaleType } from '@/lib/domain/types'
import {
  DEFAULT_MARKET_FILTERS,
  DIGIT_COUNT_LABELS,
  LETTER_COUNT_LABELS,
  type MarketAvailability,
  type MarketFilters as Filters,
  type MarketSort,
} from '@/lib/domain/market-filters'

const AVAILABILITY_LABELS: Record<MarketAvailability, string> = {
  open: 'المتاح للتداول',
  all: 'الكل',
  closed: 'المغلق',
}

const SORT_LABELS: Record<MarketSort, string> = {
  newest: 'الأحدث',
  ending_soon: 'ينتهي قريبًا',
  price_desc: 'الأعلى سعرًا',
  price_asc: 'الأقل سعرًا',
  most_bids: 'الأكثر مزايدات',
}

/** طريقة البيع أهمّ فلتر، فتُعرض شرائح مرئية لا قائمة منسدلة تُخفيها. */
const SALE_TABS = [
  { value: 'all', label: 'الكل', icon: LayoutGrid },
  { value: 'auction', label: SALE_TYPE_LABELS.auction, icon: Gavel },
  { value: 'fixed', label: SALE_TYPE_LABELS.fixed, icon: Tag },
  { value: 'offers', label: SALE_TYPE_LABELS.offers, icon: HandCoins },
] as const

export function MarketFilters({
  value,
  onChange,
  resultCount,
  totalCount,
}: {
  value: Filters
  onChange: (next: Filters) => void
  resultCount: number
  totalCount: number
}) {
  const keys = useTablistKeys()
  const dirty = JSON.stringify(value) !== JSON.stringify(DEFAULT_MARKET_FILTERS)
  const refinements = countRefinements(value)

  return (
    <div className="space-y-3">
      {/* البحث + الترتيب + الفلاتر المتقدّمة */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-64">
          <Search className="pointer-events-none absolute end-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input
            value={value.query}
            onChange={(event) => onChange({ ...value, query: event.target.value })}
            placeholder="ابحث بالحروف أو الأرقام أو رقم الإعلان — مثل: ا ب ح · 4040 · L26-00012"
            className="h-11 rounded-2xl pe-10"
            aria-label="بحث في السوق"
          />
          {value.query && (
            <button
              type="button"
              data-compact
              onClick={() => onChange({ ...value, query: '' })}
              aria-label="مسح البحث"
              className="absolute start-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted transition-colors hover:text-paper"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <Select
          value={value.sort}
          onValueChange={(next) => onChange({ ...value, sort: next as MarketSort })}
        >
          <SelectTrigger className="h-11 w-auto rounded-2xl" aria-label="ترتيب النتائج">
            <SlidersHorizontal className="size-4 opacity-60" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SORT_LABELS) as MarketSort[]).map((key) => (
              <SelectItem key={key} value={key}>
                {SORT_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <AdvancedFilters value={value} onChange={onChange} count={refinements} />
      </div>

      {/*
       * تابات طريقة البيع.
       *
       * كانت شرائح بخلفية ذهبية خلف المختارة، ومؤشّرها `-z-10` فيُرسم **خلف
       * الصفحة** لا خلف النص — فلا يظهر شيء ولا يعرف الزائر أي قسم يتصفّح.
       * صارت تابات على سكّة سفلية: خطّ ذهبي تحت المفتوح يلتصق بالسكّة، وهو ما
       * يقوله شكل التاب بلا شرح.
       */}
      <div
        ref={keys.ref}
        onKeyDown={keys.onKeyDown}
        role="tablist"
        aria-label="طريقة البيع"
        /*
         * أربعة أقسام تقتسم العرض على الجوال — لا شريطٌ يفيض فيُسحب.
         *
         * كان `overflow-x-auto` وأربعةُ أزرارٍ تتجاوز ٣٧٥ بكسل، فيصير الشريط
         * منطقة سحبٍ باللمس: تتحرّك التابات مع الإصبع في كل اتجاه وتتأرجح
         * عند الطرفين بارتداد المتصفّح — وما يُلمس ليَنقُل لا يجوز أن ينزلق.
         *
         * والقسمة بـ`flex-1` تُدخل الأربعة في العرض مهما ضاق: تسقط الأيقونات
         * ويضيق الحشو، فلا فيض ولا سحب. ويعود التمرير فوق `sm` حيث تتّسع
         * الأسماء بأيقوناتها. وهو ما فُعل بتابات المعاملات قبلها.
         */
        className="scrollbar-none -mb-px flex border-b border-ink-600 max-sm:overscroll-x-contain sm:gap-1 sm:overflow-x-auto"
      >
        {SALE_TABS.map((tab) => {
          const active = value.saleType === tab.value
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={active}
              tabIndex={tabIndexOf(active)}
              onClick={() => onChange({ ...value, saleType: tab.value as SaleType | 'all' })}
              className={cn(
                'relative flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap px-1 py-2.5 text-[13px] transition-colors',
                'sm:flex-none sm:shrink-0 sm:gap-2 sm:px-4 sm:text-sm',
                active
                  ? 'font-bold text-gold-500'
                  : 'font-semibold text-muted hover:text-paper',
              )}
            >
              {/* الأيقونة زينةٌ يستغنى عنها حين يضيق العرض، والاسم لا يُستغنى عنه */}
              <tab.icon className="hidden size-4 sm:block" />
              {tab.label}
              {active && (
                <motion.span
                  layoutId="sale-tab"
                  /* على السكّة تمامًا: `-bottom-px` يعوّض `-mb-px` للحاوية */
                  className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-gold-500"
                  transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* الحصيلة ورقائق ما هو مفعّل */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <p aria-live="polite" className="me-auto">
          عرض <span className="font-bold text-paper">{resultCount}</span> من {totalCount} لوحة
          {value.availability === 'open' && totalCount > resultCount && (
            <span className="ms-1">— المغلقة والمباعة مخفيّة</span>
          )}
        </p>

        {value.plateType !== 'all' && (
          <Chip
            label={PLATE_TYPE_LABELS[value.plateType as keyof typeof PLATE_TYPE_LABELS]}
            onClear={() => onChange({ ...value, plateType: 'all' })}
          />
        )}
        {value.letterCount !== 'all' && (
          <Chip
            label={LETTER_COUNT_LABELS[value.letterCount as 1 | 2 | 3]}
            onClear={() => onChange({ ...value, letterCount: 'all' })}
          />
        )}
        {value.digitCount !== 'all' && (
          <Chip
            label={DIGIT_COUNT_LABELS[value.digitCount as 1 | 2 | 3 | 4]}
            onClear={() => onChange({ ...value, digitCount: 'all' })}
          />
        )}
        {/*
          * الرقاقة تُقارَن بـ«الكل» لا بالافتراضي.
          *
          * الافتراضي `open` يُخفي المغلق والمباع، ولأنه هو الافتراضي لم يكن
          * يُعدّ ولا يُرسم — فيقرأ الزائر «عرض 12 من 47» وخمسٌ وثلاثون غائبة
          * بلا سبب ظاهر. ونظام التصميم يوجب عدّاد ما خُفي.
          */}
        {value.availability !== DEFAULT_MARKET_FILTERS.availability && (
          <Chip
            label={AVAILABILITY_LABELS[value.availability]}
            onClear={() =>
              onChange({ ...value, availability: DEFAULT_MARKET_FILTERS.availability })
            }
          />
        )}
        {dirty && (
          <Button variant="ghost" size="sm" onClick={() => onChange(DEFAULT_MARKET_FILTERS)}>
            <X className="size-3.5" />
            مسح الكل
          </Button>
        )}
      </div>
    </div>
  )
}

/** عدد الفلاتر المفعّلة خلف الزرّ — يمنع نسيان فلتر مخفي يُفسّر نتيجة فارغة. */
function countRefinements(value: Filters): number {
  let count = 0
  if (value.plateType !== DEFAULT_MARKET_FILTERS.plateType) count += 1
  if (value.letterCount !== DEFAULT_MARKET_FILTERS.letterCount) count += 1
  if (value.digitCount !== DEFAULT_MARKET_FILTERS.digitCount) count += 1
  /*
   * والحالة الافتراضية لا تُعدّ.
   *
   * كان الشرط `!== 'all'` فيعدّ الافتراضيَّ `open` فلترًا: يفتح الزائر السوق
   * ولم يلمس شيئًا فيجد «فلاتر ①» ورقاقةً تُنسب إليه اختيارًا لم يختره —
   * ويبحث عمّا فعله ليُلغيه. وما خُفي يُقال في سطر الحصيلة («المغلقة
   * والمباعة مخفيّة») لا برايةٍ تدّعي فعلًا.
   */
  return count
}

/**
 * الفلاتر الأقلّ استعمالًا في دُرج.
 * إبقاؤها ظاهرة دائمًا يزحم الشريط على الجوال، وإخفاؤها بلا عدّاد يجعل
 * المستخدم يرى نتيجة فارغة ولا يعرف لماذا.
 */
function AdvancedFilters({
  value,
  onChange,
  count,
}: {
  value: Filters
  onChange: (next: Filters) => void
  count: number
}) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="secondary" className="h-11 rounded-2xl">
          <SlidersHorizontal className="size-4" />
          فلاتر
          {count > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-gold-500 text-[11px] font-extrabold text-ink-950">
              {count}
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent side="bottom" className="overflow-y-auto sm:mx-auto sm:max-w-lg">
        <SheetTitle>تصفية النتائج</SheetTitle>
        <SheetDescription>حدّد نوع اللوحة وحالة العرض.</SheetDescription>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>نوع اللوحة</Label>
            <div className="grid grid-cols-2 gap-2">
              <OptionButton
                active={value.plateType === 'all'}
                onClick={() => onChange({ ...value, plateType: 'all' })}
              >
                كل الأنواع
              </OptionButton>
              {PLATE_TYPES.map((type) => (
                <OptionButton
                  key={type}
                  active={value.plateType === type}
                  onClick={() => onChange({ ...value, plateType: type })}
                >
                  {PLATE_TYPE_LABELS[type]}
                </OptionButton>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>عدد الحروف</Label>
            <div className="grid grid-cols-4 gap-2">
              <OptionButton
                active={value.letterCount === 'all'}
                onClick={() => onChange({ ...value, letterCount: 'all' })}
              >
                الكل
              </OptionButton>
              {([1, 2, 3] as const).map((count) => (
                <OptionButton
                  key={count}
                  active={value.letterCount === count}
                  label={LETTER_COUNT_LABELS[count]}
                  onClick={() => onChange({ ...value, letterCount: count })}
                >
                  {count === 1 ? 'حرف' : count === 2 ? 'حرفان' : 'ثلاثة'}
                </OptionButton>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>عدد الأرقام</Label>
            <div className="grid grid-cols-5 gap-2">
              <OptionButton
                active={value.digitCount === 'all'}
                onClick={() => onChange({ ...value, digitCount: 'all' })}
              >
                الكل
              </OptionButton>
              {([1, 2, 3, 4] as const).map((count) => (
                <OptionButton
                  key={count}
                  active={value.digitCount === count}
                  label={DIGIT_COUNT_LABELS[count]}
                  onClick={() => onChange({ ...value, digitCount: count })}
                >
                  {count}
                </OptionButton>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>حالة العرض</Label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(AVAILABILITY_LABELS) as MarketAvailability[]).map((key) => (
                <OptionButton
                  key={key}
                  active={value.availability === key}
                  onClick={() => onChange({ ...value, availability: key })}
                >
                  {AVAILABILITY_LABELS[key]}
                </OptionButton>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <SheetClose asChild>
            <Button size="lg" className="flex-1">
              عرض النتائج
            </Button>
          </SheetClose>
          {count > 0 && (
            <Button
              size="lg"
              variant="secondary"
              onClick={() =>
                onChange({
                  ...value,
                  plateType: DEFAULT_MARKET_FILTERS.plateType,
                  letterCount: DEFAULT_MARKET_FILTERS.letterCount,
                  digitCount: DEFAULT_MARKET_FILTERS.digitCount,
                  availability: DEFAULT_MARKET_FILTERS.availability,
                })
              }
            >
              مسح
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

/**
 * زرّ خيار في الدُرج.
 *
 * `label` للحالات التي يكون فيها النصّ المعروض مختصرًا لضيق الشبكة
 * («حرفان»، «4»): المختصر يكفي العين لأن العنوان فوقه، ولا يكفي قارئ الشاشة
 * الذي يسمع الزرّ وحده.
 */
function OptionButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean
  onClick: () => void
  label?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors',
        active
          ? 'border-gold-600 bg-gold-500/12 text-gold-500'
          : 'border-ink-600 text-muted hover:border-ink-500 hover:text-paper',
      )}
    >
      {children}
    </button>
  )
}

/**
 * رقاقة فلتر مفعّل.
 *
 * `label` هو النصّ نفسه: رقائق كثيرة كلّها «إزالة الفلتر» لا تُميّز لقارئ
 * الشاشة أيّها يُزال.
 */
function Chip({
  label,
  onClear,
}: {
  label: string
  onClear: () => void
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-ink-600 bg-ink-800 px-2.5 py-1 font-semibold text-paper">
      {label}
      <button
        type="button"
        data-compact
        onClick={onClear}
        aria-label={`إزالة ${label}`}
        className="rounded-full p-0.5 text-muted transition-colors hover:text-danger"
      >
        <X className="size-3" />
      </button>
    </span>
  )
}
