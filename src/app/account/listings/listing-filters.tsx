'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { isClosedListing, type ListingStatus, type SaleType } from '@/lib/domain/types'

export type ListingFacet = { saleType: SaleType; status: ListingStatus }

/** حالٌ مجموعة — والسبعُ الأصلية لا تسع شريطًا على عرض ٣٦٠. */
type Bucket = 'all' | 'active' | 'draft' | 'closed'

const BUCKETS: { key: Bucket; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'active', label: 'معروضة' },
  { key: 'draft', label: 'مسودّة' },
  { key: 'closed', label: 'أُغلقت' },
]

const SALES: { key: SaleType | 'all'; label: string }[] = [
  { key: 'all', label: 'الكل' },
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
      <Row
        label="طريقة البيع"
        items={SALES.map((item) => ({ ...item, count: countSale(item.key) }))}
        active={sale}
        onPick={(key) => setSale(key as SaleType | 'all')}
      />
      <Row
        label="الحال"
        items={BUCKETS.map((item) => ({ ...item, count: countBucket(item.key) }))}
        active={bucket}
        onPick={(key) => setBucket(key as Bucket)}
      />

      {shown.length === 0 ? (
        <p className="surface rounded-2xl p-6 text-center text-sm text-muted">
          لا لوحة تطابق هذا الترشيح.
        </p>
      ) : (
        <ul className="space-y-3">
          {shown.map((node, index) => (
            <li key={index}>{node}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Row({
  label,
  items,
  active,
  onPick,
}: {
  label: string
  items: { key: string; label: string; count: number }[]
  active: string
  onPick: (key: string) => void
}) {
  return (
    <div
      role="group"
      aria-label={label}
      /* صفٌّ يُسحب أفقيًّا — ولا يُلفّ سطرين فيأكل الشاشة */
      className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {items.map((item) => {
        const on = item.key === active
        return (
          <button
            key={item.key}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(item.key)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors',
              on
                ? 'border-gold-600 bg-gold-500 text-ink-950'
                : 'border-ink-600 bg-ink-800 text-muted hover:text-paper',
            )}
          >
            {item.label}
            <span
              className={cn(
                'rounded-full px-1.5 text-[10px] tabular-nums',
                on ? 'bg-ink-950/15 text-ink-950' : 'bg-ink-700 text-muted',
              )}
            >
              {item.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
