import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InvoiceDocument } from '@/components/invoice/invoice-document'
import { requireAdminId } from '@/lib/server/require-admin'
import { getStore } from '@/lib/store'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'فاتورة ضريبية' }

/**
 * نسخة الإدارة من الفاتورة.
 *
 * صفحة صاحبها تحت `/account` وحارسُ ذلك القسم يشترط جلسة مستخدم — فأدمن
 * يفتح رابطها يُدفع إلى تسجيل الدخول. والورقة نفسها هنا بحارسها هي.
 */
export default async function AdminInvoicePage({
  params,
}: {
  params: Promise<{ reference: string }>
}) {
  await requireAdminId()
  const { reference } = await params
  const invoice = await getStore().getInvoice(decodeURIComponent(reference))
  if (!invoice) notFound()

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <p className="text-sm font-bold">
            الفاتورة{' '}
            <span dir="ltr" className="font-mono text-gold-500">
              {invoice.reference}
            </span>
          </p>
          <p className="text-xs text-muted">
            نسخة الإدارة — كما تُسلَّم لـ{invoice.customerName}.
          </p>
        </div>
        <Button size="sm" variant="secondary" asChild>
          <Link href="/admin/invoices">
            <ArrowRight className="size-4" />
            رجوع
          </Link>
        </Button>
      </div>
      <InvoiceDocument invoice={invoice} />
    </div>
  )
}
