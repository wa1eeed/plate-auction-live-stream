import { Check, CircleDot, Clock3, X } from 'lucide-react'
import { LocalTime } from './local-time'
import { formatAmount } from '@/lib/domain/money'
import type { OrderSettlement, OrderTimelineStep } from '@/lib/domain/order-timeline'
import type { Order } from '@/lib/domain/types'
import { cn } from '@/lib/utils'

const ICONS = {
  done: Check,
  current: CircleDot,
  pending: Clock3,
  failed: X,
} as const

const TONES = {
  done: 'border-success/50 bg-success/10 text-success',
  current: 'border-gold-600/50 bg-gold-500/10 text-gold-400',
  pending: 'border-ink-600 bg-ink-800 text-muted',
  failed: 'border-danger/50 bg-danger/10 text-danger',
} as const

/**
 * التفصيل المالي للصفقة.
 *
 * الرقم الواحد لا يكفي: من رست عليه لوحة بـ35,000 وعربونه 4,000 يحتاج أن يعرف
 * أن المطلوب منه **31,000** لا 35,000. وإخفاء هذا الطرح يجعل كل صفقة سؤالًا.
 */
export function OrderSettlementCard({
  settlement,
  status,
  bare = false,
}: {
  settlement: OrderSettlement
  /*
   * الحالة لا «هل أُفرج؟».
   *
   * البوليان يعرف حالتين والصفقة تنتهي بثلاث: وصل المال للبائع، أو عاد
   * للمشتري، أو أُغلقت قبل أن يتحرّك. وكان ما ينتهي بالردّ يُقرأ بجملة
   * الحجز — «محجوز أمانةً» — فيبحث صاحبه عن مالٍ عاد إليه من زمن.
   */
  status: Order['status']
  /** بلا إطار — داخل بطاقة الصفقة يحمله شريطها، وإطارٌ داخل إطار حشو */
  bare?: boolean
}) {
  const { side, amount, deposit, depositApplied, commission, net, settled } = settlement
  const seller = side === 'seller'
  const released = status === 'completed'
  /*
   * هل على هذه الصفقة عمولة أصلًا؟
   *
   * الأسطر الرقمية كانت تختفي بصفر العمولة، والجملة تحتها تبقى تقول «بعد خصم
   * عمولة المنصّة وضريبتها» — فيقرأ البائع خصمًا لم يقع ويبحث عن أثره في
   * كشفه. والجملة تتبع الرقم أو تكذب عليه.
   */
  const fee = (commission?.total ?? 0) > 0
  const refunded = status === 'refunded'
  const closed = status === 'cancelled' || status === 'defaulted'
  // العمولة تُضاف على من يدفع وتُطرح ممّن يقبض — والإشارة تقول ذلك قبل الرقم
  const sign = seller ? '−' : '+'

  return (
    <dl className={cn('text-xs', !bare && 'rounded-xl border border-ink-600 bg-ink-900/50 p-3')}>
      <Line label="قيمة الصفقة" value={formatAmount(amount)} />
      {/* عربون المشتري شأن المشتري: للبائع سطرٌ لا يغيّر ما يقبض، ويُقرأ خصمًا عليه */}
      {!seller && deposit > 0 && (
        <Line
          label={depositApplied > 0 ? 'العربون (خُصم)' : 'العربون المحجوز (يُخصم عند الإتمام)'}
          value={`− ${formatAmount(deposit)}`}
          tone="success"
        />
      )}
      {commission && commission.base > 0 && (
        <Line label="عمولة المنصّة" value={`${sign} ${formatAmount(commission.base)}`} />
      )}
      {commission && commission.vat > 0 && (
        <Line
          label="ضريبة القيمة المضافة (على العمولة)"
          value={`${sign} ${formatAmount(commission.vat)}`}
        />
      )}
      <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-ink-600 pt-2">
        <dt className="font-bold">
          {seller
            ? released
              ? 'وصلك'
              : refunded || closed
                ? 'لم يصلك'
                : fee
                  ? 'صافي ما يصلك'
                  : 'ما يصلك'
            : refunded
              ? 'عاد إليك'
              : closed
                ? 'لم يُسدَّد'
                : settled
                  ? 'سُدّد المتبقّي'
                  : 'المطلوب سداده'}
        </dt>
        <dd
          className={cn(
            'text-base font-extrabold tabular-nums',
            seller
              ? released
                ? 'text-success'
                : refunded || closed
                  ? 'text-muted'
                  : 'text-gold-400'
              : refunded
                ? 'text-success'
                : closed
                  ? 'text-muted'
                  : settled
                    ? 'text-success'
                    : 'text-gold-400',
          )}
        >
          {formatAmount(net)}
          <span className="ms-1 text-[11px] font-semibold">ريال</span>
        </dd>
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
        {seller
          ? released
            ? fee
              ? 'وصل إلى محفظتك بعد خصم عمولة المنصّة وضريبتها.'
              : 'وصل إلى محفظتك كاملًا — لا عمولة على هذه الصفقة.'
            : refunded
              ? 'عاد المبلغ إلى المشتري، فلم يصلك منه شيء.'
              : closed
                ? 'أُغلقت الصفقة قبل السداد، فلم يصلك منها شيء.'
                : settled
                  ? `مبلغ المشتري محجوز أمانةً، ويصلك${fee ? '' : ' كاملًا'} بعد نقل الملكية وتحقّق الإدارة منها.`
                  : 'يُحجز مبلغ المشتري أمانةً فور سداده، ولا يصلك قبل نقل الملكية.'
          : released
            ? 'تحقّقت الإدارة من نقل الملكية، فذهب المبلغ إلى البائع واللوحة باسمك.'
            : refunded
              ? 'عاد المبلغ كاملًا إلى محفظتك — تجد تفصيله في كشف حسابك.'
              : closed
                ? 'أُغلقت الصفقة ولم يخرج منك مبلغها.'
                : settled
                  ? 'وصل المبلغ إلى المنصّة ويبقى محفوظًا لديها حتى تتحقّق الإدارة من نقل الملكية.'
                  : 'يُسدَّد المتبقّي عبر المنصّة، ويبقى محفوظًا لدى المنصّة حتى تُنقل الملكية.'}
      </p>
    </dl>
  )
}

