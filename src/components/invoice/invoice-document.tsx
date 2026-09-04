import QRCode from 'qrcode'
import { formatInvoiceAmount } from '@/lib/domain/money'
import { TAX_INVOICE_KIND_LABELS, type TaxInvoice } from '@/lib/domain/types'
import { LocalTime } from '@/components/market/local-time'

/**
 * الفاتورة كما تُسلَّم لصاحبها.
 *
 * ورقة تُطبع وتُحفظ لا صفحة تصفّح: بيضاء دائمًا فلا تُطبع بحبر أسود ملء
 * الصفحة، وبلا زينة تُشغل عن أرقامها. ورمز QR فيها هو ما يقرؤه مفتّش الهيئة
 * من الشاشة أو الورق — فحجمه لا يقلّ عن قدر يُقرأ بكاميرا هاتف.
 *
 * وهي مشتركة بين مسار صاحبها ومسار الإدارة: نسختان من ورقة رسمية تفترقان
 * بسطر تنسيق أخطرُ من تكرارٍ يُصان معًا.
 */
export async function InvoiceDocument({ invoice }: { invoice: TaxInvoice }) {
  const qr = await QRCode.toString(invoice.qr, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 0,
    width: 148,
    color: { dark: '#000000', light: '#ffffff' },
  })

  const line = (label: string, value: React.ReactNode) => (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="text-xs text-black/60">{label}</dt>
      <dd className="text-sm font-semibold">{value}</dd>
    </div>
  )

  return (
    <article className="rounded-2xl border border-black/10 bg-white p-6 text-black shadow-sm sm:p-8 print:rounded-none print:border-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-black/10 pb-5">
          <div>
            <p className="text-lg font-extrabold">فاتورة ضريبية مبسّطة</p>
            <p className="mt-0.5 text-xs text-black/60">Simplified Tax Invoice</p>
            <p className="mt-3 text-sm font-bold">{invoice.sellerName}</p>
            <dl className="mt-1 space-y-0.5 text-xs text-black/70">
              <div>
                الرقم الضريبي:{' '}
                <span dir="ltr" className="font-mono tabular-nums">
                  {invoice.sellerVatNumber}
                </span>
              </div>
              {invoice.sellerCrNumber && (
                <div>
                  الرقم الموحّد:{' '}
                  <span dir="ltr" className="font-mono tabular-nums">
                    {invoice.sellerCrNumber}
                  </span>
                </div>
              )}
              {invoice.sellerAddress && <div>{invoice.sellerAddress}</div>}
            </dl>
          </div>

          <div
            className="shrink-0 rounded-lg bg-white p-1 [&>svg]:h-[148px] [&>svg]:w-[148px]"
            aria-label="رمز الاستجابة السريعة للفاتورة"
            dangerouslySetInnerHTML={{ __html: qr }}
          />
        </header>

        <div className="grid gap-x-8 gap-y-1 border-b border-black/10 py-5 sm:grid-cols-2">
          <dl>
            {line(
              'رقم الفاتورة',
              <span dir="ltr" className="font-mono tabular-nums">
                {invoice.reference}
              </span>,
            )}
            {line('تاريخ الإصدار', <LocalTime iso={invoice.issuedAt} mode="full" />)}
            {line(
              'رقم الصفقة',
              <span dir="ltr" className="font-mono tabular-nums">
                {invoice.orderReference}
              </span>,
            )}
          </dl>
          <dl>
            {line('العميل', invoice.customerName)}
            {line(
              'رقم العضوية',
              <span dir="ltr" className="font-mono tabular-nums">
                {invoice.customerReference}
              </span>,
            )}
            {line('نوع التوريد', TAX_INVOICE_KIND_LABELS[invoice.kind])}
          </dl>
        </div>

        <table className="mt-5 w-full text-sm">
          <thead>
            <tr className="border-b border-black/15 text-xs text-black/60">
              <th className="pb-2 text-start font-semibold">البند</th>
              <th className="pb-2 text-end font-semibold">قبل الضريبة</th>
              <th className="pb-2 text-end font-semibold">الضريبة ({invoice.vatRate}%)</th>
              <th className="pb-2 text-end font-semibold">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-black/10">
              <td className="py-3">{invoice.description}</td>
              <td className="py-3 text-end tabular-nums">{formatInvoiceAmount(invoice.netAmount)}</td>
              <td className="py-3 text-end tabular-nums">{formatInvoiceAmount(invoice.vatAmount)}</td>
              <td className="py-3 text-end font-bold tabular-nums">
                {formatInvoiceAmount(invoice.totalAmount)}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="mt-5 ms-auto max-w-xs">
          <dl className="space-y-1">
            {line('الإجمالي قبل الضريبة', `${formatInvoiceAmount(invoice.netAmount)} ريال`)}
            {line('ضريبة القيمة المضافة', `${formatInvoiceAmount(invoice.vatAmount)} ريال`)}
            <div className="flex items-baseline justify-between gap-4 border-t border-black/15 pt-2">
              <dt className="text-sm font-bold">الإجمالي شامل الضريبة</dt>
              <dd className="text-base font-extrabold tabular-nums">
                {formatInvoiceAmount(invoice.totalAmount)} ريال
              </dd>
            </div>
          </dl>
        </div>

        {/*
          * التجزئة تُطبع.
          *
          * سلسلةٌ لا تُرى لا يستطيع حاملُ الفاتورة التحقّق منها. وطبعها يجعل
          * الورقة نفسها شاهدةً على موضعها في السلسلة.
          */}
        <footer className="mt-8 border-t border-black/10 pt-4 text-[10px] leading-relaxed text-black/50">
          <p>
            التوريد الخاضع للضريبة هو عمولة الوساطة، ولا تدخل قيمة اللوحة في وعاء الضريبة — فهي
            تنتقل بين الطرفين عبر القنوات الرسمية.
          </p>
          <p dir="ltr" className="mt-1 break-all font-mono">
            UUID {invoice.uuid} · HASH {invoice.hash}
          </p>
        </footer>
    </article>
  )
}
