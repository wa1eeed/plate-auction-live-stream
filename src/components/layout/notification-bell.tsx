'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, CheckCheck, Megaphone, Clock3, FileCheck, Gavel, HandCoins, Receipt, RotateCcw, Send, ShieldAlert, ShieldCheck, ShieldX, Trophy, Wallet, XCircle } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useRealtime } from '@/lib/hooks/use-realtime'
import { useSound } from '@/lib/hooks/use-sound'
import { isNativeShell } from '@/lib/device'
import { haptic } from '@/lib/haptics'
import { URGENT_NOTIFICATIONS as URGENT } from '@/lib/domain/types'
import { cn, formatTimestamp } from '@/lib/utils'
import {
  URGENT_NOTIFICATIONS,
  type Notification,
  type NotificationType,
} from '@/lib/domain/types'

const ICONS: Record<NotificationType, React.ElementType> = {
  outbid: Gavel,
  broadcast: Megaphone,
  auction_won: Trophy,
  auction_lost: Gavel,
  reserve_not_met: Gavel,
  offer_sent: Send,
  offer_received: HandCoins,
  offer_accepted: HandCoins,
  offer_declined: XCircle,
  offer_countered: HandCoins,
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
        /*
         * لكل جنسٍ نبرته: العرض الوارد جرسٌ لطيف لا نبرةَ تحذير.
         *
         * والنبرة تُقرأ قبل النصّ — من سمع نبرة «تجاوزك غيرك» ظنّ مزادًا يفلت
         * منه، وإنّما وصله عرضٌ ينتظر ردّه.
         */
        play(
          latest?.type === 'offer_received'
            ? 'offer-in'
            : latest && URGENT.includes(latest.type)
              ? 'outbid'
              : 'alert',
        )
        /*
         * والعاجل وحده يهتزّ.
         *
         * الاهتزاز أشدّ من الصوت مقاطعةً — يُحسّ في الجيب ولا يُطفئه وضعُ
         * الصمت — فيُقصَر على ما يستدعي تصرّفًا الآن: تجاوزٌ، أو مهلةٌ توشك،
         * أو لوحةٌ رست. وما عداه يُقرأ في الجرس متى فُتحت المنصّة.
         */
        if (latest && URGENT.includes(latest.type)) haptic('warning')
      }
      previousUnread.current = data.unread
    } catch {
      // انقطاع مؤقّت — المزامنة التالية تُصحّح
    }
  }, [play])

  useRealtime({ topics: [`user:${userId}`], onResync: sync })

  /*
   * إنعاشُ الصفحة عند إشعارٍ **جديد** — لا عند كلّ عددٍ أكبر من صفر.
   *
   * وكان الشرط `unread > 0` وحده، وهو يُنعش المسار كلَّه في كلّ مرّةٍ يتبدّل
   * فيها العدد وهو موجب — والإنعاش يُعيد تصيير الخادم لكلّ الشجرة. وثلاثة
   * عيوبٍ فيه:
   *
   *  ١. عملٌ كبير لخبرٍ صغير: إشعارٌ واحد يُعيد بناء الصفحة كلّها.
   *  ٢. **وهو يقع والقائمة مفتوحة** — فتُعاد الشجرة من تحتها، وعلى جهازٍ
   *     أبطأ من الحاسوب قد تُغلق في وجه صاحبها.
   *  ٣. وبعد `markAllRead` يصير العدد صفرًا فيُنعَش مرّةً أخرى.
   *
   * فصار الإنعاش على **الزيادة** وحدها، ولا يقع والقائمة مفتوحة: من فتحها
   * يقرأ ما فيها، وما تحتها يُنعَش عند إغلاقها.
   */
  const refreshedAt = useRef(0)
  useEffect(() => {
    if (open) return
    if (unread <= refreshedAt.current) {
      refreshedAt.current = unread
      return
    }
    refreshedAt.current = unread
    router.refresh()
  }, [unread, open, router])

  /*
   * شارةُ الأيقونة — الرقم على أيقونة التطبيق في الشاشة الرئيسية.
   *
   * تعمل للمثبَّت وحده (ولغلافه الأصيل)، وتُتجاهل في تبويب متصفّح — ولذلك لا
   * يُسأل عنها ولا يُفحص: `catch` صامت، فمتصفّحٌ لا يدعمها لا يُسقط جرسًا يعمل.
   *
   * وتُمسح عند الصفر لا تُترك برقمٍ قديم: أيقونةٌ تقول «٣» وليس وراءها شيء
   * تُعلَّم صاحبَها ألّا يصدّقها.
   */
  useEffect(() => {
    /*
     * قناتان: واجهة الويب، **وجسر الغلاف** — و`navigator.setAppBadge` لا
     * وجود لها في غلاف iOS.
     *
     * فالخادم يُرسل الرقم مع الإشعار (`aps.badge`) فيظهر، ثمّ يقرأ صاحبه
     * إشعاراته **داخل التطبيق** فلا يُمحى: الويب يمسحها بواجهته وiOS لا
     * يسمعها — فيبقى «٣» على أيقونةٍ لا وراءها شيء.
     *
     * وإضافة الإشعارات تحمل `removeAllDeliveredNotifications` التي تمسح
     * مركز الإشعارات، ولا تمسح الشارة. والشارة تُصفَّر بإشعارٍ صامتٍ من
     * الخادم أو بجسرٍ أصيل — وهذا أوّلُهما وأقربُهما.
     */
    void (async () => {
      try {
        const badge = navigator as Navigator & {
          setAppBadge?: (count?: number) => Promise<void>
          clearAppBadge?: () => Promise<void>
        }
        if (unread > 0) await badge.setAppBadge?.(unread)?.catch(() => undefined)
        else await badge.clearAppBadge?.()?.catch(() => undefined)

        if (!isNativeShell()) return
        const { PushNotifications } = await import('@capacitor/push-notifications')
        /*
         * وعند الصفر يُمسح مركز الإشعارات كذلك: إشعاراتٌ مقروءةٌ في التطبيق
         * تبقى في المركز فيُظنّ أنّها لم تُقرأ.
         */
        if (unread === 0) {
          await PushNotifications.removeAllDeliveredNotifications().catch(() => undefined)
        }
      } catch {
        // شارةٌ لم تُرسم — والعدد ظاهرٌ على الجرس نفسه
      }
    })()
  }, [unread])

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
