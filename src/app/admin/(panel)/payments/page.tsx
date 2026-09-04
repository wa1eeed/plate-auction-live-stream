import Link from 'next/link'
import { TableSearch } from '@/components/admin/table-search'
import { AdminHeader, AdminTable, Money, Td, Tr } from '@/components/admin/admin-ui'
import { PaymentActions } from '@/components/admin/payment-actions'
import { Badge } from '@/components/ui/badge'
import { formatAmount } from '@/lib/domain/money'
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from '@/lib/domain/types'
import { listAdminPayments } from '@/lib/server/payment-service'
import { requireAdminId } from '@/lib/server/require-admin'
import { formatTimestamp } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'المدفوعات' }

export default async function AdminPaymentsPage() {
  await requireAdminId()
  const rows = await listAdminPayments()

  const review = rows.filter((row) => row.status === 'under_review')
  const awaiting = rows.filter((row) => row.status === 'awaiting_transfer')
  const paid = rows.filter((row) => row.status === 'paid')

  return (
    <>
      <AdminHeader
        title="المدفوعات"
        description="شحن أرصدة المحافظ — بطاقة عبر Tap أو حوالة بنكية تحتاج تحقّقك."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Stat
          label="بانتظار تحقّقك"
          count={review.length}
          amount={review.reduce((sum, row) => sum + row.amount, 0)}
          urgent
        />
        <Stat
          label="بانتظار تحويل المستخدم"
          count={awaiting.length}
          amount={awaiting.reduce((sum, row) => sum + row.amount, 0)}
        />
        <Stat
          label="مدفوعة"
          count={paid.length}
          amount={paid.reduce((sum, row) => sum + row.amount, 0)}
        />
      </div>

      <TableSearch
        placeholder="ابحث بالمرجع أو المستخدم أو رقم الحوالة"
        rows={rows.map((row) => ({
          key: row.id,
          reference: row.reference,
          haystack: [row.reference, row.userName, row.userEmail, row.transferNote ?? '', row.tapChargeId ?? ''].join(' '),
        }))}
      >
      <AdminTable
        empty="لا توجد عمليات دفع بعد."
        minWidth="64rem"
        columns={[
          { label: 'المستخدم', width: '13%', minWidth: '7rem' },
          { label: 'الغرض', width: '15%', minWidth: '8.5rem' },
          { label: 'المبلغ', numeric: true, width: '13%', minWidth: '7.5rem' },
          { label: 'الطريقة', width: '12%', minWidth: '6.5rem' },
          { label: 'المرجع', width: '15%', minWidth: '8rem' },
          { label: 'إثبات التحويل', width: '14%', minWidth: '7.5rem' },
          { label: 'الحالة', width: '12%', minWidth: '6.5rem' },
          { label: 'التاريخ', width: '16%', minWidth: '9.5rem' },
          { label: '', align: 'end', width: '9rem' },
        ]}
      >
        {rows.map((row) => (
          <Tr key={row.id} data-row={row.id} className={row.status === 'under_review' ? 'bg-gold-500/[0.06]' : undefined}>
            <Td>
              <Link href={`/admin/users/${row.userReference}`} className="text-xs hover:underline">
                {row.userName}
              </Link>
              <span className="block text-[11px] text-muted" dir="ltr">
                {row.userEmail}
              </span>
            </Td>
            <Td className="text-xs">
              {/* الغرض يقرّر ما يفعله التأكيد: شحن محفظة أم إتمام صفقة */}
              {row.orderId ? (
                <>
                  <Link href="/admin/orders" className="font-bold hover:underline">
                    سداد صفقة
                  </Link>
                  <span className="block text-[11px] text-muted">
                    <span dir="ltr">{row.orderReference}</span>
                    {row.plateLabel ? ` · ${row.plateLabel}` : ''}
                  </span>
                </>
              ) : (
                <span className="text-muted">شحن محفظة</span>
              )}
            </Td>
            <Td numeric>
              <Money value={row.amount} className="text-sm" />
            </Td>
            <Td className="text-xs">
              {PAYMENT_METHOD_LABELS[row.method]}
              {row.tapMode && (
                <Badge variant={row.tapMode === 'live' ? 'success' : 'muted'} className="ms-1">
                  {row.tapMode === 'live' ? 'حقيقي' : 'تجريبي'}
                </Badge>
              )}
            </Td>
            <Td className="text-xs font-bold tabular-nums">{row.reference}</Td>
            <Td className="max-w-[180px] truncate text-xs text-muted">
              {row.transferNote ?? row.tapChargeId ?? '—'}
            </Td>
            <Td>
              <Badge
                variant={
                  row.status === 'paid'
                    ? 'success'
                    : row.status === 'under_review'
                      ? 'gold'
                      : row.status === 'failed'
                        ? 'danger'
                        : 'muted'
                }
              >
                {PAYMENT_STATUS_LABELS[row.status]}
              </Badge>
              {row.failureReason && (
                <span className="block text-[11px] text-danger">{row.failureReason}</span>
              )}
            </Td>
            <Td className="whitespace-nowrap text-xs text-muted">
              {formatTimestamp(row.createdAt)}
            </Td>
            <Td align="end">
              {(row.status === 'under_review' || row.status === 'awaiting_transfer') && (
                <PaymentActions
                  paymentId={row.id}
                  amount={formatAmount(row.amount)}
                  userName={row.userName}
                  reference={row.reference}
                  forOrder={row.orderId !== null}
                />
              )}
            </Td>
          </Tr>
        ))}
      </AdminTable>
      </TableSearch>

      <p className="mt-3 text-xs text-muted">
        عمليات Tap تُسوّى تلقائيًا عبر الويبهوك ولا تحتاج تدخّلك. التأكيد اليدوي للحوالات
        البنكية وحدها بعد مطابقة المرجع في كشف حساب المنصّة.
      </p>
    </>
  )
}

function Stat({
  label,
  count,
  amount,
  urgent,
}: {
  label: string
  count: number
  amount: number
  urgent?: boolean
}) {
  return (
    <div
      className={
        urgent && count > 0
          ? 'rounded-2xl border border-gold-600/50 bg-gold-500/[0.08] p-4'
          : 'rounded-2xl border border-ink-600 bg-ink-800 p-4'
      }
    >
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums">{count}</p>
      <p className="text-[11px] text-muted">{formatAmount(amount)} ريال</p>
    </div>
  )
}
