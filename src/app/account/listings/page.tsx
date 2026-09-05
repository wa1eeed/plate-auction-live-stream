import Link from 'next/link'
import { Plus, Store } from 'lucide-react'
import { ProgressiveList } from '@/components/market/progressive-list'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/market/plate-row'
import { MyListingCard } from './listing-card'
import { getAccountListings } from '@/lib/server/market-service'
import { requireUserId } from '@/lib/server/require-user'

export const dynamic = 'force-dynamic'

export default async function MyListingsPage() {
  const userId = await requireUserId()
  const listings = await getAccountListings(userId)
  // مرجع وقت الخادم: بدونه يقيس عدّاد المزاد على ساعة الجهاز فيكذب بفارقها
  const serverTime = new Date().toISOString()

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">إدارة لوحاتي</h1>
          <p className="mt-1 text-sm text-muted">{listings.length} لوحة</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/*
            * إلى صفحة معرضه لا إلى المعرض نفسه.
            *
            * هذه الصفحة للإدارة، وتلك لضبط المعرض ونسخ رابطه — وبينهما فرقٌ
            * يجب أن يُرى: ما هنا لا يراه أحد سواه، وما هناك يُنشَر.
            */}
          <Button asChild variant="outline">
            <Link href="/account/showcase">
              <Store className="size-4" />
              معرض لوحاتي
            </Link>
          </Button>
          <Button asChild>
            <Link href="/account/listings/new">
              <Plus className="size-4" />
              أضف لوحة
            </Link>
          </Button>
        </div>
      </header>

      {listings.length === 0 ? (
        <EmptyState
          title="لم تُضف أي لوحة بعد"
          hint="أضف لوحتك واختر بيعًا مباشرًا أو مزادًا أو استقبال عروض."
          action={
            <Button asChild>
              <Link href="/account/listings/new">
                <Plus className="size-4" />
                أضف لوحة
              </Link>
            </Button>
          }
        />
      ) : (
        <ProgressiveList>
          {listings.map((listing) => (
            <MyListingCard key={listing.id} listing={listing} serverTime={serverTime} />
          ))}
        </ProgressiveList>
      )}
    </div>
  )
}
