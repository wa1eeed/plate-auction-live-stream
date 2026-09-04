import Link from 'next/link'
import { AlertTriangle, Crown, Gavel } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CompactCountdown } from '@/components/market/auction-countdown'
import { ProgressiveList } from '@/components/market/progressive-list'
import { EmptyState, PlateRow } from '@/components/market/plate-row'
import { formatAmount } from '@/lib/domain/money'
import { arabicCount } from '@/lib/utils'
import { LISTING_STATUS_LABELS, isClosedListing } from '@/lib/domain/types'
import { getAccountBids } from '@/lib/server/market-service'
import { requireUserId } from '@/lib/server/require-user'

export const dynamic = 'force-dynamic'

export default async function MyBidsPage() {
  const userId = await requireUserId()
  const bids = await getAccountBids(userId)
  // مرجع واحد لعدّادات الصفحة، فلا تنحرف بساعة الجهاز
  const serverTime = new Date().toISOString()

  /*
   * ثلاثة أقسام مرتّبة بالإلحاح لا صفّ واحد مرتّب بمن هو الأعلى.
   *
   * كانت مزايدة تجاوزك فيها غيرك ولم يبقَ لها دقيقتان تجلس تحت مزادٍ أنت
   * الأعلى فيه وأمامه ثلاثة أيام — والمنتهية منذ شهر مبعثرة بينها. والقسم
   * الأوّل هو ما يضيع إن لم يُرَ الآن.
   */
  const soonest = (rows: typeof bids) =>
    [...rows].sort((a, b) => (a.remainingMs ?? Infinity) - (b.remainingMs ?? Infinity))

  const live = bids.filter((b) => !isClosedListing(b.listingStatus))
  const groups = [
    { key: 'outbid', title: 'تحتاج مزايدتك', rows: soonest(live.filter((b) => !b.isHighest)) },
    { key: 'leading', title: 'أنت الأعلى فيها', rows: soonest(live.filter((b) => b.isHighest)) },
    { key: 'closed', title: 'منتهية', rows: bids.filter((b) => isClosedListing(b.listingStatus)) },
  ].filter((group) => group.rows.length > 0)

  const leading = live.filter((b) => b.isHighest).length
  const outbid = live.filter((b) => !b.isHighest).length
  const won = bids.filter((b) => b.isHighest && b.listingStatus === 'sold').length

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">مزايداتي</h1>
          <p className="mt-1 text-sm text-muted">
            {arabicCount(bids.length, {
              zero: 'لم تزايد بعد',
              one: 'لوحة واحدة زايدت عليها',
              two: 'لوحتان زايدت عليهما',
              few: 'لوحات زايدت عليها',
              many: 'لوحة زايدت عليها',
            })}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {leading > 0 && <Badge variant="gold">{leading} أنت الأعلى</Badge>}
          {outbid > 0 && <Badge variant="danger">{outbid} تمت المزايدة عليك</Badge>}
          {won > 0 && <Badge variant="success">{won} رست عليك</Badge>}
        </div>
      </header>

      {bids.length === 0 ? (
        <EmptyState
          title="لم تزايد على أي لوحة بعد"
          hint="تصفّح المزادات الجارية وابدأ المزايدة."
          action={
            <Button asChild>
              <Link href="/market">
                <Gavel className="size-4" />
                تصفّح السوق
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.key}>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-bold">
                {group.title}
                <span className="rounded-full bg-ink-700 px-1.5 py-px text-[11px] font-bold tabular-nums text-muted">
                  {group.rows.length}
                </span>
              </h2>
              <ProgressiveList>
          {group.rows.map((bid) => {
            const closed = isClosedListing(bid.listingStatus)
            return (
              <PlateRow
                key={bid.listingId}
                plate={bid.plate}
                href={`/market/${bid.listingId}`}
                aside={
                  <>
                    <p className="text-[11px] text-muted">أعلى مزايدة</p>
                    <p className="text-lg font-extrabold text-gold-500 tabular-nums">
                      {formatAmount(bid.currentHighest ?? bid.myHighest)}
                    </p>
                    {/*
                      * عدّاد حيّ لمزاد حيّ.
                      *
                      * كان نصًّا مصيَّرًا على الخادم يقول «يتبقّى 1:23:45» ولا
                      * يتحرّك — فيقرؤه صاحبه بعد دقائق فيظنّ أمامه وقتًا مضى.
                      */}
                    {!closed && bid.endsAt && (
                      <CompactCountdown
                        endsAt={bid.endsAt}
                        serverTime={serverTime}
                        className="mt-1"
                      />
                    )}
                  </>
                }
              >
                {bid.isHighest ? (
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-bold ${closed ? 'text-success' : 'text-gold-500'}`}
                  >
                    <Crown className="size-3.5" />
                    {closed
                      ? bid.listingStatus === 'sold'
                        ? 'رست عليك'
                        : 'أنت الأعلى — لم يتحقق السعر'
                      : 'أنت أعلى مزايد'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-danger">
                    <AlertTriangle className="size-3.5" />
                    {closed ? 'لم ترسُ عليك' : 'تمت المزايدة عليك'}
                  </span>
                )}
                <p className="text-xs text-muted">
                  مزايدتك: <span className="font-bold text-paper">{formatAmount(bid.myHighest)}</span> ريال
                </p>
                {closed && <Badge variant="muted">{LISTING_STATUS_LABELS[bid.listingStatus]}</Badge>}
              </PlateRow>
            )
          })}
              </ProgressiveList>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
