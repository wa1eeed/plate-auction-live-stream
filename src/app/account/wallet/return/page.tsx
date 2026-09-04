import Link from 'next/link'
import type { Metadata } from 'next'
import { CheckCircle2, Clock3, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatAmount } from '@/lib/domain/money'
import { requireUserId } from '@/lib/server/require-user'
import { syncTapPayment } from '@/lib/server/payment-service'
import { getStore } from '@/lib/store'
import type { Payment } from '@/lib/domain/types'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'نتيجة الدفع' }

/**
 * صفحة العودة من بوابة Tap.
 *
 * **لا نصدّق أن العودة إلى هنا تعني الدفع.** نقرأ حالة العملية من البوابة
 * مباشرة، فمن يفتح هذا الرابط يدويًا لا يشحن رصيده. و`tap_id` مجرّد دليل
 * للعثور على العملية لا إثبات لنتيجتها.
 */
export default async function TapReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ tap_id?: string }>
}) {
  const userId = await requireUserId()
  const { tap_id: chargeId } = await searchParams
  const store = getStore()

  let payment: Payment | null = null
  if (chargeId) {
    const found = await store.findPaymentByCharge(chargeId)
    // العملية يجب أن تخصّ صاحب الجلسة — لا نكشف عمليات غيره
    if (found && found.userId === userId) {
      payment = await syncTapPayment(found.id).catch(() => found)
    }
  }

  const state = !payment ? 'unknown' : payment.status === 'paid' ? 'paid' : payment.status === 'failed' ? 'failed' : 'pending'

  const COPY = {
    paid: {
      icon: CheckCircle2,
      tone: 'text-success',
      title: 'تم الدفع بنجاح',
      body: 'أُضيف المبلغ إلى رصيد محفظتك، ويمكنك المزايدة فورًا.',
    },
    failed: {
      icon: XCircle,
      tone: 'text-danger',
      title: 'لم تكتمل العملية',
      body: 'لم يُخصم أي مبلغ. يمكنك المحاولة من جديد أو اختيار طريقة أخرى.',
    },
    pending: {
      icon: Clock3,
      tone: 'text-gold-500',
      title: 'العملية قيد المعالجة',
      body: 'ما زالت البوابة تعالج الدفع. سيُحدَّث رصيدك تلقائيًا فور تأكيدها.',
    },
    unknown: {
      icon: Clock3,
      tone: 'text-muted',
      title: 'لم نجد هذه العملية',
      body: 'تحقّق من محفظتك — إن لم يُضف الرصيد فتواصل مع الإدارة.',
    },
  }[state]

  const Icon = COPY.icon

  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <Icon className={`mx-auto mb-4 size-12 ${COPY.tone}`} />
      <h1 className="text-xl font-extrabold">{COPY.title}</h1>
      {payment && (
        <p className="mt-1 text-2xl font-extrabold tabular-nums text-gold-500">
          {formatAmount(payment.amount)}
          <span className="ms-1 text-sm font-normal text-muted">ريال</span>
        </p>
      )}
      <p className="mt-3 text-sm text-muted">{COPY.body}</p>
      {payment && (
        <p className="mt-1 text-[11px] text-muted">الرقم المرجعي {payment.reference}</p>
      )}

      <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
        <Button asChild>
          <Link href="/account/wallet">العودة إلى المحفظة</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/market">تصفّح السوق</Link>
        </Button>
      </div>
    </div>
  )
}
