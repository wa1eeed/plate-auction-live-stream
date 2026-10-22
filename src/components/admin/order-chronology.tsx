import { Clock3 } from 'lucide-react'
import { DEPOSIT_STATUS_LABELS, type Deposit, type Order } from '@/lib/domain/types'
import { formatAmount } from '@/lib/domain/money'
import { formatTimestamp } from '@/lib/utils'

/**
 * **زمنُ الصفقة عند الإدارة — ما وقع ومتى، لا ما سيقع.**
 *
 * وصفُّ الصفقة في الجدول يحمل المهلَ وحدها: متى تنتهي مهلةُ السداد، ومتى
 * مهلةُ النقل. ولا يقول **متى وقع** شيءٌ ممّا وقع — متى أُنشئت، ومتى وصل
 * المال، ومتى رُفع إثباتُ النقل، ومتى أُفرج أو رُدّ. وهي أوّلُ ما يُسأل عنه
 * حين تُشتكى صفقةٌ أو يُفصل في اعتراض.
 *
 * **والمعروضُ ما له ختمٌ فقط**: سطرٌ بلا تاريخٍ لا يُكتب — فجدولٌ نصفُه
 * «لم يقع بعد» يُطيل القراءة ولا يزيد علمًا، وحالةُ الصفقة فوقه تقول أين
 * وقفت.
 *
 * ومعه العربون: أموجودٌ هو، وكم، وما صار إليه — ثلاثةُ أسئلةٍ تتكرّر في كلّ
 * نزاع، وكانت إجابتُها في صفحةٍ أخرى.
 */
export function OrderChronology({
  order,
}: {
  order: Order & { depositAmount: number; depositStatus: Deposit['status'] | null }
}) {
  const marks: { label: string; at: string | null }[] = [
    { label: 'أُنشئت الصفقة', at: order.createdAt },
    { label: 'وصل السداد وحُجز أمانةً', at: order.paidAt },
    { label: 'رُفع إثبات نقل الملكية', at: order.transferProofAt },
    { label: 'رُفع اعتراض', at: order.disputedAt },
    { label: 'أُفرج المبلغ للبائع', at: order.releasedAt },
    { label: 'أُغلقت الصفقة', at: order.completedAt },
  ].filter((mark) => mark.at !== null)

  return (
    <details className="group w-full">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11px] font-semibold text-muted transition-colors hover:text-paper [&::-webkit-details-marker]:hidden">
        <Clock3 className="size-3.5" />
        زمن الإجراءات
      </summary>

      <dl className="mt-2 space-y-1 rounded-lg border border-ink-600 bg-ink-900/50 p-2.5 text-[11px]">
        {marks.map((mark) => (
          <div key={mark.label} className="flex flex-wrap items-baseline justify-between gap-x-3">
            <dt className="text-muted">{mark.label}</dt>
            <dd className="tabular-nums text-paper">{formatTimestamp(mark.at)}</dd>
          </div>
        ))}

        <div className="flex flex-wrap items-baseline justify-between gap-x-3 border-t border-ink-600 pt-1.5">
          <dt className="text-muted">العربون</dt>
          <dd className="tabular-nums text-paper">
            {order.depositAmount > 0
              ? `${formatAmount(order.depositAmount)} · ${DEPOSIT_STATUS_LABELS[order.depositStatus ?? 'held']}`
              : 'لا عربون على هذه الصفقة'}
          </dd>
        </div>
      </dl>
    </details>
  )
}
