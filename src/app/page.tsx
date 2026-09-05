import Link from 'next/link'
import { Gavel, Lock, ShieldCheck, Timer, Wallet } from 'lucide-react'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { PageShell } from '@/components/layout/page-shell'
import { HomeHero } from '@/components/market/home-hero'
import { PlateCarousel } from '@/components/market/plate-carousel'
import { Card, CardContent } from '@/components/ui/card'
import { config, DEMO_PRIMARY_USER } from '@/lib/config'
import { getMarketListings } from '@/lib/server/market-service'
import { getBrand } from '@/lib/server/brand-service'
import { getStore } from '@/lib/store'
import type { ListingCard } from '@/lib/domain/types'

export const dynamic = 'force-dynamic'

/*
 * الأيقونات تبقى في الشيفرة والنصّ يأتي من الإدارة.
 *
 * الأيقونة رمزٌ يقابل موضعًا لا كلمة، فالترتيب هو الرابط: البطاقة الأولى
 * تأخذ الأولى. ولذلك عدد البطاقات مثبَّتٌ عند ستٍّ في `PageSettings`.
 */
const FEATURE_ICONS = [Lock, Wallet, Timer, Gavel, ShieldCheck, ShieldCheck]

export default async function HomePage() {
  const [listings, brand, pages] = await Promise.all([
    getMarketListings(),
    getBrand(),
    getStore().getPageSettings(),
  ])
  const serverTime = new Date().toISOString()

  const open = listings.filter((card) => card.status === 'active')
  const by = (saleType: ListingCard['saleType']) =>
    open.filter((card) => card.saleType === saleType).slice(0, 10)

  const auctions = by('auction')
  const fixed = by('fixed')
  const offers = by('offers')

  return (
    <PageShell>
      <SiteHeader />

      <main id="main" className="flex-1">
        <HomeHero
          brand={brand}
          plates={open.slice(0, 3).map((card) => card.plate)}
          stats={{
            active: open.length,
            liveAuctions: auctions.length,
            sold: listings
              .filter((card) => card.status === 'sold')
              .reduce((sum, card) => sum + card.displayPrice, 0),
          }}
        />

        {/* خلاصات المعروض — قسم لكل طريقة بيع */}
        <div className="mx-auto w-full max-w-7xl space-y-12 px-4 py-12 sm:px-6 lg:py-16">
          <PlateCarousel
            title="مزادات جارية"
            description="مزايدات تصاعدية بمدّة محدّدة وتمديد تلقائي — زايد قبل انتهاء الوقت."
            icon="gavel"
            accent="gold"
            cards={auctions}
            serverTime={serverTime}
            href="/market?sale=auction"
            emptyLabel="لا توجد مزادات جارية حاليًا."
          />

          <PlateCarousel
            title="بيع مباشر"
            description="سعر ثابت معلن — تملكها بضغطة واحدة بلا مزايدة ولا انتظار."
            icon="tag"
            accent="success"
            cards={fixed}
            serverTime={serverTime}
            href="/market?sale=fixed"
            emptyLabel="لا توجد لوحات معروضة للبيع المباشر حاليًا."
          />

          <PlateCarousel
            title="على السوم"
            description="أرسل عرضك ويختار البائع ما يناسبه — للوحات بلا سعر معلن."
            icon="offers"
            accent="sky"
            cards={offers}
            serverTime={serverTime}
            href="/market?sale=offers"
            emptyLabel="لا توجد لوحات تستقبل عروضًا حاليًا."
          />
        </div>

        {/* لماذا هذه المنصّة */}
        <section className="border-t border-ink-600/70 bg-ink-900/30">
          <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-extrabold sm:text-3xl">{pages.trust.title}</h2>
              <p className="mt-3 text-pretty text-sm leading-relaxed text-muted">
                {pages.trust.body}
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pages.trust.features.map((feature, index) => {
                const Icon = FEATURE_ICONS[index] ?? FEATURE_ICONS[0]
                return (
                <Card
                  key={index}
                  className="group transition-[transform,border-color] duration-[var(--duration-base)] ease-[var(--ease-smooth)] hover:-translate-y-1 hover:border-gold-600/50"
                >
                  <CardContent className="p-5">
                    <span className="mb-3.5 flex size-10 items-center justify-center rounded-xl border border-gold-600/40 bg-gold-500/10 text-gold-500 transition-transform duration-[var(--duration-base)] ease-[var(--ease-spring)] group-hover:scale-110">
                      <Icon className="size-4.5" />
                    </span>
                    <h3 className="font-bold">{feature.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">{feature.body}</p>
                  </CardContent>
                </Card>
                )
              })}
            </div>
          </div>
        </section>

        {config.demoHints && (
          <div className="mx-auto w-full max-w-7xl px-4 pb-14 pt-12 sm:px-6">
            <div className="ring-gold rounded-3xl bg-gold-500/[0.06] p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-extrabold">جرّب المنصّة الآن</h2>
                  <p className="mt-1.5 text-sm text-muted">
                    حسابات تجريبية جاهزة، كل حساب يبيع ويشتري ورصيده مشحون.
                  </p>
                </div>
                <Link
                  href="/login"
                  className="rounded-xl bg-gold-500 px-4 py-2.5 text-sm font-bold text-ink-950 transition-colors hover:bg-gold-400"
                >
                  دخول بحساب تجريبي
                </Link>
              </div>
              <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                <Credential label="البريد" value={DEMO_PRIMARY_USER.email} />
                <Credential label="كلمة المرور" value={DEMO_PRIMARY_USER.password} />
              </dl>
            </div>
          </div>
        )}
      </main>

      <SiteFooter />
    </PageShell>
  )
}

function Credential({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface rounded-xl px-4 py-3">
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd dir="ltr" className="text-start font-mono text-sm font-bold text-paper">
        {value}
      </dd>
    </div>
  )
}
