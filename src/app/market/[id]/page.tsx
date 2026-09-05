import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { PageShell } from '@/components/layout/page-shell'
import { getListingDetail, getSellerShowcase, isServiceError } from '@/lib/server/market-service'
import { getCurrentUser } from '@/lib/server/require-user'
import { getStore } from '@/lib/store'
import { formatAmount } from '@/lib/domain/money'
import { PLATE_TYPE_LABELS, SALE_TYPE_LABELS } from '@/lib/domain/types'
import { listPublicFaq } from '@/lib/server/admin-service'
import { ListingView } from './listing-view'

export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params
  try {
    const detail = await getListingDetail(id)
    const title = `لوحة ${detail.plate.arabicLetters} ${detail.plate.plateNumbers}`
    const price =
      detail.saleType === 'fixed' ? detail.price : (detail.highestAmount ?? detail.startingPrice)
    const description = `${PLATE_TYPE_LABELS[detail.plate.plateType]} · ${SALE_TYPE_LABELS[detail.saleType]} · ${formatAmount(price)} ريال`
    return { title, description, openGraph: { title, description, type: 'website' } }
  } catch {
    return { title: 'اللوحة' }
  }
}

export default async function ListingPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: Promise<{ from?: string }>
}) {
  const { id } = await params
  const { from } = await searchParams
  const user = await getCurrentUser()

  let detail
  try {
    detail = await getListingDetail(id, user?.id ?? null)
  } catch (error) {
    if (isServiceError(error) && error.status === 404) notFound()
    throw error
  }

  // عدّاد المشاهدات يتجاهل صاحب الإعلان
  if (!user || user.id !== detail.seller.id) await getStore().incrementViews(id)

  // الأسئلة المعلّمة «تظهر في صفحة المزاد» فقط — لا كل الأسئلة
  const faq = await listPublicFaq(true)

  /*
   * الرجوع إلى حيث دخل الزائر لا إلى السوق دائمًا.
   *
   * من فتح رابطًا شاركه صاحب اللوحات لم يمرّ بالسوق ولا يعرفه، فإعادته إليه
   * تُخرجه من حيث دخل. و`from` يحمل معرّف صاحب المعرض — ويُتحقّق منه هنا فلا
   * يُصنع رابطُ رجوعٍ إلى معرضٍ لا وجود له.
   */
  const origin = from ? await getSellerShowcase(from) : null
  const backTo = origin
    ? { href: `/u/${origin.seller.id}`, label: `لوحات ${origin.seller.displayName}` }
    : { href: '/market', label: 'السوق' }

  return (
    <PageShell>
      <SiteHeader active="market" />
      <ListingView faq={faq} initialDetail={detail} isSignedIn={Boolean(user)} backTo={backTo} />
      <SiteFooter />
    </PageShell>
  )
}
