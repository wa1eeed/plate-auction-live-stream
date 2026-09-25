'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CreditCard, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { OrderSettlementCard } from './order-timeline'
import { OrderJourney, OrderStageCallout } from './order-journey'
import { OrderEscrowActions } from './order-actions'
import { currentOrderStage, orderMoneyMarker } from '@/lib/domain/order-timeline'
import type { AccountOrder } from '@/lib/domain/types'
import { cn } from '@/lib/utils'

/**
 * **تفاصيلُ صفقةٍ واحدة — ما كان محشورًا في صفّ القائمة.**
 *
 * وكانت كلُّ صفقةٍ تُعرض ممتدّةً في القائمة: نداءُ المرحلة وأزرارُه، ثمّ
 * السكّة، ثمّ التسوية — فلا يسع الشاشةَ إلا صفقةٌ ونصف، ومن يفتح «مبيعاتي»
 * يسأل أوّلًا «كم عندي وما حالها» لا «ما تفصيل الثالثة». فصارت القائمةُ
 * صفوفًا تُمسح بنظرة، وهذا ما يُفتح عند الحاجة.
 *
 * وهو عميلٌ لأنّ فيه أفعالًا تمسّ مالًا — والصفحةُ حوله خادميّة.
 */
export function OrderDetail({
  order,
  side,
  serverTime,
}: {
  order: AccountOrder
  side: 'buyer' | 'seller'
  serverTime: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const stage = currentOrderStage(order.timeline, order, side)
  const yours = stage.audience === 'you' && stage.step.state !== 'done'

  const cancel = async () => {
    setBusy(true)
    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.error?.message ?? 'تعذّر إلغاء الصفقة')
        return
      }
      toast.success('أُلغيت الصفقة، وعادت اللوحة إليك')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* ما المطلوب الآن — وأزراره في طرفه لا في سطر تحته */}
      <section
        className={cn(
          'rounded-2xl border p-4',
          stage.step.state === 'failed'
            ? 'border-danger/40 bg-danger/[0.06]'
            : yours
              ? 'border-gold-600/40 bg-gold-500/[0.07]'
              : 'border-ink-600 bg-ink-900/40',
        )}
      >
        <OrderStageCallout
          {...stage}
          serverTime={serverTime}
          bare
          action={
            <>
              {/* المشتري يُكمل سداده من هنا — وإلا بقيت الصفقة معلّقة بلا مخرج */}
              {side === 'buyer' && order.status === 'awaiting_settlement' && (
                <Button asChild size="sm">
                  <Link href={`/checkout/${order.id}`}>
                    <CreditCard className="size-4" />
                    أكمل السداد
                  </Link>
                </Button>
              )}
              <OrderEscrowActions order={order} side={side} />
              {side === 'seller' && order.status === 'awaiting_settlement' && (
                <CancelOrderButton
                  busy={busy}
                  disabled={busy}
                  hasDeposit={order.settlement.deposit > 0}
                  onConfirm={cancel}
                />
              )}
            </>
          }
        />
      </section>

      {/* أين وصلت */}
      <section className="rounded-2xl border border-ink-600 bg-ink-800 px-4 pb-4 pt-5">
        <OrderJourney steps={order.timeline} money={orderMoneyMarker(order, side)} />
      </section>

      <section className="rounded-2xl border border-ink-600 bg-ink-800 p-4">
        <OrderSettlementCard settlement={order.settlement} status={order.status} bare />
      </section>
    </div>
  )
}

/**
 * إلغاء الصفقة — فعلٌ لا رجعة فيه يمسّ مال طرفٍ ثانٍ.
 *
 * كان بضغطة واحدة بلا سؤال: يُغلق صفقةً نهائيًّا، ويُحرّك عربونًا محجوزًا
 * للمشتري، وتعود اللوحة إلى البائع. وكل فعل مدمّر آخر في المنصّة محروس بحوار
 * يقول ما يقع — فلا يكون أخطرها أسهلها.
 */
function CancelOrderButton({
  busy,
  disabled,
  hasDeposit,
  onConfirm,
}: {
  busy: boolean
  disabled: boolean
  /** هل للمشتري عربون محجوز على هذه الصفقة؟ */
  hasDeposit: boolean
  onConfirm: () => void
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
          إلغاء الصفقة
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>إلغاء الصفقة؟</AlertDialogTitle>
        <AlertDialogDescription>
          تُغلق الصفقة <b className="text-paper">نهائيًّا ولا رجعة فيها</b>، وتعود اللوحة
          إليك مسودّةً تعرضها متى شئت.
          {hasDeposit
            ? ' ويعود عربون المشتري المحجوز إلى رصيده — فلا مصادرة في إلغاءٍ منك.'
            : ' ولا مبلغ محجوزًا على هذه الصفقة.'}
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>تراجع</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>نعم، ألغِ الصفقة</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
