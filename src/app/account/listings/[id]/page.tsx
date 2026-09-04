import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ListingForm } from '@/components/market/listing-form'
import { requireUserId } from '@/lib/server/require-user'
import { getStore } from '@/lib/store'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'تعديل اللوحة' }

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const userId = await requireUserId()
  const store = getStore()
  const [listing, governance, commission] = await Promise.all([
    store.getListing(id),
    store.getAuctionSettings(),
    store.getCommissionSettings(),
  ])
  if (!listing || listing.sellerId !== userId) notFound()

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold">تعديل اللوحة</h1>
        <p className="mt-1 text-sm text-muted">لا يمكن التعديل بعد تسجيل مزايدات على اللوحة.</p>
      </header>
      <ListingForm listing={listing} governance={governance} commission={commission} />
    </div>
  )
}
