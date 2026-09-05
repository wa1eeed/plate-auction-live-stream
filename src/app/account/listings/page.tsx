import Link from 'next/link'
import { Plus } from 'lucide-react'
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
            * ولا زرَّ للمعرض هنا.
            *
            * المعرض بابٌ قائم في قائمة الحساب، وزرٌّ ثانٍ إليه من صفحة الإدارة
            * يجعل له مدخلين لشيءٍ واحد — ومن ضغطه ظنّه إجراءً من إجراءات هذه
            * الصفحة لا وجهةً أخرى. وما هنا للإدارة وحدها.
            */}
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
