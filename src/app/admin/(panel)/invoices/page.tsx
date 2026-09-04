import Link from 'next/link'
import { FileText, Percent, ShieldCheck, ShieldX } from 'lucide-react'
import { TableSearch } from '@/components/admin/table-search'
import {
  AdminHeader,
  AdminTable,
  MetricCard,
  Td,
  Th,
  Tr,
} from '@/components/admin/admin-ui'
import { Badge } from '@/components/ui/badge'
import { LocalTime } from '@/components/market/local-time'
import { TAX_INVOICE_KIND_LABELS } from '@/lib/domain/types'
import { formatAmount, formatInvoiceAmount } from '@/lib/domain/money'
import { getInvoices } from '@/lib/server/admin-service'
import { requireAdminId } from '@/lib/server/require-admin'
import { getStore } from '@/lib/store'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'الفواتير الضريبية' }

export default async function AdminInvoicesPage() {
  await requireAdminId()
  const [{ rows, totals, chain }, settings] = await Promise.all([
    getInvoices(),
    getStore().getTaxSettings(),
  ])

  return (
    <>
      <AdminHeader
        title="الفواتير الضريبية"
        description="فاتورة ضريبية مبسّطة عن كل عمولة تستحقّها المنصّة. التوريد الخاضع للضريبة هو الوساطة لا قيمة اللوحة، فتُفوتَر العمولة وحدها لكل طرف."
      />

      {!settings.enabled && (
        <div className="mb-5 rounded-2xl border border-gold-600/40 bg-gold-500/[0.06] p-4">
          <p className="text-sm font-bold text-gold-400">الفوترة الضريبية غير مفعّلة</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            لا تُصدَر فواتير حتى تُدخل بيانات المنشأة ورقمها الضريبي في{' '}
            <Link href="/admin/settings" className="font-semibold text-paper hover:underline">
              الإعدادات
            </Link>
            . والامتناع أسلم من إصدار فاتورة برقم ضريبي فارغ.
          </p>
        </div>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="فواتير صادرة"
          value={String(totals.count)}
          icon={FileText}
          hint="سلسلة متّصلة لا يُحذف منها"
        />
        <MetricCard
          label="الوعاء الخاضع"
          value={formatAmount(totals.net)}
          icon={Percent}
          hint="ريال — عمولات قبل الضريبة"
        />
        <MetricCard
          label="ضريبة مُحصَّلة"
          value={formatAmount(totals.vat)}
          tone="gold"
          icon={Percent}
          hint="ريال — تُورَّد للهيئة"
        />
        {/*
          * سلامة السلسلة مؤشّر لا حاشية.
          *
          * كل فاتورة تحمل تجزئة سابقتها، فحذفُ واحدة أو تعديلها يكسر ما
          * بعدها. وكسرٌ لا يُرى في الصفحة الأولى كسرٌ لا يُكتشف.
          */}
        <MetricCard
          label="سلامة السلسلة"
          value={chain.ok ? 'سليمة' : 'مكسورة'}
          tone={chain.ok ? 'success' : 'danger'}
          attention={!chain.ok}
          icon={chain.ok ? ShieldCheck : ShieldX}
          hint={chain.ok ? 'كل فاتورة مرتبطة بسابقتها' : `انكسرت عند ${chain.brokenAt}`}
        />
      </div>

      <TableSearch
        placeholder="ابحث بالعميل أو الصفقة أو رقم الفاتورة (T26-00001)"
        rows={rows.map((row) => ({
          key: row.id,
          reference: row.reference,
          haystack: [row.customerName, row.orderReference, row.description].join(' '),
        }))}
      >
        <AdminTable
          empty="لا فواتير بعد — فعّل الفوترة الضريبية ثم أتمم صفقة."
          head={
            <>
              <Th>رقم الفاتورة</Th>
              <Th>العميل</Th>
              <Th>البند</Th>
              <Th align="end">قبل الضريبة</Th>
              <Th align="end">الضريبة</Th>
              <Th align="end">الإجمالي</Th>
              <Th>الإصدار</Th>
            </>
          }
        >
          {rows.map((row) => (
            <Tr key={row.id} data-row={row.id}>
              <Td>
                <Link
                  href={`/admin/invoices/${row.reference}`}
                  dir="ltr"
                  className="font-bold tabular-nums text-gold-500 hover:underline"
                >
                  {row.reference}
                </Link>
              </Td>
              <Td>
                <Link
                  href={`/admin/users/${row.customerReference}`}
                  className="font-semibold hover:underline"
                >
                  {row.customerName}
                </Link>
                <span className="block text-[11px] text-muted">
                  <Badge variant="muted">{TAX_INVOICE_KIND_LABELS[row.kind]}</Badge>
                </span>
              </Td>
              <Td className="max-w-[22rem] text-xs text-muted">{row.description}</Td>
              <Td align="end" numeric>
                {formatInvoiceAmount(row.netAmount)}
              </Td>
              <Td align="end" numeric className="text-gold-500">
                {formatInvoiceAmount(row.vatAmount)}
                <span className="ms-1 text-[11px] text-muted">{row.vatRate}%</span>
              </Td>
              <Td align="end" numeric className="font-extrabold">
                {formatInvoiceAmount(row.totalAmount)}
              </Td>
              <Td>
                <LocalTime iso={row.issuedAt} />
              </Td>
            </Tr>
          ))}
        </AdminTable>
      </TableSearch>
    </>
  )
}
