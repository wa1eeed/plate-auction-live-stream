'use client'

import Link from 'next/link'
import { ChevronLeft, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProgressiveList } from './progressive-list'
import { formatAmount } from '@/lib/domain/money'
import { ORDER_STATUS_LABELS, type AccountOrder } from '@/lib/domain/types'
import { CardTag, type CardTagTone } from './card-tag'
import { SaudiLicensePlate } from '@/components/plate/SaudiLicensePlate'
import { cn, formatDate } from '@/lib/utils'
import { OverdueTag } from './overdue-tag'
import { currentOrderStage, orderDeadline } from '@/lib/domain/order-timeline'

const SOURCE_LABELS: Record<AccountOrder['source'], string> = {
  auction: 'رست بمزاد',
  fixed: 'شراء مباشر',
  offer: 'عرض مقبول',
}

/** لون طريق البيع نفسه في السوق وفي الحساب — لا يتعلّمه المستخدم مرّتين. */
const SOURCE_TONE: Record<AccountOrder['source'], CardTagTone> = {
  auction: 'gold',
  fixed: 'success',
  offer: 'sky',
}

/**
 * لون الحالة **بموضع المال** لا بالمرحلة.
 *
 * ما انتهى بوصول المال إلى مستحقّه أخضر، وما عاد أو أُغلق رماديّ لا أحمر —
 * الاسترداد نتيجةٌ سليمة لا عطب. والأحمر للخصومة والتخلّف وحدهما.
 */
const STATUS_TONE: Record<AccountOrder['status'], CardTagTone> = {
  awaiting_settlement: 'gold',
  escrow_held: 'gold',
  ownership_transferred: 'gold',
  disputed: 'danger',
  completed: 'success',
  refunded: 'muted',
  cancelled: 'muted',
  defaulted: 'danger',
}

/**
 * **قائمة الصفقات — صفوفٌ تُمسح بنظرة، لا بطاقاتٌ تُقرأ واحدةً واحدة.**
 *
 * وكان كلُّ صفٍّ يحمل نداءَ المرحلة وأزرارَه والسكّةَ والتسوية، فلا تسع
 * الشاشةُ إلا صفقةً ونصفًا — ومن يفتح «مبيعاتي» يسأل «كم عندي وما حالها»
 * لا «ما تفصيل الثالثة». فانتقل التفصيل إلى صفحة الصفقة، وبقي في الصفّ ما
 * يُقرّر به: مَن وكم وما حالها، وزرٌّ واحدٌ حين يكون الدور عليه.
 */
export function OrderList({
  orders,
  side,
  serverTime,
}: {
  orders: AccountOrder[]
  side: 'buyer' | 'seller'
  /** مرجع وقت الخادم لعدّادات المهل */
  serverTime: string
}) {
  return (
    <ProgressiveList>
      {orders.map((order) => (
        <OrderRow key={order.id} order={order} side={side} serverTime={serverTime} />
      ))}
    </ProgressiveList>
  )
}

/**
 * الفعلُ المطلوب في كلمتين — **أمرٌ لا اسمُ محطّة**.
 *
 * وكان الزرّ يحمل `step.short` وهو اسمُ المحطّة تحت نقطتها: «نقل»، «سداد».
 * فيُقرأ اسمًا لا أمرًا، ولا يقول لصاحبه ما يصنع. وهذه هي المواضعُ التي
 * يملك فيها فعلًا — وما عداها فالدورُ على غيره أو على الإدارة.
 */
