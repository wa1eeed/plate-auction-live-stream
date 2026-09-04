import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, ExternalLink, Gavel, Users, Wallet } from 'lucide-react'
import { AdminHeader, AdminTable, Money, Td, Tr } from '@/components/admin/admin-ui'
import { ListingAdminActions } from '@/components/admin/listing-admin-actions'
import { SaudiLicensePlate } from '@/components/plate/SaudiLicensePlate'
import { LocalTime, LocalZoneNote } from '@/components/market/local-time'
import { ReferenceChip } from '@/components/market/reference-chip'
import { ContactCard, SocialLinks } from '@/components/admin/contact-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DEPOSIT_STATUS_LABELS,
  LISTING_STATUS_LABELS,
  OFFER_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  PLATE_TYPE_LABELS,
  SALE_TYPE_LABELS,
  isClosedListing,
} from '@/lib/domain/types'
import { REFERENCE_LABELS } from '@/lib/domain/reference'
import { formatAmount } from '@/lib/domain/money'
import { getListingAdminDetail } from '@/lib/server/admin-service'
import { requireAdminId } from '@/lib/server/require-admin'
import { compactCountdown } from '@/lib/domain/countdown'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'تفاصيل الإعلان' }

export default async function AdminListingPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminId()
  const { id } = await params

  const detail = await getListingAdminDetail(id).catch(() => null)
  if (!detail) notFound()

  const { listing, plate, seller, bids, participants, offers, orders, deposits, summary } = detail
  const isAuction = listing.saleType === 'auction'
  const live = listing.status === 'active' && summary.remainingMs > 0

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-3">
        <Link href="/admin/listings">
          <ArrowRight className="size-4" />
          كل الإعلانات
        </Link>
      </Button>

      <AdminHeader
        title={`${plate.arabicLetters} ${plate.plateNumbers}`}
        description={`${SALE_TYPE_LABELS[listing.saleType]} · ${PLATE_TYPE_LABELS[plate.plateType]}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {/* المشاهدة الحيّة في نافذة جديدة: الإدارة لا تُدفع خارج لوحتها */}
            <Button asChild variant="secondary" size="sm">
              <Link href={`/market/${listing.id}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" />
                مشاهدة حيّة في السوق
              </Link>
            </Button>
            {(!isClosedListing(listing.status) || listing.status === 'suspended') && (
              <ListingAdminActions
                listingId={listing.id}
                label={`${plate.arabicLetters} ${plate.plateNumbers}`}
                suspended={listing.status === 'suspended'}
              />
            )}
          </div>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <ReferenceChip reference={listing.reference} />
        <span className="text-xs text-muted">{REFERENCE_LABELS.listing}</span>
        <Badge
          variant={
            listing.status === 'suspended'
              ? 'danger'
              : listing.status === 'active'
                ? 'gold'
                : 'muted'
          }
        >
          {LISTING_STATUS_LABELS[listing.status]}
        </Badge>
        {live && <Badge variant="success">{compactCountdown(summary.remainingMs)}</Badge>}
      </div>

      <ContactCard phone={seller.phone} social={seller.social} className="mb-5" />

      <div className="mb-5 grid gap-4 lg:grid-cols-[300px_1fr] lg:items-start">
        <div className="rounded-2xl border border-ink-600 bg-ink-800 p-4">
          <SaudiLicensePlate {...plate} size="card" className="w-full" />
          <dl className="mt-4 space-y-2 text-xs">
            <Row label="البائع">
              <Link href={`/admin/users/${seller.reference}`} className="font-bold hover:underline">
                {seller.name}
              </Link>
            </Row>
            <Row label="بريده">{seller.email}</Row>
            <Row label="جوّاله">
              {seller.phone ? (
                <a href={`tel:${seller.phone.replace(/\s/g, '')}`} dir="ltr" className="tabular-nums hover:underline">
                  {seller.phone}
                </a>
              ) : (
                <span className="text-muted">—</span>
              )}
            </Row>
            <Row label="نُشر">
              <LocalTime iso={listing.startsAt} mode="datetime" />
            </Row>
            {listing.endsAt && (
              <Row label="ينتهي">
                <LocalTime iso={listing.endsAt} mode="datetime" />
              </Row>
            )}
          </dl>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            icon={Gavel}
            label={isAuction ? 'أعلى مزايدة' : 'السعر'}
            value={formatAmount(
              summary.highest ?? (listing.saleType === 'fixed' ? listing.price : listing.startingPrice),
            )}
          />
          <Stat icon={Users} label="عدد المزايدين" value={String(summary.bidderCount)} plain />
          <Stat icon={Wallet} label="عرابين محجوزة" value={formatAmount(summary.heldDeposits)} />
          {isAuction && (
            <Stat
              icon={Gavel}
              label="السعر الاحتياطي"
              value={listing.reservePrice > 0 ? formatAmount(listing.reservePrice) : 'بلا احتياطي'}
              tone={
                listing.reservePrice === 0 ? undefined : summary.reserveMet ? 'success' : 'danger'
              }
              hint={
                listing.reservePrice === 0
                  ? 'يبيع بأي مبلغ'
                  : summary.reserveMet
                    ? 'تحقّق'
                    : 'لم يتحقّق بعد'
              }
            />
          )}
        </div>
      </div>

      <Tabs defaultValue="bids">
        <TabsList className="mb-4">
          <TabsTrigger value="bids">كشف المزايدات ({bids.length})</TabsTrigger>
          <TabsTrigger value="participants">المشاركون ({participants.length})</TabsTrigger>
          <TabsTrigger value="deposits">العرابين ({deposits.length})</TabsTrigger>
          <TabsTrigger value="trade">العروض والصفقات ({offers.length + orders.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="bids">
          <LocalZoneNote className="mb-2 block" />
          <AdminTable
            empty="لا مزايدات على هذا الإعلان."
            minWidth="44rem"
            columns={[
              { label: '#', numeric: true, width: '4rem', minWidth: '3.5rem' },
              { label: 'المزايد', width: '30%', minWidth: '10rem' },
              { label: 'المبلغ', numeric: true, width: '20%', minWidth: '8rem' },
              { label: 'الوقت', width: '26%', minWidth: '11rem' },
              { label: 'الحالة', width: '20%', minWidth: '8rem' },
            ]}
          >
            {bids.map((bid) => (
              <Tr key={bid.id} data-row={bid.id}>
                <Td numeric className="text-xs text-muted">
                  {bid.sequence}
                </Td>
                <Td>
                  <Link
                    href={`/admin/users/${bid.bidderReference}`}
                    className="font-bold hover:underline"
                  >
                    {bid.bidderName}
                  </Link>
                  <span dir="ltr" className="block text-[11px] text-muted">
                    {bid.bidderReference}
                  </span>
                </Td>
                <Td>
                  <Money value={bid.amount} className="text-sm" />
                </Td>
                <Td className="whitespace-nowrap text-xs text-muted">
                  <LocalTime iso={bid.createdAt} />
                </Td>
                <Td>
                  {bid.status === 'accepted' ? (
                    <Badge variant="success">مقبولة</Badge>
                  ) : (
                    <>
                      <Badge variant="danger">ملغاة</Badge>
                      {bid.cancellationReason && (
                        <span className="mt-1 block text-[11px] text-muted">
                          {bid.cancellationReason}
                        </span>
                      )}
                    </>
                  )}
                </Td>
              </Tr>
            ))}
          </AdminTable>
        </TabsContent>

        <TabsContent value="participants">
          <AdminTable
            empty="لا مشاركين بعد."
            minWidth="44rem"
            columns={[
              { label: 'المزايد', width: '24%', minWidth: '10rem' },
              { label: 'التواصل', width: '22%', minWidth: '9.5rem' },
              { label: 'مزايداته', numeric: true, width: '10%', minWidth: '5.5rem' },
              { label: 'أعلى مزايدة له', numeric: true, width: '18%', minWidth: '9rem' },
              { label: 'موقفه', width: '13%', minWidth: '7rem' },
              { label: 'عربونه', width: '13%', minWidth: '8rem' },
            ]}
          >
            {participants.map((person) => (
              <Tr key={person.userId} data-row={person.userId}>
                <Td>
                  <Link
                    href={`/admin/users/${person.userReference}`}
                    className="font-bold hover:underline"
                  >
                    {person.name}
                  </Link>
                  <span dir="ltr" className="block text-[11px] text-muted">
                    {person.userReference}
                  </span>
                </Td>
                <Td className="text-xs">
                  {person.phone ? (
                    <a
                      href={`tel:${person.phone.replace(/\s/g, '')}`}
                      dir="ltr"
                      className="block tabular-nums hover:underline"
                    >
                      {person.phone}
                    </a>
                  ) : (
                    <span className="text-muted">لا جوال</span>
                  )}
                  <SocialLinks social={person.social} />
                </Td>
                <Td numeric className="text-xs">
                  {person.bidCount}
                </Td>
                <Td>
                  <Money value={person.highest} className="text-sm" />
                </Td>
                <Td>
                  {person.isHighest ? (
                    <Badge variant="success">الأعلى</Badge>
                  ) : (
                    <Badge variant="muted">تجاوزه غيره</Badge>
                  )}
                </Td>
                <Td className="text-xs">
                  {person.depositStatus ? (
                    <>
                      <Badge variant={person.depositStatus === 'held' ? 'gold' : 'muted'}>
                        {DEPOSIT_STATUS_LABELS[person.depositStatus]}
                      </Badge>
                      <span className="mt-1 block text-[11px] text-muted">
                        {formatAmount(person.depositAmount)} ريال
                      </span>
                    </>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </Td>
              </Tr>
            ))}
          </AdminTable>
        </TabsContent>

        <TabsContent value="deposits">
          <AdminTable
            empty="لا عرابين على هذا الإعلان."
            minWidth="42rem"
            columns={[
              { label: 'رقم العربون', width: '20%', minWidth: '8rem' },
              { label: 'المزايد', width: '28%', minWidth: '9rem' },
              { label: 'المبلغ', numeric: true, width: '18%', minWidth: '8rem' },
              { label: 'الحالة', width: '17%', minWidth: '7rem' },
              { label: 'السبب', width: '17%', minWidth: '8rem' },
            ]}
          >
            {deposits.map((deposit) => (
              <Tr key={deposit.id} data-row={deposit.id}>
                <Td dir="ltr" className="font-bold text-gold-500">
                  {deposit.reference}
                </Td>
                <Td className="text-xs">{deposit.userName}</Td>
                <Td>
                  <Money value={deposit.amount} className="text-sm" />
                </Td>
                <Td>
                  <Badge variant={deposit.status === 'held' ? 'gold' : 'muted'}>
                    {DEPOSIT_STATUS_LABELS[deposit.status]}
                  </Badge>
                </Td>
                <Td className="text-xs text-muted">{deposit.reason ?? '—'}</Td>
              </Tr>
            ))}
          </AdminTable>
        </TabsContent>

        <TabsContent value="trade">
          <div className="space-y-5">
            <section>
              <h2 className="mb-2 text-sm font-bold">الصفقات</h2>
              <AdminTable
                empty="لا صفقات."
                minWidth="40rem"
                columns={[
                  { label: 'رقم الصفقة', width: '20%', minWidth: '8rem' },
                  { label: 'المشتري', width: '28%', minWidth: '9rem' },
                  { label: 'المبلغ', numeric: true, width: '20%', minWidth: '8rem' },
                  { label: 'الحالة', width: '32%', minWidth: '9rem' },
                ]}
              >
                {orders.map((order) => (
                  <Tr key={order.id} data-row={order.id}>
                    <Td dir="ltr" className="font-bold text-gold-500">
                      {order.reference}
                    </Td>
                    <Td className="text-xs">{order.buyerName}</Td>
                    <Td>
                      <Money value={order.amount} className="text-sm" />
                    </Td>
                    <Td>
                      <Badge
                        variant={
                          order.status === 'completed'
                            ? 'success'
                            : order.overdue || order.status === 'defaulted'
                              ? 'danger'
                              : 'muted'
                        }
                      >
                        {order.overdue && order.status === 'awaiting_settlement'
                          ? 'تجاوزت المهلة'
                          : ORDER_STATUS_LABELS[order.status]}
                      </Badge>
                    </Td>
                  </Tr>
                ))}
              </AdminTable>
            </section>

            <section>
              <h2 className="mb-2 text-sm font-bold">العروض</h2>
              <AdminTable
                empty="لا عروض."
                minWidth="40rem"
                columns={[
                  { label: 'مقدّم العرض', width: '34%', minWidth: '10rem' },
                  { label: 'المبلغ', numeric: true, width: '24%', minWidth: '8rem' },
                  { label: 'الحالة', width: '20%', minWidth: '7rem' },
                  { label: 'الوقت', width: '22%', minWidth: '10rem' },
                ]}
              >
                {offers.map((offer) => (
                  <Tr key={offer.id} data-row={offer.id}>
                    <Td className="text-xs">{offer.bidderName}</Td>
                    <Td>
                      <Money value={offer.amount} className="text-sm" />
                    </Td>
                    <Td>
                      <Badge variant={offer.status === 'accepted' ? 'success' : 'muted'}>
                        {OFFER_STATUS_LABELS[offer.status]}
                      </Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-muted">
                      <LocalTime iso={offer.createdAt} mode="datetime" />
                    </Td>
                  </Tr>
                ))}
              </AdminTable>
            </section>
          </div>
        </TabsContent>
      </Tabs>
    </>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 text-end">{children}</dd>
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  plain,
}: {
  icon: React.ElementType
  label: string
  value: string
  hint?: string
  tone?: 'success' | 'danger'
  plain?: boolean
}) {
  return (
    <div className="rounded-2xl border border-ink-600 bg-ink-800 p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
        <Icon className="size-3.5" />
        {label}
      </p>
      <p
        className={
          tone === 'success'
            ? 'mt-1 text-xl font-extrabold tabular-nums text-success'
            : tone === 'danger'
              ? 'mt-1 text-xl font-extrabold tabular-nums text-danger'
              : 'mt-1 text-xl font-extrabold tabular-nums'
        }
      >
        {value}
        {!plain && value !== 'بلا احتياطي' && (
          <span className="ms-1 text-[11px] font-semibold opacity-70">ريال</span>
        )}
      </p>
      {hint && <p className="text-[11px] text-muted">{hint}</p>}
    </div>
  )
}
