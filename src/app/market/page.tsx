import type { Metadata } from 'next'
import { Gavel, Sparkles } from 'lucide-react'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { PageShell } from '@/components/layout/page-shell'
import { MarketGrid } from '@/components/market/market-grid'
import { Badge } from '@/components/ui/badge'
import { getMarketListings } from '@/lib/server/market-service'
import { SALE_TYPES, type SaleType } from '@/lib/domain/types'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'السوق',
  description: 'تصفّح لوحات المركبات المعروضة للبيع المباشر والمزاد واستقبال العروض.',
}

/** يقبل `?sale=auction|fixed|offers` — روابط الفوتر وأقسام الرئيسية تصل بها. */
export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<{ sale?: string }>
}) {
  const { sale } = await searchParams
  const preset = SALE_TYPES.includes(sale as SaleType) ? (sale as SaleType) : undefined
  const listings = await getMarketListings()
  const liveAuctions = listings.filter(
    (card) => card.saleType === 'auction' && card.status === 'active',
  ).length

  return (
    <PageShell>
      <SiteHeader active="market" />
      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <header className="mb-7">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-extrabold sm:text-3xl">السوق</h1>
            {liveAuctions > 0 && (
              <Badge variant="gold">
                <Gavel className="size-3" />
                {liveAuctions} مزاد جارٍ
              </Badge>
            )}
          </div>
          <p className="mt-2 text-sm text-muted">
            كل لوحة إعلان مستقل: بيع مباشر أو مزاد أو استقبال عروض. التصفّح مفتوح للجميع.
          </p>
        </header>

        {listings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink-600 p-16 text-center">
            <Sparkles className="mx-auto mb-3 size-8 text-muted" />
            <p className="text-base font-bold">لا توجد لوحات معروضة حاليًا</p>
            <p className="mt-1 text-sm text-muted">كن أول من يعرض لوحته في السوق.</p>
          </div>
        ) : (
          <MarketGrid
            initialListings={listings}
            initialServerTime={new Date().toISOString()}
            initialFilters={preset ? { saleType: preset } : undefined}
          />
        )}
      </main>
      <SiteFooter />
    </PageShell>
  )
}
