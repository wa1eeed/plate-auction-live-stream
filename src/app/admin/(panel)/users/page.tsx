import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { TableSearch } from '@/components/admin/table-search'
import { AdminHeader, AdminTable, Money, Td, Tr } from '@/components/admin/admin-ui'
import { Badge } from '@/components/ui/badge'
import { listUserRows } from '@/lib/server/admin-service'
import { requireAdminId } from '@/lib/server/require-admin'
import { formatTimestamp } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'المستخدمون' }

export default async function AdminUsersPage() {
  await requireAdminId()
  const rows = await listUserRows()

  return (
    <>
      <AdminHeader
        title="المستخدمون"
        description={`${rows.length} مستخدمًا — أرصدتهم في المحفظة ونشاطهم في السوق.`}
      />

      <TableSearch
        placeholder="ابحث بالاسم أو البريد أو المدينة أو رقم العضوية (U26-00001)"
        rows={rows.map((row) => ({
          key: row.id,
          reference: row.reference,
          haystack: [row.displayName, row.email, row.city ?? '', row.id].join(' '),
        }))}
      >
      <AdminTable
        empty="لا يوجد مستخدمون بعد."
        minWidth="60rem"
        columns={[
          { label: 'رقم العضوية', numeric: true, width: '7rem', minWidth: '6rem' },
          { label: 'المستخدم', width: '24%', minWidth: '13rem' },
          { label: 'الرصيد', numeric: true, width: '11%', minWidth: '7rem' },
          { label: 'المحجوز', numeric: true, width: '11%', minWidth: '7rem' },
          { label: 'المتاح', numeric: true, width: '11%', minWidth: '7rem' },
          { label: 'لوحات', numeric: true, width: '10%', minWidth: '6.5rem' },
          { label: 'مزايدات', numeric: true, width: '8%', minWidth: '5rem' },
          { label: 'مشتريات', numeric: true, width: '11%', minWidth: '7rem' },
          { label: 'مبيعات', numeric: true, width: '8%', minWidth: '5rem' },
          { label: '', align: 'end', width: '6rem' },
        ]}
      >
        {rows.map((row) => (
          <Tr key={row.id} data-row={row.id}>
            <Td numeric className="font-bold text-gold-500" dir="ltr">
              {row.reference}
            </Td>
            <Td>
              <Link href={`/admin/users/${row.reference}`} className="block min-w-0 hover:underline">
                <span className="block truncate font-bold">{row.displayName}</span>
                <span className="block truncate text-[11px] text-muted" dir="ltr">
                  {row.email}
                </span>
                <span className="block truncate text-[11px] text-muted">
                  {row.city ? `${row.city} · ` : ''}انضمّ {formatTimestamp(row.createdAt)}
                </span>
              </Link>
            </Td>
            <Td numeric>
              <Money value={row.balance} className="text-sm" />
            </Td>
            <Td numeric>
              {row.held > 0 ? (
                <Money value={row.held} className="text-sm text-gold-500" />
              ) : (
                <span className="text-muted">—</span>
              )}
            </Td>
            <Td numeric>
              <Money value={row.available} className="text-sm" />
            </Td>
            <Td numeric>
              <span className="font-semibold">{row.listingCount}</span>
              {row.activeListingCount > 0 && (
                <span className="block text-[11px] text-success">
                  {row.activeListingCount} معروضة
                </span>
              )}
            </Td>
            <Td numeric>{row.bidCount}</Td>
            <Td numeric>
              <span className="font-semibold">{row.purchaseCount}</span>
              {row.overdueCount > 0 && (
                <span className="mt-0.5 block">
                  <Badge variant="danger">{row.overdueCount} متأخّرة</Badge>
                </span>
              )}
            </Td>
            <Td numeric>{row.saleCount}</Td>
            <Td align="end">
              <Link
                href={`/admin/users/${row.reference}`}
                className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-gold-500 hover:underline"
              >
                التفاصيل
                <ArrowLeft className="size-3" />
              </Link>
            </Td>
          </Tr>
        ))}
      </AdminTable>
      </TableSearch>
    </>
  )
}
