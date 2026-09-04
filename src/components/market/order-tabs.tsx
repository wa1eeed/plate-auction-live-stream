'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { DealWon } from './deal-won'
import { OrderList } from './order-list'
import { EmptyState } from './plate-row'
import { orderBucket, type OrderBucket, type OrderSide } from '@/lib/domain/order-timeline'
import type { AccountOrder } from '@/lib/domain/types'
import { useTablistKeys, tabIndexOf } from '@/components/ui/tablist'
import { cn } from '@/lib/utils'

/**
 * تابات الصفقات — **بالدور لا بالمرحلة**.
 *
 * من يفتح «مشترياتي» يسأل «هل عليّ شيء؟» لا «في أي مرحلة أنا؟». وثلاث كوم
 * ثابتة لا تزيد بزيادة الحالات، وعدّادها ظاهر على كل تاب فلا يختفي عن صاحبه
 * ما ينتظره — وهي العلّة الكبرى في التابات: أن تُخفي ما لا يُفتَح.
 *
 * والصفقة التي «خلصت» تُعرض **مختصرة**: لا نداء ولا سكّة، فما عاد فيها ما
 * يُفعل. وبذلك تقصر الصفحة إلى ثلثها ويبقى المهمّ في أعلاها.
 */
const TABS: { key: OrderBucket; label: string; hint: string }[] = [
  { key: 'you', label: 'بانتظار ردّك', hint: 'معاملات تنتظر تصرّفًا منك الآن' },
  { key: 'running', label: 'تحت الإجراء', hint: 'معاملات جارية، الدور فيها على الطرف الآخر أو الإدارة' },
  { key: 'done', label: 'معاملة مكتملة', hint: 'معاملات انتهت ولا إجراء فيها' },
]

export function OrderTabs({
  orders,
  side,
  serverTime,
  emptyTitle,
  emptyHint,
  emptyAction,
}: {
  orders: AccountOrder[]
  side: OrderSide
  serverTime: string
  emptyTitle: string
  emptyHint: string
  emptyAction?: React.ReactNode
}) {
  const groups = useMemo(() => {
    const map: Record<OrderBucket, AccountOrder[]> = { you: [], running: [], done: [] }
    for (const order of orders) map[orderBucket(order, side)].push(order)
    return map
  }, [orders, side])

  /*
   * القسم المفتوح يعيش في الرابط.
   *
   * كان حالةً في الذاكرة وحدها: تحديث الصفحة يعيدك إلى الافتراضي، ورابطٌ
   * تُرسله لا يفتح ما أردت. و`replaceState` لا `router.replace` — الثاني يعيد
   * جلب الصفحة من الخادم لتبديل تاب.
   */
  const params = useSearchParams()
  const fromUrl = params.get('stage')
  const [active, setActive] = useState<OrderBucket>(() =>
    fromUrl === 'you' || fromUrl === 'running' || fromUrl === 'done'
      ? fromUrl
      : groups.you.length > 0
        ? 'you'
        : groups.running.length > 0
          ? 'running'
          : 'done',
  )

  const keys = useTablistKeys()

  const open = (bucket: OrderBucket) => {
    setActive(bucket)
    const url = new URL(window.location.href)
    url.searchParams.set('stage', bucket)
    window.history.replaceState(null, '', url)
  }
  const shown = groups[active]
  // أحدث المكتملة — تُرتَّب البذرة والخادم بالأحدث أوّلًا
  const latestWin = groups.done.find((order) => order.status === 'completed') ?? null

  if (orders.length === 0) {
    return <EmptyState title={emptyTitle} hint={emptyHint} action={emptyAction} />
  }

  return (
    <div className="space-y-4">
      <div
        ref={keys.ref}
        onKeyDown={keys.onKeyDown}
        role="tablist"
        aria-label="أقسام المعاملات"
        /*
         * ثلاثة أقسام تقتسم العرض — لا شريطٌ يفيض فيُسحب.
         *
         * كان `overflow-x-auto` وثلاثة أزرار تتجاوز ٣٧٥ بكسل بقليل، فيصير
         * الشريط منطقة سحبٍ باللمس: تتحرّك التابات مع الإصبع، وتتأرجح عند
         * الطرفين بارتداد المتصفّح — وما يُلمس ليَنقُل لا يجوز أن ينزلق.
         *
         * والقسمة بـ`flex-1` تُدخل الثلاثة في العرض مهما ضاق، فلا فيض ولا
         * سحب. ويعود التمرير فوق `sm` حيث تتّسع الأسماء بحشوها الكامل.
         */
        className="scrollbar-none -mb-px flex border-b border-ink-600 max-sm:overscroll-x-contain sm:edge-fade-start sm:gap-1 sm:overflow-x-auto sm:mask-none"
      >
        {TABS.map((tab) => {
          const count = groups[tab.key].length
          const on = active === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls="order-stage-panel"
              tabIndex={tabIndexOf(on)}
              title={tab.hint}
              onClick={() => open(tab.key)}
              className={cn(
                'relative flex min-w-0 flex-1 items-center justify-center gap-1.5 px-1.5 py-2.5 text-[13px] transition-colors',
                'sm:flex-none sm:shrink-0 sm:gap-2 sm:px-4 sm:text-sm',
                on ? 'font-bold text-gold-400' : 'font-semibold text-muted hover:text-paper',
              )}
            >
              <span className="truncate">{tab.label}</span>
              {/* العدّاد ظاهر دائمًا: تابٌ فيه ما ينتظرك لا يجوز أن يبدو فارغًا */}
              <span
                className={cn(
                  'rounded-full px-1.5 py-px text-[11px] font-bold tabular-nums',
                  count === 0
                    ? 'bg-ink-700 text-muted'
                    : tab.key === 'you'
                      ? 'bg-gold-500/15 text-gold-400'
                      : 'bg-ink-700 text-paper',
                )}
              >
                {count}
              </span>
              {on && (
                <motion.span
                  layoutId="order-stage-tab"
                  className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-gold-500"
                  transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/*
        * اللحظة تُعلَن مرّة: أحدثُ صفقة اكتملت ولم يرَ صاحبها إعلانها بعد.
        * وتُعرض فوق القائمة لا داخلها فلا تزاحم صفوفها.
        */}
      {latestWin && <DealWon order={latestWin} side={side} />}

      <div id="order-stage-panel" role="tabpanel">
      {shown.length === 0 ? (
        <p className="rounded-2xl border border-ink-600 bg-ink-800/60 p-6 text-center text-sm text-muted">
          {active === 'you'
            ? 'لا شيء بانتظار ردّك الآن.'
            : active === 'running'
              ? 'لا توجد معاملات تحت الإجراء.'
              : 'لا توجد معاملات مكتملة بعد.'}
        </p>
      ) : (
        <OrderList
          orders={shown}
          side={side}
          serverTime={serverTime}
          compact={active === 'done'}
        />
      )}
      </div>
    </div>
  )
}
