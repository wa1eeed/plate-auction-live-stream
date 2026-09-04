'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CreditCard, Loader2, X } from 'lucide-react'
import { ReferenceChip } from './reference-chip'
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
import { ProgressiveList } from './progressive-list'
import { formatAmount } from '@/lib/domain/money'
import { ORDER_STATUS_LABELS, PLATE_TYPE_LABELS, type AccountOrder } from '@/lib/domain/types'
import { CardTag, type CardTagTone } from './card-tag'
import { SaudiLicensePlate } from '@/components/plate/SaudiLicensePlate'
import { cn, formatTimestamp } from '@/lib/utils'
import { OrderSettlementCard } from './order-timeline'
import { OrderJourney, OrderStageCallout } from './order-journey'
import { OrderEscrowActions } from './order-actions'
import { currentOrderStage, orderMoneyMarker } from '@/lib/domain/order-timeline'

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

/** قائمة الصفقات — يستخدمها «مشترياتي» و«مبيعاتي». */
export function OrderList({
  orders,
  side,
  serverTime,
  compact = false,
}: {
  orders: AccountOrder[]
  side: 'buyer' | 'seller'
  /** مرجع وقت الخادم لعدّادات المهل */
  serverTime: string
  /**
   * صفقة استقرّ مالها لا نداء فيها ولا سكّة.
   *
   * عرض المسار كاملًا لصفقةٍ خلصت يُطيل الصفحة بلا فائدة ويدفن ما يحتاج
   * تصرّفًا تحته. ومن أراد مسارها فتح «تفاصيل المسار» بنفسه.
   */
  compact?: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  /*
   * لم يبقَ للبائع إلا الإلغاء.
   *
   * «تمّت الصفقة» كان زرًّا يرفضه الخادم بـ`USE_TRANSFER_FLOW` منذ صار الإتمام
   * إفراجًا — فحُذف: زرٌّ لا يفعل إلا أن يُظهر خطأً أسوأ من غيابه.
   */
  const cancel = async (orderId: string) => {
    setBusy(orderId + 'cancelled')
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
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
      setBusy(null)
    }
  }

  return (
    <ProgressiveList>
      {orders.map((order) => (
        <OrderCard
          key={order.id}
          order={order}
          side={side}
          serverTime={serverTime}
          compact={compact}
          busy={busy === order.id + 'cancelled'}
          disabled={busy !== null}
          onCancel={() => cancel(order.id)}
        />
      ))}
    </ProgressiveList>
  )
}

/**
 * بطاقة صفقة ممتدّة — بنية «صفقات الإدارة» نفسها بصوت صاحب الصفقة.
 *
 * كانت الصفقة صفًّا عامًّا (`PlateRow`) يضع اللوحة في عمود والباقي في عمود،
 * فيتراكم في الطول: شارات، ثم سطر طرف، ثم أزرار، ثم نداء المرحلة، ثم السكّة،
 * ثم التسوية — ستّ طبقات لا يقول ترتيبها ما المهمّ.
 *
 * والبطاقة تقرأ في ثلاث نظرات: **مَن وكم** في شريط الهوية، ثم **ما المطلوب
 * الآن** وأزراره في طرفه، ثم **أين وصلت** في السكّة. وما لا يُقرأ كل مرّة —
 * تفصيل التسوية — يبقى مطويًّا تحتها.
 */
