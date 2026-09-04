import Link from 'next/link'
import { TableSearch } from '@/components/admin/table-search'
import { AdminHeader, AdminTable, Money, Td, Tr } from '@/components/admin/admin-ui'
import { Badge } from '@/components/ui/badge'
import { formatAmount } from '@/lib/domain/money'
import { LEDGER_ENTRY_LABELS } from '@/lib/domain/types'
import { listAdminLedger } from '@/lib/server/admin-service'
import { requireAdminId } from '@/lib/server/require-admin'
import { formatTimestamp } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'الحركات المالية' }

export default async function AdminTransactionsPage() {
  await requireAdminId()
  const rows = await listAdminLedger(200)

  return (
    <>
      <AdminHeader
        title="الحركات المالية"
        description="آخر 200 قيد على محافظ المستخدمين. القيود لا تُعدَّل ولا تُحذف."
      />

      <TableSearch
        placeholder="ابحث بالمستخدم أو البيان أو رقم الحركة (W26-00001)"
        rows={rows.map((row) => ({
          key: row.id,
          reference: row.reference,
          haystack: [row.userName, row.note ?? '', row.type].join(' '),
        }))}
      >
      <AdminTable
        empty="لا توجد حركات بعد."
        minWidth="54rem"
        columns={[
          { label: 'رقم الحركة', numeric: true, width: '7.5rem', minWidth: '7rem' },
          { label: 'التاريخ', width: '15%', minWidth: '9.5rem' },
          { label: 'المستخدم', width: '15%', minWidth: '7rem' },
          { label: 'البيان', width: '18%', minWidth: '8rem' },
          { label: 'المبلغ', numeric: true, width: '15%', minWidth: '8rem' },
          { label: 'الرصيد بعده', numeric: true, width: '15%', minWidth: '8rem' },
          { label: 'الملاحظة', width: '20%', minWidth: '9rem' },
        ]}
      >
        {rows.map((row) => (
          <Tr key={row.id} data-row={row.id}>
            <Td numeric dir="ltr" className="font-bold text-gold-500">
              {row.reference}
            </Td>
            <Td className="whitespace-nowrap text-xs text-muted">
              {formatTimestamp(row.createdAt)}
            </Td>
            <Td>
              <Link href={`/admin/users/${row.userReference}`} className="text-xs hover:underline">
                {row.userName}
              </Link>
            </Td>
            <Td>
              <span className="text-xs font-semibold">{LEDGER_ENTRY_LABELS[row.type]}</span>
              {row.direction === 'neutral' && (
                <Badge variant="gold" className="ms-1.5">
                  محجوز
                </Badge>
              )}
            </Td>
            <Td numeric>
              <Money
                value={row.amount}
                className={
                  row.direction === 'credit'
                    ? 'text-sm text-success'
                    : row.direction === 'debit'
                      ? 'text-sm text-danger'
                      : 'text-sm text-muted'
                }
              />
            </Td>
            <Td numeric>
              <Money value={row.balanceAfter} className="text-sm" />
              {row.heldAfter > 0 && (
                <span className="block text-[11px] text-gold-500">
                  محجوز {formatAmount(row.heldAfter)}
                </span>
              )}
            </Td>
            <Td className="text-xs text-muted">{row.note ?? '—'}</Td>
          </Tr>
        ))}
      </AdminTable>
      </TableSearch>
    </>
  )
}
