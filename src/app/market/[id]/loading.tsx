import { PageShell } from '@/components/layout/page-shell'
import { SiteHeader } from '@/components/layout/site-header'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * انتظار صفحة الإعلان.
 *
 * لها هيكلها الخاصّ لا هيكل الشبكة: `/market/[id]` ابنُ `/market`، فلولا هذا
 * الملفّ لظهرت شبكة بطاقات مكان لوحة واحدة — ثم قفزت الصفحة كلّها عند وصول
 * المحتوى.
 */
export default function ListingLoading() {
  return (
    <PageShell>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <Skeleton className="h-9 w-24 rounded-lg" />
        <div className="mt-5 grid gap-6 lg:grid-cols-[1.05fr_1fr]">
          <div className="space-y-4">
            <Skeleton className="aspect-[2.6/1] w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-56 w-full rounded-2xl" />
          </div>
        </div>
      </main>
    </PageShell>
  )
}
