'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouteRefresh } from '@/lib/hooks/use-route-refresh'
import { toast } from 'sonner'
import { CircleSlash, CreditCard, Loader2, Receipt, Route, X } from 'lucide-react'
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
import { TransferGuide } from './transfer-guide'
import { TransferIdentityCard } from './transfer-identity-card'
import { currentOrderStage, orderClosure, orderMoneyMarker } from '@/lib/domain/order-timeline'
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
  const { refresh } = useRouteRefresh()
  const [busy, setBusy] = useState(false)
  const closure = orderClosure(order, order.settlement, side)
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
      toast.success(
        side === 'buyer' ? 'عدلتَ عن الشراء، وعادت اللوحة إلى السوق' : 'أُلغيت الصفقة، وعادت اللوحة إلى السوق',
      )
      await refresh()
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
              {/*
                * **والعدولُ لطرفيها معًا ما دامت بلا سداد.**
                *
                * فمن ضغط «اشترِ الآن» ثمّ عدل لم يكن له مخرج: لا يدفع فتبقى
                * الصفقةُ معلّقةً حتى تنقضي مهلتُها، واللوحةُ محجوزةٌ طوالها
                * لا يشتريها غيرُه ولا يسحبها صاحبُها.
                */}
              {order.status === 'awaiting_settlement' && (
                <CancelOrderButton
                  busy={busy}
                  disabled={busy}
                  side={side}
                  hasDeposit={order.settlement.deposit > 0}
                  onConfirm={cancel}
                />
              )}
            </>
          }
        />
      </section>

      {/*
        * **ولماذا لم تكتمل — جملةٌ صريحةٌ قبل السكّة.**
        *
        * فشارةُ «أُغلقت لعدم السداد» اسمُ حالةٍ لا سبب: لا تقول ما صار إلى
        * العربون ولا أين ذهبت اللوحة. ومن يفتح «المعاملات المكتملة» بعد شهرٍ
        * يسأل هذين بعينهما — والسكّةُ تحتها تروي الرحلة، وهذا يروي خاتمتها.
        */}
      {closure && (
        <section className="rounded-2xl border border-danger/35 bg-danger/[0.06] p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-danger">
            <CircleSlash className="size-4 shrink-0" />
            لم تكتمل الصفقة
          </h2>
          <p className="mt-1.5 text-sm font-semibold text-paper">{closure.reason}</p>
          {closure.effects.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs leading-relaxed text-muted">
              {closure.effects.map((effect) => (
                <li key={effect} className="flex items-start gap-1.5">
                  <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-muted" />
                  {effect}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/*
        * **دليلُ النقل — في المرحلتين اللتين يقع فيهما، لا في غيرهما.**
        *
        * فالنقلُ يقع في أبشر بين الحسابين، والمنصّةُ تحجز المالَ حتى يقع.
        * وكان ما يصل الطرفين جملةً واحدة — «انقل الملكية عبر أبشر أولًا» —
        * ثمّ يُترك كلٌّ يبحث عن الطريق في نظامٍ لا نملكه.
        *
        * **ويُعرض للمشتري وهو ينتظر**: ستصله موافقةٌ معلّقةٌ في أبشر، ومن
        * لا يعرف أنّها ستأتي يتجاهل الإشعارَ أو يحار فيه. فيقرأ خطواتِه
        * قبل أن يُطلب منه — والشارةُ تقول إنّ دورَه لم يبدأ بعد.
        *
        * ولا يُعرض بعد `ownership_transferred` للبائع: فعل ما عليه، وما
        * بقي تحقُّقُ الإدارة.
        */}
      {/*
        * **بياناتُ المشتري — تُطلب منه، وتُعرض للبائع.**
        *
        * وتُطلب من حين تقع الصفقة لا من حين يُسدَّد: يملؤها وهو ينتظر، فلا
        * يقف البائعُ عليها بعد أن يصله المال. وتبقى قابلةً للتصحيح ما دام
        * لم يُرفع إثباتُ النقل.
        */}
      {side === 'buyer' && (order.status === 'awaiting_settlement' || order.status === 'escrow_held') && (
        <TransferIdentityCard
          orderId={order.id}
          identity={order.transferIdentity}
          editable
        />
      )}

      {order.status === 'escrow_held' && (
        <TransferGuide
          side={side}
          active={side === 'seller'}
          identity={order.transferIdentity}
        />
      )}
      {order.status === 'ownership_transferred' && side === 'buyer' && (
        <TransferGuide side="buyer" active />
      )}

      {/*
        * **ولكلّ بطاقةٍ عنوانُها.**
        *
        * فالصفحةُ صارت خمسَ بطاقاتٍ متتابعة — هويّةٌ، ونداءُ مرحلة، ودليلُ
        * نقل، ومسار، وتسوية — وكانت أخيرتان منها بلا عنوان: صندوقان
        * يبدآن برسمٍ ورقم. ومن يفتح صفحةً ليجد رقمًا بعينه يمسحها
        * بالعناوين، فبطاقةٌ بلا عنوانٍ تُقرأ كلُّها أو تُتجاوز كلُّها.
        *
        * والعنوانُ بأيقونته — صفُّ عناوينَ متشابهٌ يُقرأ فهرسًا للصفحة.
        */}
      <section className="rounded-2xl border border-ink-600 bg-ink-800 p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
          <Route className="size-4 shrink-0 text-muted" />
          مسار الصفقة
        </h2>
        <OrderJourney steps={order.timeline} money={orderMoneyMarker(order, side)} />
      </section>

      <section className="rounded-2xl border border-ink-600 bg-ink-800 p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
          <Receipt className="size-4 shrink-0 text-muted" />
          التفاصيل المالية
        </h2>
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
/**
 * إلغاء الصفقة — فعلٌ لا رجعة فيه يمسّ مال طرفٍ ثانٍ.
 *
 * **والنصُّ يقول ما يقع لا ما يُطمئن.** وكان يَعِد بأمرين لا يفعلهما الكود:
 * «تعود اللوحة إليك مسودّةً» — ولم تكن تعود أصلًا — و«يعود عربون المشتري
 * إلى رصيده»، والعربونُ لا يُفكّ إلّا بقرار إدارة (`refundDeposit` تشترط
 * `adminId`). فصار الأوّلُ صحيحًا بالكود، والثاني صحيحًا بالنصّ.
 */
function CancelOrderButton({
  busy,
  disabled,
  side,
  hasDeposit,
  onConfirm,
}: {
  busy: boolean
  disabled: boolean
  side: 'buyer' | 'seller'
  /** هل للمشتري عربون محجوز على هذه الصفقة؟ */
  hasDeposit: boolean
  onConfirm: () => void
}) {
  const buyer = side === 'buyer'
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
          {buyer ? 'أعدل عن الشراء' : 'إلغاء الصفقة'}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>{buyer ? 'تعدل عن الشراء؟' : 'إلغاء الصفقة؟'}</AlertDialogTitle>
        <AlertDialogDescription>
          تُغلق الصفقة <b className="text-paper">نهائيًّا ولا رجعة فيها</b>،{' '}
          {buyer
            ? 'وتعود اللوحة إلى السوق معروضة يشتريها غيرك.'
            : 'وتعود اللوحة إلى السوق معروضة كما كانت.'}
          {hasDeposit
            ? buyer
              ? ' ويبقى عربونك محجوزًا حتى تفصل فيه الإدارة — والعدولُ قد يُسقطه.'
              : ' ويبقى عربون المشتري محجوزًا حتى تفصل فيه الإدارة.'
            : ' ولا مبلغ محجوزًا على هذه الصفقة.'}
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>تراجع</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {buyer ? 'نعم، أعدل' : 'نعم، ألغِ الصفقة'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
