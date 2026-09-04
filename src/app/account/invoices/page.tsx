import Link from 'next/link'
import { FileText } from 'lucide-react'
import { EmptyState } from '@/components/market/plate-row'
import { ProgressiveList } from '@/components/market/progressive-list'
import { Badge } from '@/components/ui/badge'
import { LocalTime } from '@/components/market/local-time'
import { formatAmount, formatInvoiceAmount } from '@/lib/domain/money'
import { TAX_INVOICE_KIND_LABELS } from '@/lib/domain/types'
import { requireUserId } from '@/lib/server/require-user'
import { getStore } from '@/lib/store'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'فواتيري' }

/**
 * فواتير المستخدم الضريبية.
 *
 * ما يُفوتَر هو **عمولة الوساطة** لا ثمن اللوحة: قيمة اللوحة تنتقل بين
 * الطرفين ولا تدخل وعاء الضريبة. وقولُ ذلك هنا يمنع سؤالًا يتكرّر: «أين
 * فاتورة الثمن؟».
 */
export default async function AccountInvoicesPage() {
  const userId = await requireUserId()
  const invoices = await getStore().listInvoices({ userId })

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold">فواتيري</h1>
        <p className="mt-1 text-sm text-muted">
          فاتورة ضريبية مبسّطة عن كل عمولة استحقّتها المنصّة على صفقاتك.
        </p>
      </header>

      {invoices.length === 0 ? (
        <EmptyState
          title="لا فواتير بعد"
          hint="تصدر فاتورتك عند أوّل صفقة تستحقّ عليها المنصّة عمولة."
        />
      ) : (
        <ProgressiveList>
          {invoices.map((invoice) => (
            <li
              key={invoice.id}
              data-row={invoice.reference}
              className="surface rounded-2xl p-4 transition-colors hover:border-gold-600/50"
            >
              <Link href={`/account/invoices/${invoice.reference}`} className="block">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <FileText className="size-4 shrink-0 text-gold-500" />
                  <span dir="ltr" className="text-xs font-bold tabular-nums text-gold-500">
                    {invoice.reference}
                  </span>
                  <Badge variant="muted">{TAX_INVOICE_KIND_LABELS[invoice.kind]}</Badge>
                  <span className="text-xs text-muted">
                    عن الصفقة{' '}
                    <span dir="ltr" className="font-semibold text-paper">
                      {invoice.orderReference}
                    </span>
                  </span>

                  <span className="ms-auto flex items-center gap-3">
                    <span className="text-base font-extrabold tabular-nums text-gold-500">
                      {formatAmount(invoice.totalAmount)}
                      <span className="ms-1 text-[11px] font-semibold text-muted">ريال</span>
                    </span>
                  </span>
                </div>

                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-ink-600/70 pt-2.5 text-[11px] text-muted">
                  <span>{invoice.description}</span>
                  <span>قبل الضريبة {formatInvoiceAmount(invoice.netAmount)}</span>
                  <span>
                    ضريبة {formatInvoiceAmount(invoice.vatAmount)} ({invoice.vatRate}%)
                  </span>
                  <span className="ms-auto">
                    <LocalTime iso={invoice.issuedAt} />
                  </span>
                </p>
              </Link>
            </li>
          ))}
        </ProgressiveList>
      )}

      <p className="rounded-xl border border-ink-600 bg-ink-800/60 p-4 text-xs leading-relaxed text-muted">
        تُفوتَر عمولة الوساطة وحدها. أمّا ثمن اللوحة فينتقل بين البائع والمشتري ولا يدخل وعاء
        الضريبة — فلا فاتورة ضريبية له من المنصّة.
      </p>
    </div>
  )
}
