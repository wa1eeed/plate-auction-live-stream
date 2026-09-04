import type { Metadata } from 'next'
import { ListingForm } from '@/components/market/listing-form'
import { getStore } from '@/lib/store'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'أضف لوحة' }

export default async function NewListingPage() {
  const [governance, commission] = await Promise.all([
    getStore().getAuctionSettings(),
    getStore().getCommissionSettings(),
  ])

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold">أضف لوحة</h1>
        <p className="mt-1 text-sm text-muted">
          تُحفظ كمسودة أولًا، ثم تنشرها في السوق متى شئت.
        </p>
      </header>
      <ListingForm governance={governance} commission={commission} />
    </div>
  )
}
