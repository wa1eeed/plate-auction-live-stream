import Link from 'next/link'
import { TableSearch } from '@/components/admin/table-search'
import { AdminHeader, AdminTable, Money, Td, Tr } from '@/components/admin/admin-ui'
import { Badge } from '@/components/ui/badge'
import { LocalTime } from '@/components/market/local-time'
import { SaudiLicensePlate } from '@/components/plate/SaudiLicensePlate'
import { LISTING_STATUS_LABELS, OFFER_STATUS_LABELS, type OfferStatus } from '@/lib/domain/types'
import { listAdminOffers } from '@/lib/server/admin-service'
import { requireAdminId } from '@/lib/server/require-admin'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'السوم' }

const TONE: Record<OfferStatus, 'gold' | 'success' | 'danger' | 'muted'> = {
  pending: 'gold',
  accepted: 'success',
  declined: 'danger',
  withdrawn: 'muted',
}

/**
 * كلّ السوم في المنصّة.
 *
 * كان يظهر في موضعٍ واحد: تبويبٌ داخل صفحة إعلانٍ بعينه — فمن يحقّق في شكوى
 * سومٍ عليه أن يعرف رقم الإعلان مسبقًا، وهو ما لا يعرفه من يبدأ من شكوى صاحبه.
 *
 * وهي للقراءة: القبول والرفض قرار البائع، ومنحُ الإدارة سلطةً عليهما بلا سببٍ
 * موثّق يفتح بابًا لا يُغلق. ومن أراد التصرّف فمن صفحة الإعلان نفسها.
 */
export default async function AdminOffersPage() {
  await requireAdminId()
  const rows = await listAdminOffers()
  const pending = rows.filter((row) => row.status === 'pending').length

  return (
    <>
      <AdminHeader
        title="السوم"
        description={`كل ما عُرض على لوحات المنصّة — ${pending} منها ما زال ينتظر ردّ بائعه.`}
      />

      <TableSearch
        placeholder="ابحث باللوحة أو الطرفين أو رقم الإعلان (L26-00001)"
        tabs={[
          { key: 'pending', label: 'ينتظر ردًّا', hint: 'سومٌ قائم لم يُقبل ولم يُرفض' },
          { key: 'closed', label: 'مُغلق', hint: 'قُبل أو رُفض أو سُحب' },
        ]}
        rows={rows.map((row) => ({
          key: row.id,
          reference: row.reference,
          tab: row.status === 'pending' ? 'pending' : 'closed',
          haystack: [row.plateLabel, row.buyerName, row.sellerName, row.reference].join(' '),
        }))}
      >
        <AdminTable
          empty="لا سوم على أي لوحة بعد."
          minWidth="58rem"
          columns={[
            { label: 'اللوحة', width: '10rem', minWidth: '10rem' },
            { label: 'المبلغ', numeric: true, width: '14%', minWidth: '7.5rem' },
            { label: 'من', width: '16%', minWidth: '8rem' },
            { label: 'على لوحة', width: '16%', minWidth: '8rem' },
            { label: 'الحالة', width: '14%', minWidth: '7rem' },
            { label: 'التاريخ', width: '18%', minWidth: '9rem' },
          ]}
        >
          {rows.map((row) => (
            <Tr key={row.id}>
              <Td>
                <Link href={`/admin/listings/${row.reference}`} className="block w-[120px]">
                  <span className="flex aspect-[16/7] items-center justify-center rounded-lg bg-ink-700/45 p-1.5">
                    <SaudiLicensePlate {...row.plate} size="fill" showReflection={false} />
                  </span>
                </Link>
              </Td>
              <Td numeric>
                <Money value={row.amount} className="text-sm" />
              </Td>
              <Td className="text-xs">{row.buyerName}</Td>
              <Td className="text-xs">
                {row.sellerName}
                <span className="mt-0.5 block text-[11px] text-muted">
                  {LISTING_STATUS_LABELS[row.listingStatus]}
                </span>
              </Td>
              <Td>
                <Badge variant={TONE[row.status]}>{OFFER_STATUS_LABELS[row.status]}</Badge>
              </Td>
              <Td className="text-xs text-muted">
                <LocalTime iso={row.createdAt} mode="datetime" />
                {row.message && (
                  <span className="mt-0.5 block text-[11px] text-paper">«{row.message}»</span>
                )}
              </Td>
            </Tr>
          ))}
        </AdminTable>
      </TableSearch>
    </>
  )
}
