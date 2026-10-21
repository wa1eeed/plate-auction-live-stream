'use client'

import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { isClosedListing, type ListingStatus, type SaleType } from '@/lib/domain/types'

export type ListingFacet = { saleType: SaleType; status: ListingStatus }

/** حالٌ مجموعة — والسبعُ الأصلية لا تسع شريطًا على عرض ٣٦٠. */
type Bucket = 'all' | 'active' | 'draft' | 'closed'

/*
 * «كلّ الحالات» و«كلّ الطرق» لا «الكل» مرّتين.
 *
 * فالصفّان مرشّحان مستقلّان، وكان أوّلُ كلٍّ منهما «الكل» مضيئًا — شارتان
 * متطابقتان فوق بعض، فلا يُعرف أيُّهما يُلغي ماذا.
 */
const BUCKETS: { key: Bucket; label: string }[] = [
  { key: 'all', label: 'كلّ الحالات' },
  { key: 'active', label: 'معروضة' },
  { key: 'draft', label: 'مسودّة' },
  { key: 'closed', label: 'أُغلقت' },
]

const SALES: { key: SaleType | 'all'; label: string }[] = [
  { key: 'all', label: 'كلّ الطرق' },
  { key: 'auction', label: 'مزاد' },
  { key: 'fixed', label: 'مباشر' },
  { key: 'offers', label: 'تفاوض' },
]

const bucketOf = (status: ListingStatus): Bucket =>
  status === 'draft' ? 'draft' : isClosedListing(status) ? 'closed' : 'active'

/**
 * **ترشيحٌ في المتصفّح لا رحلةٌ إلى الخادم.**
 *
 * والترشيح بالمسار (`?status=`) يعني في هذه المنصّة رحلةً كاملة: كلُّ صفحةٍ
 * `force-dynamic`. فضغطةُ شريحةٍ تنتظر الشبكة، وهي في التطبيقات الأصيلة
 * فوريّة — وذلك الفرقُ يُحسّ قبل أن يُوصف.
 *
 * واللوحاتُ مصيَّرةٌ في الخادم كما هي، ولا يُعاد بناؤها هنا: يُخفى ما لا
 * يطابق ويُظهر ما يطابق. فيبقى التصيير حيث هو، ويبقى الردّ فوريًّا.
 */
export function ListingFilters({
  facets,
  children,
}: {
  facets: ListingFacet[]
  children: React.ReactNode[]
}) {
  const [sale, setSale] = useState<SaleType | 'all'>('all')
  const [bucket, setBucket] = useState<Bucket>('all')

  const matches = (facet: ListingFacet) =>
    (sale === 'all' || facet.saleType === sale) &&
    (bucket === 'all' || bucketOf(facet.status) === bucket)

  /** عددُ ما يقع تحت شريحةٍ لو اختيرت — مع الترشيح الآخر قائمًا. */
  const countSale = (key: SaleType | 'all') =>
    facets.filter(
      (f) => (key === 'all' || f.saleType === key) && (bucket === 'all' || bucketOf(f.status) === bucket),
    ).length
  const countBucket = (key: Bucket) =>
    facets.filter(
      (f) => (key === 'all' || bucketOf(f.status) === key) && (sale === 'all' || f.saleType === sale),
    ).length

  const shown = children.filter((_, index) => facets[index] && matches(facets[index]))

  return (
    <div className="space-y-3">
      {/*
        * **مُنتقيان ورقمٌ — لا ثمانيةُ أزرارٍ في صفّين يُسحبان.**
        *
        * وكانت الشرائحُ ثمانيًا في صفّين أفقيّين: أربعٌ لطريقة البيع وأربعٌ
        * للحال، كلٌّ منهما يُسحب بالإصبع. فتأخذ من الشاشة سطرين قبل أوّل
        * لوحة، ولا يُرى ما اختير إلّا بالتمرير إليه.
        *
        * **والمنتقي الأصليّ لا قائمةٌ مبنيّة**: يفتح منتقي النظام نفسه —
        * عجلةً في iOS وقائمةً في أندرويد — فيُحسّ من التطبيق لا من صفحة
        * ويب. وهو المسلكُ نفسُه في تابز الإعدادات.
        *
        * وكلُّ خيارٍ يحمل عددَه، فيُعرف ما وراءه قبل اختياره. والرقمُ إلى
        * جانبهما حصيلةُ الاثنين معًا — وهو ما يُبحث عنه بعد الترشيح.
        */}
      <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
        <Picker
          label="نوع البيع"
          value={sale}
          onPick={(key) => setSale(key as SaleType | 'all')}
          items={SALES.map((item) => ({ ...item, count: countSale(item.key) }))}
        />
        <Picker
          label="حالة العرض"
          value={bucket}
          onPick={(key) => setBucket(key as Bucket)}
          items={BUCKETS.map((item) => ({ ...item, count: countBucket(item.key) }))}
        />
        <span
          aria-label={`${shown.length} لوحة بعد الترشيح`}
          className="grid h-11 min-w-11 place-items-center rounded-xl border border-gold-600/45 bg-gold-500/10 px-2 text-sm font-extrabold tabular-nums text-gold-500"
        >
          {shown.length}
        </span>
      </div>

      {shown.length === 0 ? (
        <p className="surface rounded-2xl p-6 text-center text-sm text-muted">
          لا لوحة تطابق هذا الترشيح.
        </p>
      ) : (
        /*
         * **ولا يُلفّ المصفوفُ في `li` ثانية.**
         *
         * فـ`MyListingCard` يُصيّر `<li>` بنفسه، وكان يُلفّ هنا في `<li>`
         * أخرى — و`li` داخل `li` ترميزٌ غير صحيح. والمتصفّح يُصلحه بنقل
         * الداخلة خارج أختها، فيخالف ما رُسم في الخادم ما رُطِّب في
         * المتصفّح: **سقط الترطيبُ كلُّه** وأُعيد بناءُ الشجرة في العميل.
         * قُرئ في وحدة التحكّم: «Hydration failed… <li> cannot be a
         * descendant of <li>».
         */
        <ul className="space-y-3">{shown}</ul>
      )}
    </div>
  )
}

function Picker({
  label,
  items,
  value,
  onPick,
}: {
  label: string
  items: { key: string; label: string; count: number }[]
  value: string
  onPick: (key: string) => void
}) {
  /*
   * `useId` لا الاسمُ العربيّ: «نوع البيع» فيه مسافة، ومُعرّفٌ بمسافةٍ
   * ترميزٌ غير صحيح لا يُنتقى بمحدِّد CSS. وهو المسلكُ نفسُه في اللوحة.
   */
  const id = useId()
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block truncate text-[11px] font-bold text-muted">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(event) => onPick(event.target.value)}
          /* `ps-3 pe-8`: مكانُ السهم محجوزٌ فلا يركب النصّ عليه */
          className="h-11 w-full appearance-none truncate rounded-xl border border-ink-600 bg-ink-800 ps-3 pe-8 text-xs font-bold text-paper outline-none transition-colors focus-visible:border-gold-500"
        >
          {items.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label} ({item.count})
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute inset-y-0 end-2.5 my-auto size-4 text-muted"
        />
      </div>
    </div>
  )
}