function OrderCard({
  order,
  side,
  serverTime,
  compact,
  busy,
  disabled,
  onCancel,
}: {
  order: AccountOrder
  side: 'buyer' | 'seller'
  serverTime: string
  compact: boolean
  busy: boolean
  disabled: boolean
  onCancel: () => void
}) {
  const stage = currentOrderStage(order.timeline, order, side)
  const yours = stage.audience === 'you' && stage.step.state !== 'done'

  return (
    <li
      data-row={order.reference}
      className={cn(
        'surface overflow-hidden rounded-2xl transition-colors',
        yours && 'border-gold-600/40',
      )}
    >
      {/*
        * شريط الهويّة: اللوحة ووسومها تحتها، ثم طرفها، ثم مالها في طرفه.
        *
        * الوسوم تحت اللوحة كما في بطاقات السوق: الفراغ حولها يُستغلّ، وتُقرأ
        * مع ما تصفه. ووسمان بتصميمين لمعنًى واحد يجعلان الصفحتين تبدوان من
        * منصّتين.
        */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-3.5 sm:p-4">
        <div className="flex shrink-0 flex-col items-center gap-2">
          <Link
            href={`/market/${order.listingId}`}
            className="rounded-lg border border-transparent transition-colors hover:border-gold-600/60"
            aria-label={`اللوحة ${order.plate.arabicLetters} ${order.plate.plateNumbers}`}
          >
            <SaudiLicensePlate
              {...order.plate}
              size="thumbnail"
              showReflection={false}
              className="w-[136px] sm:w-[176px]"
            />
          </Link>

          <div className="flex flex-wrap items-center justify-center gap-1">
            <CardTag tone={STATUS_TONE[order.status]} dot>
              {ORDER_STATUS_LABELS[order.status]}
            </CardTag>
            <CardTag tone={SOURCE_TONE[order.source]}>{SOURCE_LABELS[order.source]}</CardTag>
            <CardTag tone="muted">{PLATE_TYPE_LABELS[order.plate.plateType]}</CardTag>
          </div>
        </div>

        <div className="min-w-0 flex-1 basis-48 space-y-1.5">
          <ReferenceChip reference={order.reference} kind="order" />
          <p className="text-xs text-muted">
            {side === 'buyer' ? 'البائع' : 'المشتري'}:{' '}
            <span className="font-semibold text-paper">{order.counterpartName}</span>
            {' · '}
            {formatTimestamp(order.createdAt)}
          </p>
        </div>

        {/* المال في طرف الشريط — يُقرأ ولا يُبحث عنه */}
        <div className="shrink-0 text-end">
          <p className="text-[11px] text-muted">المبلغ</p>
          <p className="text-lg font-extrabold tabular-nums text-gold-500">
            {formatAmount(order.amount)}
            <span className="ms-1 text-[11px] font-semibold text-muted">ريال</span>
          </p>
        </div>
      </div>

      {compact ? (
        <div className="border-t border-ink-600/70 p-3.5 sm:p-4">
          <OrderSettlementCard
            settlement={order.settlement}
            status={order.status}
          />
        </div>
      ) : (
        <>
          {/* ما المطلوب الآن — وأزراره في طرفه لا في سطر تحته */}
          <div
            className={cn(
              'border-t px-3.5 py-3.5 sm:px-4',
              stage.step.state === 'failed'
                ? 'border-danger/30 bg-danger/[0.05]'
                : yours
                  ? 'border-gold-600/35 bg-gold-500/[0.06]'
                  : 'border-ink-600/70 bg-ink-900/40',
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
                   * لم يبقَ للبائع إلا الإلغاء: «تمّت الصفقة» كان زرًّا يرفضه
                   * الخادم بـ`USE_TRANSFER_FLOW` منذ صار الإتمام تحويلًا.
                   */}
                  {side === 'seller' && order.status === 'awaiting_settlement' && (
                    <CancelOrderButton
                      busy={busy}
                      disabled={disabled}
                      hasDeposit={order.settlement.deposit > 0}
                      onConfirm={onCancel}
                    />
                  )}
                </>
              }
            />
          </div>

          {/* أين وصلت — السكّة على عرض البطاقة كاملًا */}
          <div className="border-t border-ink-600/70 px-3.5 pb-3.5 pt-4 sm:px-4">
            <OrderJourney steps={order.timeline} money={orderMoneyMarker(order, side)} />
          </div>

          <div className="border-t border-ink-600/70 bg-ink-900/40 p-3.5 sm:p-4">
            <OrderSettlementCard
              settlement={order.settlement}
              status={order.status}
              bare
            />
          </div>
        </>
      )}
    </li>
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
