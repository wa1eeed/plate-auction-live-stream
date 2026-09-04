'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, CheckCheck, Clock3, FileCheck, Gavel, HandCoins, Receipt, RotateCcw, ShieldAlert, ShieldCheck, ShieldX, Trophy, Wallet, XCircle } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useRealtime } from '@/lib/hooks/use-realtime'
import { useSound } from '@/lib/hooks/use-sound'
import { URGENT_NOTIFICATIONS as URGENT } from '@/lib/domain/types'
import { cn, formatTimestamp } from '@/lib/utils'
import {
  URGENT_NOTIFICATIONS,
  type Notification,
  type NotificationType,
} from '@/lib/domain/types'

const ICONS: Record<NotificationType, React.ElementType> = {
  outbid: Gavel,
  auction_won: Trophy,
  auction_lost: Gavel,
  reserve_not_met: Gavel,
  offer_received: HandCoins,
  offer_accepted: HandCoins,
  offer_declined: XCircle,
  listing_sold: Trophy,
  payment_confirmed: Wallet,
  payment_failed: XCircle,
  deposit_released: Wallet,
  deposit_forfeited: ShieldX,
  order_defaulted: ShieldX,
  commission_charged: Receipt,
  commission_due: Receipt,
  payment_due_soon: Clock3,
  payment_overdue: Clock3,
  order_escrow_held: ShieldCheck,
  order_awaiting_transfer: FileCheck,
  order_awaiting_confirmation: Clock3,
  order_disputed: ShieldAlert,
  order_released: Wallet,
  order_refunded: Wallet,
  listing_relisted: RotateCcw,
  listing_suspended: ShieldX,
  listing_reinstated: ShieldCheck,
}

/**
 * جرس الإشعارات.
 *
 * يشترك في موضوع المستخدم على الاتصال اللحظي نفسه الذي يحمل المزايدات — فلا
 * اتصال ثانٍ ولا استطلاع دوري. ووصول الحدث لا يحمل الحالة بل يستدعي مزامنة،
 * تمامًا كبقية أحداث المنصّة.
 */
export function NotificationBell({ userId }: { userId: string }) {
  const router = useRouter()
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const { play } = useSound()
  const previousUnread = useRef(0)

  const sync = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications', { cache: 'no-store' })
      if (!response.ok) return
      const data = (await response.json()) as { items: Notification[]; unread: number }
      setItems(data.items)
      setUnread(data.unread)

      // صوت عند وصول جديد فقط — لا عند كل مزامنة
      if (data.unread > previousUnread.current) {
        const latest = data.items[0]
        play(latest && URGENT.includes(latest.type) ? 'outbid' : 'alert')
      }
      previousUnread.current = data.unread
    } catch {
      // انقطاع مؤقّت — المزامنة التالية تُصحّح
    }
  }, [play])

  useRealtime({ topics: [`user:${userId}`], onResync: sync })

  // إشعار جديد قد يغيّر ما تعرضه الصفحة (رصيد، حالة مزاد)، فنُنعش المحتوى
  useEffect(() => {
    if (unread > 0) router.refresh()
  }, [unread, router])

  async function markAllRead() {
    if (unread === 0) return
    setUnread(0)
    setItems((current) => current.map((item) => ({ ...item, readAt: new Date().toISOString() })))
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
  }

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        // تُعلَّم مقروءة عند الفتح لا عند الضغط على كل عنصر
        if (next) void markAllRead()
      }}
    >
      <DropdownMenuTrigger
        className="relative flex size-9 items-center justify-center rounded-xl border border-ink-600 bg-ink-800 text-muted transition-colors hover:border-ink-500 hover:text-paper focus-visible:outline-none"
        aria-label={unread > 0 ? `الإشعارات — ${unread} غير مقروء` : 'الإشعارات'}
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute -end-1 -top-1 flex min-w-[1.15rem] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-extrabold text-white">
            {unread > 9 ? '+9' : unread}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[min(22rem,92vw)] p-0">
        <div className="flex items-center justify-between border-b border-ink-600 px-4 py-3">
          <span className="text-sm font-bold">الإشعارات</span>
          {items.length > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-muted">
              <CheckCheck className="size-3" />
              عُلّمت مقروءة
            </span>
          )}
        </div>

        {items.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">
            لا إشعارات بعد. ستصلك هنا عند تجاوزك في مزاد أو وصول عرض على لوحتك.
          </p>
        ) : (
          <ul className="max-h-[min(26rem,70dvh)] overflow-y-auto">
            {items.map((item) => {
              const Icon = ICONS[item.type]
              const urgent = URGENT_NOTIFICATIONS.includes(item.type)
              const body = (
                <>
                  <span
                    className={cn(
                      'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border',
                      urgent
                        ? 'border-gold-600/40 bg-gold-500/12 text-gold-500'
                        : 'border-ink-600 bg-ink-900 text-muted',
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">{item.title}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                      {item.body}
                    </span>
                    <span className="mt-1 block text-[11px] text-muted">
                      {formatTimestamp(item.createdAt)}
                    </span>
                  </span>
                </>
              )

              return (
                <li key={item.id} className="border-b border-ink-600/60 last:border-0">
                  {item.href ? (
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="flex gap-3 px-4 py-3 transition-colors hover:bg-ink-700/60"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className="flex gap-3 px-4 py-3">{body}</div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