function rowAction(
  order: AccountOrder,
  side: 'buyer' | 'seller',
): { label: string; href: string } | null {
  if (side === 'buyer' && order.status === 'awaiting_settlement') {
    /* السدادُ وحده يقفز إلى مقصده رأسًا — وبقيّةُ الأفعال في صفحة الصفقة */
    return { label: 'أكمل السداد', href: `/checkout/${order.id}` }
  }
  if (order.disputedAt !== null) return null

  const detail = `/account/orders/${order.id}`
  /* ويُختصر في الصفّ ويُبسط في الصفحة: «أكّد نقل الملكية» يزيح شاراتِ الحال */
  if (side === 'seller' && order.status === 'escrow_held') {
    return { label: 'أكّد النقل', href: detail }
  }
  const transferLate =
    side === 'buyer' &&
    order.status === 'escrow_held' &&
    order.transferDueAt !== null &&
    Date.parse(order.transferDueAt) <= Date.now()
  if (transferLate) return { label: 'اطلب الاسترداد', href: detail }

  return null
}

function OrderRow({
  order,
  side,
  serverTime,
}: {
  order: AccountOrder
  side: 'buyer' | 'seller'
  serverTime: string
}) {
  const stage = currentOrderStage(order.timeline, order, side)
  const yours = stage.audience === 'you' && stage.step.state !== 'done'
  const action = rowAction(order, side)

  return (
    <li
      data-row={order.reference}
      className={cn(
        'surface overflow-hidden rounded-2xl transition-colors hover:border-gold-600/50',
        yours && 'border-gold-600/40',
      )}
    >
      <Link href={`/account/orders/${order.id}`} className="flex items-center gap-3 p-3 sm:gap-4 sm:p-3.5">
        <SaudiLicensePlate
          {...order.plate}
          size="thumbnail"
          showReflection={false}
          className="w-[104px] shrink-0 sm:w-[132px]"
        />

        <div className="min-w-0 flex-1 space-y-1">
          {/* الرقمُ وتاريخُه في سطر — «متى» يُقرأ مع «أيّها» في المسح السريع */}
          <p className="text-[11px] text-muted">
            {order.reference} · {formatDate(order.createdAt)}
          </p>
          <p className="truncate text-sm font-bold">
            {order.plate.arabicLetters} {order.plate.plateNumbers}
          </p>
          <p className="truncate text-[11px] text-muted">
            {side === 'buyer' ? 'البائع' : 'المشتري'}:{' '}
            <span className="font-semibold text-paper">{order.counterpartName}</span>
          </p>
        </div>

        <div className="shrink-0 text-end">
          <p className="text-[10px] text-muted">
            {side === 'seller' ? 'قيمة الصفقة' : 'المبلغ'}
          </p>
          <p className="text-base font-extrabold tabular-nums text-gold-500 sm:text-lg">
            {formatAmount(order.amount)}
          </p>
        </div>

        <ChevronLeft className="size-4 shrink-0 text-muted" />
      </Link>

      {/*
        * شريطُ الحال — الحالُ وموعدُها في طرف، والفعلُ في الطرف الآخر.
        *
        * وهو ما يجعل الصفَّ يُقرأ بلا فتحه: «بانتظار ردّك · متأخّر ٣ أيام»
        * أنفعُ من شارةِ حالةٍ وحدها.
        */}
      <div className="flex flex-wrap items-center gap-2 border-t border-ink-600/70 px-3 py-2.5 sm:px-3.5">
        <CardTag tone={STATUS_TONE[order.status]} dot>
          {ORDER_STATUS_LABELS[order.status]}
        </CardTag>
        <CardTag tone={SOURCE_TONE[order.source]}>{SOURCE_LABELS[order.source]}</CardTag>
        <OverdueTag deadline={orderDeadline(order)} serverTime={serverTime} />

        <span className="ms-auto shrink-0">
          {action ? (
            <Button asChild size="sm">
              <Link href={action.href}>
                {action.href.startsWith('/checkout/') && <CreditCard className="size-4" />}
                {action.label}
              </Link>
            </Button>
          ) : (
            <Link
              href={`/account/orders/${order.id}`}
              className="text-[11px] font-bold text-muted transition-colors hover:text-gold-500"
            >
              التفاصيل
            </Link>
          )}
        </span>
      </div>
    </li>
  )
}
