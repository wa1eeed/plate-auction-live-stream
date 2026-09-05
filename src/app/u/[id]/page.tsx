import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LayoutGrid, MapPin, Store } from 'lucide-react'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { PageShell } from '@/components/layout/page-shell'
import { ListingCard } from '@/components/market/listing-card'
import { ShareButton } from '@/components/market/share-button'
import { LocalTime } from '@/components/market/local-time'
import { EmptyState } from '@/components/market/plate-row'
import { getSellerShowcase } from '@/lib/server/market-service'
import { getCurrentUser } from '@/lib/server/require-user'
import { getBrand } from '@/lib/server/brand-service'
import { arabicCount } from '@/lib/utils'

export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params
  const showcase = await getSellerShowcase(id)
  if (!showcase) return { title: 'المعرض' }

  const brand = await getBrand()
  const open = showcase.cards.filter((card) => card.status === 'active').length
  const title = `لوحات ${showcase.seller.displayName}`
  const description = `${open > 0 ? `${open} لوحة معروضة` : 'معرض لوحات'} في ${brand.name}.`

  return {
    title,
    description,
    // معرضٌ يُشارَك: بطاقة الرابط تحمل اسم صاحبه لا اسم المنصّة وحده
    openGraph: { title, description, type: 'profile' },
    twitter: { title, description },
  }
}

/**
 * معرض لوحات يُشارَك.
 *
 * صاحب اللوحات يعرضها في مجالسه ومجموعاته، ولم يكن له إلا أن يرسل رابط كل
 * لوحة وحدها — أو يرسل السوق كلّه ويقول «ابحث عن اسمي». وهذه صفحته: لوحاته
 * وحدها، ببطاقات السوق نفسها لا بشكلٍ ثانٍ يجعلها تبدو من مكانٍ آخر.
 *
 * وما تعرضه هو ما يعرضه السوق ولا شيء غيره — لا بريد ولا جوّال ولا رقم عضوية.
 */
export default async function SellerShowcasePage({ params }: { params: Params }) {
  const { id } = await params
  // من فتح معرضه بنفسه يرى لوحاته موسومةً كما يراها في السوق
  const viewer = await getCurrentUser()
  const showcase = await getSellerShowcase(id, viewer?.id ?? null)
  if (!showcase) notFound()

  const { seller, cards } = showcase
  const serverTime = new Date().toISOString()
  const open = cards.filter((card) => card.status === 'active')
  const closed = cards.filter((card) => card.status !== 'active')

  return (
    <PageShell>
      <SiteHeader active="market" />

      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <header className="surface mb-6 rounded-2xl p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gold-500/12 text-gold-500">
                <Store className="size-6" />
              </span>
              <div>
                <h1 className="text-xl font-extrabold sm:text-2xl">
                  لوحات {seller.displayName}
                </h1>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                  {seller.city && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" />
                      {seller.city}
                    </span>
                  )}
                  <span>
                    عضو منذ <LocalTime iso={seller.memberSince} mode="date" />
                  </span>
                </p>
              </div>
            </div>

            <ShareButton
              title={`لوحات ${seller.displayName}`}
              copiedMessage="نُسخ رابط المعرض"
            />
          </div>

          <p className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink-600/70 pt-4 text-sm">
            <LayoutGrid className="size-4 text-gold-500" />
            <b className="tabular-nums">
              {arabicCount(open.length, {
                zero: 'لا لوحات معروضة الآن',
                one: 'لوحة واحدة معروضة',
                two: 'لوحتان معروضتان',
                few: 'لوحات معروضة',
                many: 'لوحة معروضة',
              })}
            </b>
            {closed.length > 0 && (
              <span className="text-xs text-muted">· و{closed.length} أُغلقت أو بيعت</span>
            )}
          </p>
        </header>

        {cards.length === 0 ? (
          <EmptyState
            title="لا لوحات في هذا المعرض بعد"
            hint="حين يعرض صاحبه لوحةً في السوق تظهر هنا."
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cards.map((card, index) => (
              /*
               * `from` يقول للوحة من أين جاء زائرها.
               *
               * وبه يعود زرّ الرجوع إلى المعرض لا إلى السوق: من فتح رابطًا
               * شاركه صاحب اللوحات لا يعرف السوق ولا جاء منه، فإعادته إليه
               * تُخرجه من حيث دخل.
               */
              <ListingCard
                key={card.id}
                card={card}
                index={index}
                serverTime={serverTime}
                href={`/market/${card.id}?from=${seller.id}`}
              />
            ))}
          </div>
        )}

        <p className="mt-8 text-center text-xs text-muted">
          <Link href="/market" className="font-semibold text-gold-500 hover:underline">
            تصفّح كل اللوحات في السوق
          </Link>
        </p>
      </main>

      <SiteFooter />
    </PageShell>
  )
}
