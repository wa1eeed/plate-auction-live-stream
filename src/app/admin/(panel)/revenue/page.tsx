import Link from 'next/link'
import { Banknote, Landmark, Percent, ShieldX, Wallet } from 'lucide-react'
import { TableSearch } from '@/components/admin/table-search'
import {
  AdminHeader,
  AdminTable,
  MetricCard,
  Money,
  Td,
  Th,
  Tr,
} from '@/components/admin/admin-ui'
import { SettleEntryButton } from '@/components/admin/settle-entry-button'
import { Badge } from '@/components/ui/badge'
import { LocalTime } from '@/components/market/local-time'
import { PLATFORM_ENTRY_LABELS } from '@/lib/domain/types'
import { formatAmount } from '@/lib/domain/money'
import { getRevenue } from '@/lib/server/admin-service'
import { requireAdminId } from '@/lib/server/require-admin'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'إيرادات المنصّة' }

export default async function AdminRevenuePage() {
  await requireAdminId()
  const { rows, totals } = await getRevenue()

  return (
    <>
      <AdminHeader
        title="إيرادات المنصّة"
        description="كل ريال دخل المنصّة أو استحقّ لها، بمصدره وحالته. والضريبة تُعرَض على حدة: تحملها المنصّة أمانةً وتورّدها، فليست من إيرادها."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/*
          * الإيراد أوّلًا، والضريبة بجانبه لا داخله.
          *
          * ما يُحصَّل من الضريبة مالُ الهيئة تحمله المنصّة أمانةً حتى تورّده —
          * التزامٌ لا كسب. وجمعُه في «المُحصَّل» يُظهر صفحةً اسمها «إيرادات
          * المنصّة» أنّها كسبت أكثر ممّا كسبت، ويُبنى عليه تسعيرٌ وقرار.
          */}
        <MetricCard
          label="إيراد المنصّة المُحصَّل"
          value={formatAmount(totals.netSettled)}
          tone="success"
          icon={Wallet}
          hint={
            totals.vatSettled > 0
              ? `ريال — عمولات وعرابين، بلا الضريبة (${formatAmount(totals.vatSettled)})`
              : 'ريال — اقتُطع من المحافظ'
          }
        />
        <MetricCard
          label="ضريبة تُورَّد للهيئة"
          value={formatAmount(totals.vatSettled)}
          tone={totals.vatSettled > 0 ? 'gold' : 'default'}
          icon={Landmark}
          hint={
            totals.vatDue > 0
              ? `ريال — محصَّلة أمانةً · و${formatAmount(totals.vatDue)} استحقّت ولم تُحصَّل`
              : 'ريال — محصَّلة أمانةً لا إيرادًا'
          }
        />
        <MetricCard
          label="مستحقّ ولم يُحصَّل"
          value={formatAmount(totals.due)}
          tone={totals.due > 0 ? 'gold' : 'default'}
          attention={totals.due > 0}
          icon={Banknote}
          hint="ريال — بانتظار رصيد كافٍ"
        />
        <MetricCard
          label="عمولات"
          value={formatAmount(totals.commission)}
          icon={Percent}
          hint={`ضريبة ${formatAmount(totals.vat)} ريال`}
        />
        <MetricCard
          label="عرابين مُصادَرة"
          value={formatAmount(totals.forfeits)}
          tone={totals.forfeits > 0 ? 'danger' : 'default'}
          icon={ShieldX}
          hint={totals.reversed > 0 ? `${formatAmount(totals.reversed)} ريال مُبطَل` : 'ريال'}
        />
      </div>

      <TableSearch
        placeholder="ابحث بالمستخدم أو اللوحة أو رقم القيد (R26-00001)"
        rows={rows.map((row) => ({
          key: row.id,
          reference: row.reference,
          haystack: [row.userName, row.plateLabel, PLATFORM_ENTRY_LABELS[row.type], row.note].join(
            ' ',
          ),
        }))}
      >
        <AdminTable
          empty="لا إيرادات بعد — العمولة معطّلة أو لم تكتمل صفقة."
          head={
            <>
              <Th align="end">رقم القيد</Th>
              <Th>النوع</Th>
              <Th>المستخدم</Th>
              <Th>اللوحة</Th>
              <Th align="end">المبلغ</Th>
              <Th>الحالة</Th>
              <Th>التاريخ</Th>
              <Th />
            </>
          }
        >
          {rows.map((row) => (
            <Tr key={row.id} data-row={row.id} className={row.reversed ? 'opacity-55' : undefined}>
              <Td numeric dir="ltr" className="font-bold text-gold-500">
                {row.reference}
              </Td>
              <Td>{PLATFORM_ENTRY_LABELS[row.type]}</Td>
              <Td className="text-xs text-muted">{row.userName}</Td>
              <Td className="font-bold">{row.plateLabel}</Td>
              <Td align="end">
                <Money value={row.amount} className="text-sm" />
              </Td>
              <Td>
                {row.reversed ? (
                  <Badge variant="muted">مُبطَل</Badge>
                ) : row.settled ? (
                  <Badge variant="success">محصَّل</Badge>
                ) : (
                  <Badge variant="gold">مستحقّ</Badge>
                )}
              </Td>
              <Td className="whitespace-nowrap text-xs text-muted">
                <LocalTime iso={row.createdAt} mode="datetime" />
              </Td>
              <Td align="end">
                {!row.settled && !row.reversed && <SettleEntryButton entryId={row.id} />}
              </Td>
            </Tr>
          ))}
        </AdminTable>
      </TableSearch>

      <p className="mt-3 text-xs text-muted">
        العمولة تُقتطع من المحفظة لحظة اكتمال الصفقة. ومن لا يكفي رصيده تُقيَّد عمولته مستحقّة ولا
        تتعطّل صفقته — فالإيراد لا يضيع والصفقة لا تُعلَّق.{' '}
        <Link href="/admin/settings" className="text-gold-500 hover:underline">
          اضبط النسب في الإعدادات
        </Link>
        .
      </p>
    </>
  )
}
