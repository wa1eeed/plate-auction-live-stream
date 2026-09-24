import Link from 'next/link'
import { HandCoins } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState, PlateRow } from '@/components/market/plate-row'
import { ProgressiveList } from '@/components/market/progressive-list'
import { OfferThread } from './offer-thread'
import { formatAmount } from '@/lib/domain/money'
import { isOpenOffer, type AccountOffer } from '@/lib/domain/types'
import { getOffersMadeByUser, getOffersReceivedByUser } from '@/lib/server/market-service'
import { requireUserId } from '@/lib/server/require-user'

export const dynamic = 'force-dynamic'

/**
 * العروضُ مجموعةً باللوحة لا مصفوفةً بالتاريخ.
 *
 * والقرارُ هنا قرارُ لوحة: «بكم أبيع هذه؟» لا «ماذا أفعل بالعرض الفلانيّ».
 * فحين تتناثر عروضُ اللوحة الواحدة بين عروضِ غيرها مرتَّبةً بالوقت، يقبل
 * البائعُ عرضًا وفي القائمة أعلى منه لم يره — ولا فرقَ عنده، فالبابُ يُغلق
 * بأوّل قبول. فجُمعت عروضُ كلّ لوحة تحتها، مرتَّبةً بالمبلغ، وعليها «الأعلى».
 */
function groupByListing(offers: AccountOffer[]): { listingId: string; offers: AccountOffer[] }[] {
  const groups = new Map<string, AccountOffer[]>()
  for (const offer of offers) {
    const bucket = groups.get(offer.listingId)
    if (bucket) bucket.push(offer)
    else groups.set(offer.listingId, [offer])
  }
  return [...groups.entries()]
    .map(([listingId, list]) => ({
      listingId,
      /* الأعلى أوّلًا، والمفتوحُ قبل المنتهي — فما يُردّ عليه في الصدارة */
      offers: [...list].sort(
        (a, b) => Number(isOpenOffer(b.status)) - Number(isOpenOffer(a.status)) || b.amount - a.amount,
      ),
    }))
    /* اللوحةُ التي عليها عرضٌ مفتوحٌ أوّلًا — وإلا فالأحدث */
    .sort(
      (a, b) =>
        Number(a.offers.every((offer) => !isOpenOffer(offer.status))) -
          Number(b.offers.every((offer) => !isOpenOffer(offer.status))) ||
        Date.parse(b.offers[0].createdAt) - Date.parse(a.offers[0].createdAt),
    )
}

export default async function OffersPage() {
  const userId = await requireUserId()
  const [received, made] = await Promise.all([
    getOffersReceivedByUser(userId),
    getOffersMadeByUser(userId),
  ])
  const open = received.filter((offer) => isOpenOffer(offer.status)).length
  /* ما ينتظر ردَّ صاحب الصفحة: السومُ الوارد لا عرضُه هو */
  const awaiting = made.filter((offer) => offer.status === 'countered').length

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold">العروض والسومات</h1>
        <p className="mt-1 text-sm text-muted">
          العرضُ من المشتري، والسومُ ردُّ البائع عليه بمبلغٍ أعلى — وكلاهما يُلزم صاحبه متى قُبل.
        </p>
      </header>

      <Tabs defaultValue="received">
        <TabsList>
          <TabsTrigger value="received">
            الواردة إليّ
            {open > 0 && <Badge variant="danger">{open}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="made">
            التي أرسلتها
            {awaiting > 0 && <Badge variant="gold">{awaiting}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="received">
          {received.length === 0 ? (
            <EmptyState
              title="لا توجد عروض واردة"
              hint="اعرض لوحة بطريقة «استقبال عروض» لتصلك عروض المشترين."
            />
          ) : (
            <ProgressiveList>
              {groupByListing(received).map((group) => (
                <OfferGroup key={group.listingId} offers={group.offers} side="seller" />
              ))}
            </ProgressiveList>
          )}
        </TabsContent>

        <TabsContent value="made">
          {made.length === 0 ? (
            <EmptyState
              title="لم ترسل أي عرض"
              hint="ابحث عن لوحة تستقبل العروض وأرسل عرضك."
              action={
                <Button asChild>
                  <Link href="/market">
                    <HandCoins className="size-4" />
                    تصفّح السوق
                  </Link>
                </Button>
              }
            />
          ) : (
            <ProgressiveList>
              {groupByListing(made).map((group) => (
                <OfferGroup key={group.listingId} offers={group.offers} side="buyer" />
              ))}
            </ProgressiveList>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function OfferGroup({ offers, side }: { offers: AccountOffer[]; side: 'buyer' | 'seller' }) {
  const head = offers[0]
  const openCount = offers.filter((offer) => isOpenOffer(offer.status)).length
  const top = Math.max(...offers.map((offer) => offer.amount))

  return (
    <PlateRow
      plate={head.plate}
      rowId={`offers-${head.listingId}`}
      aside={
        <>
          <p className="text-[11px] text-muted">المطلوب</p>
          <p className="text-lg font-extrabold tabular-nums text-paper">
            {formatAmount(head.listingAsk)}
          </p>
          <p className="mt-1 text-[11px] text-muted">أعلى عرض</p>
          <p className="text-base font-extrabold tabular-nums text-gold-500">{formatAmount(top)}</p>
        </>
      }
      footer={
        <div className="space-y-3 border-t border-ink-600 pt-3">
          {offers.map((offer) => (
            <OfferThread key={offer.id} offer={offer} side={side} />
          ))}
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={openCount > 0 ? 'gold' : 'muted'}>
          {openCount > 0 ? `${openCount} قائم` : 'انتهت'}
        </Badge>
        <span className="text-xs text-muted">
          {offers.length === 1 ? 'عرضٌ واحد' : `${offers.length} عروض`}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-muted">
        <Link href={`/market/${head.listingId}`} className="hover:text-gold-500">
          عرضُ اللوحة في السوق
        </Link>
      </p>
    </PlateRow>
  )
}
