import Link from 'next/link'
import { TableSearch } from '@/components/admin/table-search'
import { AdminHeader, AdminTable, Money, Td, Tr } from '@/components/admin/admin-ui'
import { DepositActions } from '@/components/admin/deposit-actions'
import { SaudiLicensePlate } from '@/components/plate/SaudiLicensePlate'
import { Badge } from '@/components/ui/badge'
import { DEPOSIT_STATUS_LABELS } from '@/lib/domain/types'
import { formatAmount } from '@/lib/domain/money'
import { listAdminDeposits } from '@/lib/server/admin-service'
import { requireAdminId } from '@/lib/server/require-admin'
import { formatTimestamp } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'العرابين' }

export default async function AdminDepositsPage() {
  await requireAdminId()
  const deposits = await listAdminDeposits()
  const held = deposits.filter((d) => d.status === 'held')

  return (
    <>
      <AdminHeader
        title="العرابين"
        description="حجوزات المزايدين — تُفكّ تلقائيًا عند الخسارة، وتُصادَر عند التخلّف عن السداد."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Stat label="محجوز الآن" value={held.length} amount={held.reduce((s, d) => s + d.amount, 0)} />
        <Stat
          label="مُصادَر"
          value={deposits.filter((d) => d.status === 'forfeited').length}
          amount={deposits
            .filter((d) => d.status === 'forfeited')
            .reduce((s, d) => s + d.amount, 0)}
        />
        <Stat
          label="مستحقّ للمصادرة"
          value={held.filter((d) => d.canForfeit).length}
          amount={held.filter((d) => d.canForfeit).reduce((s, d) => s + d.amount, 0)}
          danger
        />
      </div>

      <TableSearch
        placeholder="ابحث بالمزايد أو اللوحة أو رقم العربون (D26-00001)"
        rows={deposits.map((d) => ({
          key: d.id,
          reference: d.reference,
          haystack: [d.userName, d.plateLabel, d.reason ?? ''].join(' '),
        }))}
      >
      <AdminTable
        empty="لا توجد عرابين."
        minWidth="64rem"
        columns={[
          { label: 'رقم العربون', numeric: true, width: '7.5rem', minWidth: '7rem' },
          { label: 'المزايد', width: '13%', minWidth: '7rem' },
          { label: 'اللوحة', width: '9rem', minWidth: '8.5rem' },
          { label: 'المبلغ', numeric: true, width: '14%', minWidth: '7.5rem' },
          { label: 'الحالة', width: '13%', minWidth: '7rem' },
          { label: 'التاريخ', width: '17%', minWidth: '9.5rem' },
          { label: 'السبب', width: '18%', minWidth: '9rem' },
          { label: '', align: 'end', width: '10rem' },
        ]}
      >
        {deposits.map((deposit) => {
          const overdue = deposit.overdue
          return (
            <Tr key={deposit.id} data-row={deposit.id} className={overdue ? 'bg-danger/[0.05]' : undefined}>
              <Td numeric dir="ltr" className="font-bold text-gold-500">
                {deposit.reference}
              </Td>
              <Td>
                <Link href={`/admin/users/${deposit.userReference}`} className="text-xs hover:underline">
                  {deposit.userName}
                </Link>
              </Td>
              <Td>
                {/* اللوحة مرسومة لا مكتوبة: الأدمن يميّزها بلمحة كما يميّزها
                    صاحبها، والنصّ يبقى في تلميح العنصر وفي البحث */}
                <Link
                  href={`/admin/listings/${deposit.listingId}`}
                  title={deposit.plateLabel}
                  aria-label={`اللوحة ${deposit.plateLabel}`}
                  className="block w-[120px]"
                >
                  <SaudiLicensePlate {...deposit.plate} size="thumbnail" className="w-full" />
                </Link>
              </Td>
              <Td numeric>
                <Money value={deposit.amount} className="text-sm" />
              </Td>
              <Td>
                <Badge
                  variant={
                    deposit.status === 'held'
                      ? overdue
                        ? 'danger'
                        : 'gold'
                      : deposit.status === 'forfeited'
                        ? 'danger'
                        : 'muted'
                  }
                >
                  {overdue && deposit.status === 'held'
                    ? 'تجاوز المهلة'
                    : DEPOSIT_STATUS_LABELS[deposit.status]}
                </Badge>
              </Td>
              <Td className="whitespace-nowrap text-xs text-muted">
                {formatTimestamp(deposit.createdAt)}
              </Td>
              <Td className="text-xs text-muted">{deposit.reason ?? '—'}</Td>
              <Td align="end">
                <DepositActions
                  depositId={deposit.id}
                  userName={deposit.userName}
                  amount={formatAmount(deposit.amount)}
                  canForfeit={deposit.canForfeit}
                  canRefund={deposit.canRefund}
                  canUndo={deposit.canUndo}
                />
              </Td>
            </Tr>
          )
        })}
      </AdminTable>
      </TableSearch>

      <p className="mt-3 text-xs text-muted">
        المصادرة لا تُتاح إلا بعد انقضاء مهلة سداد الصفقة المرتبطة، والردّ لا يُتاح ومزايدة صاحبه
        قائمة في مزاد جارٍ — والخادم يحرس القاعدتين لا الواجهة وحدها. ونسبة ما يُصادَر تضبطها
        «قواعد المزاد» في الإعدادات.
      </p>
    </>
  )
}

function Stat({
  label,
  value,
  amount,
  danger,
}: {
  label: string
  value: number
  amount: number
  danger?: boolean
}) {
  return (
    <div
      className={
        danger && value > 0
          ? 'rounded-2xl border border-danger/40 bg-danger/[0.06] p-4'
          : 'rounded-2xl border border-ink-600 bg-ink-800 p-4'
      }
    >
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted">{formatAmount(amount)} ريال</p>
    </div>
  )
}
