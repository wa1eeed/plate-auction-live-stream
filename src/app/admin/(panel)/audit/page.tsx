import Link from 'next/link'
import { AdminHeader, AdminTable, Td, Tr } from '@/components/admin/admin-ui'
import { TableSearch } from '@/components/admin/table-search'
import { Badge } from '@/components/ui/badge'
import { AUDIT_ACTION_LABELS, listAdminAudits } from '@/lib/server/admin-service'
import { formatAmount } from '@/lib/domain/money'
import { DEPOSIT_STATUS_LABELS, ORDER_STATUS_LABELS } from '@/lib/domain/types'
import { requireAdminId } from '@/lib/server/require-admin'
import { formatTimestamp } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'سجلّ التدقيق' }

/** الأفعال التي تمسّ مال المستخدمين — تُبرز في السجلّ. */
const SENSITIVE = new Set([
  'wallet.topup',
  'wallet.withdrawal',
  'deposit.forfeit',
  'payment.paid',
  'payment.failed',
])

export default async function AdminAuditPage() {
  await requireAdminId()
  const rows = await listAdminAudits(200)

  return (
    <>
      <AdminHeader
        title="سجلّ التدقيق"
        description="كل فعل إداري باسم منفّذه وحالته قبل وبعد. القيود لا تُعدَّل ولا تُحذف."
      />

      <TableSearch
        placeholder="ابحث بالفعل أو المنفّذ أو المعرّف"
        rows={rows.map((row) => ({
          key: row.id,
          haystack: [
            AUDIT_ACTION_LABELS[row.action] ?? row.action,
            row.action,
            row.actorName,
            row.entityId,
            row.entityType,
          ].join(' '),
        }))}
      >
        <AdminTable
          empty="لا توجد أفعال إدارية بعد."
          minWidth="54rem"
          columns={[
            { label: 'التاريخ', width: '16%', minWidth: '10rem' },
            { label: 'الفعل', width: '16%', minWidth: '8rem' },
            { label: 'المنفّذ', width: '14%', minWidth: '7rem' },
            { label: 'الهدف', width: '16%', minWidth: '8rem' },
            { label: 'قبل', width: '19%', minWidth: '9rem' },
            { label: 'بعد', width: '19%', minWidth: '9rem' },
          ]}
        >
          {rows.map((row) => (
            <Tr key={row.id} data-row={row.id}>
              <Td className="whitespace-nowrap text-xs text-muted">
                {formatTimestamp(row.createdAt)}
              </Td>
              <Td>
                <Badge variant={SENSITIVE.has(row.action) ? 'gold' : 'muted'}>
                  {AUDIT_ACTION_LABELS[row.action] ?? row.action}
                </Badge>
              </Td>
              <Td className="text-xs">{row.actorName}</Td>
              <Td className="text-xs">
                {row.entityType === 'wallet' || row.entityType === 'user' ? (
                  <Link href={`/admin/users/${row.entityId}`} className="hover:underline">
                    {row.entityType}
                  </Link>
                ) : (
                  row.entityType
                )}
                <span className="block font-mono text-[10px] text-muted" dir="ltr">
                  {row.entityId}
                </span>
              </Td>
              <Td>
                <Snapshot data={row.beforeData} />
              </Td>
              <Td>
                <Snapshot data={row.afterData} />
              </Td>
            </Tr>
          ))}
        </AdminTable>
      </TableSearch>
    </>
  )
}

/** أسماء الحقول بالعربية — سجلّ التدقيق يُقرأ لا يُفكّ. */
const FIELD_LABELS: Record<string, string> = {
  status: 'الحالة',
  amount: 'المبلغ',
  forfeited: 'المُصادَر',
  returned: 'المُعاد',
  restored: 'المُستعاد',
  balanceAfter: 'الرصيد بعده',
  heldAfter: 'المحجوز بعده',
  reason: 'السبب',
  note: 'ملاحظة',
  method: 'الوسيلة',
}

/** حقول تحمل هللات — تُعرض ريالات وإلا قُرئ 250000 على أنه ربع مليون. */
const MONEY_FIELDS = new Set(['amount', 'forfeited', 'returned', 'restored', 'balanceAfter', 'heldAfter'])

function Snapshot({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return <span className="text-muted">—</span>
  return (
    <span className="block max-w-[240px] space-y-0.5 text-[11px]">
      {Object.entries(data).map(([key, value]) => {
        /*
         * القيم تُترجم قبل أن تُعرض.
         *
         * كان السجلّ يطبع `String(value)` خامًّا: `status: held` بالإنجليزية،
         * و`amount: 250000` لصفقة قدرها 2,500 ريال — فيقرأ المدقّق رقمًا
         * مئة ضعف حقيقته في الشاشة التي يُفترض أنها مرجع الحقيقة.
         */
        const label = FIELD_LABELS[key] ?? key
        const shown =
          MONEY_FIELDS.has(key) && typeof value === 'number'
            ? `${formatAmount(value)} ريال`
            : typeof value === 'string'
              ? (DEPOSIT_STATUS_LABELS[value as keyof typeof DEPOSIT_STATUS_LABELS] ??
                ORDER_STATUS_LABELS[value as keyof typeof ORDER_STATUS_LABELS] ??
                value)
              : String(value)
        return (
          <span key={key} className="block text-muted" title={`${key}: ${String(value)}`}>
            {label}: <b className="text-paper">{shown}</b>
          </span>
        )
      })}
    </span>
  )
}
