import Link from 'next/link'
import { TableSearch } from '@/components/admin/table-search'
import { AdminHeader, AdminTable, Money, Td, Tr } from '@/components/admin/admin-ui'
import { ListingAdminActions } from '@/components/admin/listing-admin-actions'
import { SaudiLicensePlate } from '@/components/plate/SaudiLicensePlate'
import { Badge } from '@/components/ui/badge'
import { formatAmount } from '@/lib/domain/money'
import { LISTING_STATUS_LABELS, SALE_TYPE_LABELS, isClosedListing } from '@/lib/domain/types'
import { listAdminListings } from '@/lib/server/admin-service'
import { requireAdminId } from '@/lib/server/require-admin'
import { formatTimestamp } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'الإعلانات' }

/** نغمة كل حالة — الموقوف خطر، والمباع نجاح، وما عداهما محايد. */
const LISTING_STATUS_TONE: Record<string, 'success' | 'muted' | 'danger' | 'gold' | 'default'> = {
  active: 'success',
  sold: 'success',
  suspended: 'danger',
  cancelled: 'muted',
  expired: 'muted',
  reserve_not_met: 'gold',
  no_bids: 'muted',
  draft: 'muted',
}

export default async function AdminListingsPage() {
  await requireAdminId()
  const rows = await listAdminListings()

  return (
    <>
      <AdminHeader
        title="الإعلانات"
        description={`${rows.length} إعلانًا — كل اللوحات المعروضة والمسودّات والمغلقة.`}
      />

      <TableSearch
        placeholder="ابحث باللوحة أو البائع أو رقم الإعلان (L26-00001)"
        rows={rows.map((row) => ({
          key: row.id,
          reference: row.reference,
          haystack: [
            row.plate.arabicLetters,
            row.plate.latinLetters,
            row.plate.plateNumbers,
            row.sellerName,
            row.id,
          ].join(' '),
        }))}
      >
      <AdminTable
        empty="لا توجد إعلانات."
        minWidth="62rem"
        columns={[
          { label: 'رقم الإعلان', numeric: true, width: '7rem', minWidth: '6rem' },
          { label: 'اللوحة', width: '10rem', minWidth: '10rem' },
          { label: 'البائع', width: '13%', minWidth: '7rem' },
          { label: 'الطريقة', width: '11%', minWidth: '6rem' },
          { label: 'الحالة', width: '12%', minWidth: '6.5rem' },
          { label: 'السعر', numeric: true, width: '15%', minWidth: '8rem' },
          { label: 'مزايدات', numeric: true, width: '10%', minWidth: '5.5rem' },
          { label: 'العربون', numeric: true, width: '14%', minWidth: '7.5rem' },
          { label: '', align: 'end', width: '6.5rem' },
        ]}
      >
        {rows.map((row) => (
          <Tr key={row.id} data-row={row.id}>
            <Td numeric className="font-bold text-gold-500" dir="ltr">
              {row.reference}
            </Td>
            <Td>
              <Link href={`/admin/listings/${row.reference}`} className="block w-[130px]">
                <SaudiLicensePlate {...row.plate} size="thumbnail" className="w-full" />
              </Link>
            </Td>
            <Td>
              <Link href={`/admin/users/${row.sellerReference}`} className="text-xs hover:underline">
                {row.sellerName}
              </Link>
              <span className="block text-[11px] text-muted">{formatTimestamp(row.createdAt)}</span>
            </Td>
            <Td>{SALE_TYPE_LABELS[row.saleType]}</Td>
            <Td>
              {/*
                * إعلانٌ أوقفته الإدارة لا يبدو كإعلان بيع بنجاح.
                *
                * كانت `suspended` و`sold` و`cancelled` و`expired` تحت شارة
                * واحدة، فيمرّ الموقوف في المسح البصري بلا أن يُلتفت إليه.
                */}
              <Badge variant={LISTING_STATUS_TONE[row.status]}>
                {LISTING_STATUS_LABELS[row.status]}
              </Badge>
            </Td>
            <Td numeric>
              <Money
                value={row.highestAmount ?? (row.saleType === 'fixed' ? row.price : row.startingPrice)}
                className="text-sm"
              />
              {row.reservePrice > 0 && (
                <span className="block text-[11px] text-muted">
                  احتياطي {formatAmount(row.reservePrice)}
                </span>
              )}
            </Td>
            <Td numeric>{row.bidCount}</Td>
            <Td numeric>
              {row.depositAmount > 0 ? (
                <>
                  <Money value={row.depositAmount} className="text-sm text-gold-500" />
                  {row.heldDeposits > 0 && (
                    <span className="block text-[11px] text-muted">{row.heldDeposits} محجوز</span>
                  )}
                </>
              ) : (
                <span className="text-muted">—</span>
              )}
            </Td>
            <Td align="end">
              {(!isClosedListing(row.status) || row.status === 'suspended') && (
                <ListingAdminActions
                  listingId={row.id}
                  label={`${row.plate.arabicLetters} ${row.plate.plateNumbers}`}
                  suspended={row.status === 'suspended'}
                />
              )}
            </Td>
          </Tr>
        ))}
      </AdminTable>
      </TableSearch>
    </>
  )
}
