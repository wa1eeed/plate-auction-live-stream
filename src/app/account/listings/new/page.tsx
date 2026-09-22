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
    /*
     * صفحةُ فعلٍ لا تصفّح — فشريط أقسام الحساب يُخفى فوقها على الضيّق.
     *
     * وكان كاروسيلُ الأقسام يعتلي الشاشة الأولى فيدفع اللوحة تحت الطيّة،
     * ويدعو من جاء ليضيف لوحةً إلى الخروج قبل أن يبدأ. انظر `globals.css`.
     */
    <div className="space-y-5" data-focus-page>
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