function Line({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'success' | 'muted'
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <dt className="text-muted">{label}</dt>
      <dd
        className={cn(
          'tabular-nums',
          tone === 'success' ? 'text-success' : tone === 'muted' ? 'text-muted' : 'font-semibold',
        )}
      >
        {value}
      </dd>
    </div>
  )
}

/**
 * مسار الصفقة.
 *
 * أربع مراحل ثابتة لا يتغيّر عددها بتغيّر النتيجة — يتغيّر لونها وحده. ثبات
 * الشكل يجعل الحالة تُقرأ بلمحة قبل قراءة الكلمات.
 */
export function OrderTimeline({ steps }: { steps: OrderTimelineStep[] }) {
  return (
    <ol className="space-y-0">
      {steps.map((step, index) => {
        const Icon = ICONS[step.state]
        const last = index === steps.length - 1
        return (
          <li key={step.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full border',
                  TONES[step.state],
                )}
              >
                <Icon className="size-3" />
              </span>
              {!last && (
                <span
                  aria-hidden
                  className={cn(
                    'w-px flex-1',
                    step.state === 'done' ? 'bg-success/40' : 'bg-ink-600',
                  )}
                />
              )}
            </div>
            <div className={cn('min-w-0 pb-4', last && 'pb-0')}>
              <p
                className={cn(
                  'text-xs font-bold',
                  step.state === 'failed' && 'text-danger',
                  step.state === 'pending' && 'text-muted',
                )}
              >
                {step.label}
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                {step.at && (
                  <>
                    <LocalTime iso={step.at} mode="datetime" />
                    {' · '}
                  </>
                )}
                {step.hint}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
