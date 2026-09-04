import { notFound } from 'next/navigation'
import { requireUserId } from '@/lib/server/require-user'
import { getStore } from '@/lib/store'
import { InvoiceDocument } from '@/components/invoice/invoice-document'
import { InvoiceActions } from './invoice-actions'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'فاتورة ضريبية مبسّطة' }

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ reference: string }>
}) {
  const { reference } = await params
  const userId = await requireUserId()
  const invoice = await getStore().getInvoice(decodeURIComponent(reference))

  /*
   * الفاتورة لصاحبها — لا لكل من عرف رقمها.
   *
   * تحمل اسم عميل ومبلغًا ورقمًا ضريبيًّا؛ ورقمها متسلسل يُخمَّن بالعدّ.
   * و«غير موجودة» لا «ممنوعة»: الثانية تُقرّ بوجود فاتورة بهذا الرقم لغيرك.
   */
  if (!invoice || invoice.customerId !== userId) notFound()

  return (
    <div className="mx-auto max-w-3xl print:p-0">
      <InvoiceActions reference={invoice.reference} />
      <InvoiceDocument invoice={invoice} />
    </div>
  )
}
