'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { LayoutGrid, Loader2, SearchX } from 'lucide-react'
import { ListingCard } from './listing-card'
import { MarketFilters } from './market-filters'
import { Button } from '@/components/ui/button'
import {
  DEFAULT_MARKET_FILTERS,
  filterAndSortListings,
  type MarketFilters as Filters,
} from '@/lib/domain/market-filters'
import type { ListingCard as ListingCardData } from '@/lib/domain/types'
import { SkeletonPlateCard } from '@/components/ui/skeleton'
import { useRealtime } from '@/lib/hooks/use-realtime'

/** حجم الدفعة — يملأ شاشتين على الحاسوب وأربعًا على الجوال. */
const PAGE_SIZE = 12

/**
 * شبكة السوق — تشترك في موضوع «market» فتصلها كل مزايدة أو بيع لحظيًا،
 * وتبقى الأسعار والحالات حيّة أثناء التصفّح بلا استطلاع دوري.
 */
export function MarketGrid({
  initialListings,
  initialServerTime,
  initialFilters,
}: {
  initialListings: ListingCardData[]
  /** مرجع وقت الخادم لعدّادات البطاقات */
  initialServerTime: string
  initialFilters?: Partial<Filters>
}) {
  const [listings, setListings] = useState(initialListings)
  const [serverTime, setServerTime] = useState(initialServerTime)
  const [filters, setFilters] = useState<Filters>({ ...DEFAULT_MARKET_FILTERS, ...initialFilters })

  /**
   * التاب المفتوح يُكتب في الرابط.
   *
   * الرابط يقرأ `?sale=` عند الدخول، فوجب أن يكتبه عند الاختيار وإلا كان
   * الطريق ذا اتجاه واحد: تحديث الصفحة أو مشاركة رابطها يُعيد الزائر إلى
   * «الكل» ولو كان يتصفّح المزادات.
   *
   * `replaceState` لا `router.replace`: التصفية تقع في المتصفّح أصلًا، فطلب
   * تصيير جديد من الخادم عمل بلا أثر — والسجلّ لا يمتلئ بخطوة لكل ضغطة.
   */
  const changeFilters = useCallback((next: Filters) => {
    setFilters(next)
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    if (next.saleType === 'all') url.searchParams.delete('sale')
    else url.searchParams.set('sale', next.saleType)
    if (url.href !== window.location.href) window.history.replaceState(null, '', url)
  }, [])

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/listings', { cache: 'no-store' })
      if (!response.ok) return
      const data = (await response.json()) as { listings: ListingCardData[]; serverTime?: string }
      setListings(data.listings)
      // كل مزامنة تُحدّث المرجع الزمني فلا ينحرف العدّاد مع طول بقاء الصفحة
      if (data.serverTime) setServerTime(data.serverTime)
    } catch {
      // نُبقي آخر نسخة معروضة
    }
  }, [])

  useRealtime({ topics: ['market'], onResync: refresh })

  const visible = useMemo(() => filterAndSortListings(listings, filters), [listings, filters])

  /*
   * تصيير تدريجي — لا طلب لكل صفحة.
   *
   * الشبكة تُصيَّر كاملة فيرسم المتصفّح مئة بطاقة ليرى الزائر أربعًا، ولوحةٌ
   * في كل بطاقة SVG. فتُعرض دفعة أولى ثم تنمو عند بلوغ حارس الأسفل.
   *
   * وحدُّه صريح: **لا يُقلّل حِمل الخادم لأنه أقلّ ما يكون أصلًا** — طلبٌ واحد
   * لا طلب لكل صفحة، والتصفية والترتيب في المتصفّح. وحين يكبر المعروض إلى
   * ألوف تصير التجزئة على الخادم لازمة، وموضعها `/api/listings`.
   */
  const [shown, setShown] = useState(PAGE_SIZE)
  const [appending, startAppending] = useTransition()
  const sentinel = useRef<HTMLDivElement>(null)

  // كل تغيّر في التصفية يعيد العدّ إلى أوّله — وإلا فُتحت النتائج الجديدة على آخرها
  useEffect(() => setShown(PAGE_SIZE), [filters])

  const showMore = useCallback(() => {
    startAppending(() => setShown((count) => count + PAGE_SIZE))
  }, [])

  const hasMore = shown < visible.length

  useEffect(() => {
    const node = sentinel.current
    if (!node || !hasMore) return
    const observer = new IntersectionObserver(
      (entries) => entries[0]?.isIntersecting && showMore(),
      // يبدأ التحميل قبل بلوغ الحافّة بشاشة، فلا يرى الزائر انتظارًا
      { rootMargin: '600px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, showMore])

  return (
    <>
      <div className="mb-6">
        <MarketFilters
          value={filters}
          onChange={changeFilters}
          resultCount={visible.length}
          totalCount={listings.length}
        />
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-600 p-16 text-center">
          <SearchX className="mx-auto mb-3 size-8 text-muted" />
          <p className="text-base font-bold">لا توجد لوحات مطابقة</p>
          <p className="mt-1 text-sm text-muted">جرّب تغيير كلمة البحث أو الفلاتر.</p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-5"
            onClick={() => setFilters(DEFAULT_MARKET_FILTERS)}
          >
            <LayoutGrid className="size-4" />
            عرض كل اللوحات
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.slice(0, shown).map((card, index) => (
              <ListingCard key={card.id} card={card} serverTime={serverTime} index={index} />
            ))}
            {/* هياكل الدفعة القادمة أثناء تصييرها — مواضعها محجوزة فلا تقفز الشبكة */}
            {appending &&
              Array.from({ length: Math.min(PAGE_SIZE, visible.length - shown) }).map((_, index) => (
                <SkeletonPlateCard key={`skeleton-${index}`} />
              ))}
          </div>

          {hasMore && (
            <div ref={sentinel} className="mt-6 flex flex-col items-center gap-2">
              {/*
                * زرٌّ صريح مع الحارس لا بدلًا منه.
                *
                * التمرير اللانهائي وحده يحبس من يتنقّل بلوحة المفاتيح ومن
                * يقرأ بقارئ شاشة: لا حافّة يبلغها المؤشّر. والزرّ مخرجٌ لهما،
                * ويعمل أيضًا حيث لا `IntersectionObserver`.
                */}
              <Button variant="secondary" onClick={showMore} disabled={appending}>
                {appending ? <Loader2 className="size-4 animate-spin" /> : <LayoutGrid className="size-4" />}
                عرض المزيد
              </Button>
              <p aria-live="polite" className="text-xs text-muted">
                عُرضت {Math.min(shown, visible.length)} من {visible.length}
              </p>
            </div>
          )}
        </>
      )}
    </>
  )
}
