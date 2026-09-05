import Link from 'next/link'
import { HandCoins } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState, PlateRow } from '@/components/market/plate-row'
import { ProgressiveList } from '@/components/market/progressive-list'
import { OfferActions } from './offer-actions'
import { formatAmount } from '@/lib/domain/money'
import { OFFER_STATUS_LABELS, type AccountOffer } from '@/lib/domain/types'
import { getOffersMadeByUser, getOffersReceivedByUser } from '@/lib/server/market-service'
import { requireUserId } from '@/lib/server/require-user'
import { formatTimestamp } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function OffersPage() {
  const userId = await requireUserId()
  const [received, made] = await Promise.all([
    getOffersReceivedByUser(userId),
    getOffersMadeByUser(userId),
  ])
  const pending = received.filter((offer) => offer.status === 'pending').length

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold">العروض والسومات</h1>
        <p className="mt-1 text-sm text-muted">عروض وردت على لوحاتك وعروض أرسلتها لغيرك.</p>
      </header>

      <Tabs defaultValue="received">
        <TabsList>
          <TabsTrigger value="received">
            الواردة إليّ
            {pending > 0 && <Badge variant="danger">{pending}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="made">التي أرسلتها ({made.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="received">
          {received.length === 0 ? (
            <EmptyState title="لا توجد عروض واردة" hint="اعرض لوحة بطريقة «استقبال عروض» لتصلك عروض المشترين." />
          ) : (
            <ProgressiveList>
              {received.map((offer) => (
                <OfferRow key={offer.id} offer={offer} side="seller" />
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
              {made.map((offer) => (
                <OfferRow key={offer.id} offer={offer} side="buyer" />
              ))}
            </ProgressiveList>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function OfferRow({ offer, side }: { offer: AccountOffer; side: 'buyer' | 'seller' }) {
  const variant =
    offer.status === 'accepted' ? 'success' : offer.status === 'pending' ? 'gold' : 'muted'

  return (
    <PlateRow
      plate={offer.plate}
      aside={
        <>
          <p className="text-[11px] text-muted">مبلغ العرض</p>
          <p className="text-lg font-extrabold text-gold-500 tabular-nums">{formatAmount(offer.amount)}</p>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={variant}>{OFFER_STATUS_LABELS[offer.status]}</Badge>
        <span className="text-xs text-muted">
          {side === 'seller' ? 'من' : 'إلى'} {offer.counterpartName}
        </span>
      </div>
      {offer.message && <p className="text-xs leading-relaxed text-muted">«{offer.message}»</p>}
      <p className="text-[11px] text-muted">{formatTimestamp(offer.createdAt)}</p>
      <OfferActions offerId={offer.id} status={offer.status} side={side} listingId={offer.listingId} />
    </PlateRow>
  )
}
