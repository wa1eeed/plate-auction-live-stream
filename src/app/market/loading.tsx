import { PageShell } from '@/components/layout/page-shell'
import { SiteHeader } from '@/components/layout/site-header'
import { Skeleton, SkeletonPlateCard } from '@/components/ui/skeleton'

export default function MarketLoading() {
  return (
    <PageShell>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-4 w-72" />
        <Skeleton className="mt-6 h-12 w-full rounded-2xl" />
        <div className="mt-4 flex gap-2">
          <Skeleton className="h-10 w-20 rounded-lg" />
          <Skeleton className="h-10 w-20 rounded-lg" />
          <Skeleton className="h-10 w-24 rounded-lg" />
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <SkeletonPlateCard key={index} />
          ))}
        </div>
      </main>
    </PageShell>
  )
}
