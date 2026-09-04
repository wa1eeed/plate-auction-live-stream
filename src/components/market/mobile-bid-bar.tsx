'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, LogIn, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatAmount } from '@/lib/domain/money'
import { isClosedListing, type ListingDetail } from '@/lib/domain/types'
import { cn } from '@/lib/utils'
import { CompactCountdown } from './auction-countdown'
import { AuctionBidBox } from './auction-bid-box'

function randomRequestId() {
  return `req_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

/**
 * شريط مزايدة ثابت أسفل الشاشة على الجوال.
 *
 * على الجوال يكون زرّ المزايدة أسفل صفحة طويلة، فيضطر المزايد للتمرير في كل
 * مرة — وفي الثواني الأخيرة من المزاد يكلّفه ذلك اللوحة. الشريط يُبقي المبلغ
 * والزرّ والعدّاد في متناول الإبهام دائمًا.
 *
 * يظهر على الجوال وحده (`lg:hidden`) لأن اللوحة الجانبية على الشاشات الكبيرة
 * ظاهرة أصلًا بلا تمرير.
 */
export function MobileBidBar({
  detail,
  isSignedIn,
  onDone,
}: {
  detail: ListingDetail
  isSignedIn: boolean
  onDone: () => void | Promise<void>
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  /*
   * ارتفاع الشريط يُنشَر إلى الصفحة بدل أن يُخمَّن.
   *
   * كان المتن يحجز `pb-52` ثابتة والشريط يبلغ ٢٥٧ بكسل، فيغطّي آخر ما تحته —
   * وارتفاعه ليس ثابتًا أصلًا: يزيد بسطر العربون، وبرقاقات الزيادة، وينقص
   * لغير المزاد. فيُقاس ويُكتب في متغيّر تقرؤه الصفحة.
   */
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const root = document.documentElement
    const sync = () => root.style.setProperty('--bid-bar-h', `${el.offsetHeight}px`)
    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(el)
    return () => {
      observer.disconnect()
      root.style.removeProperty('--bid-bar-h')
    }
  })

  if (detail.isMine || isClosedListing(detail.status)) return null

  return (
    <div
      ref={ref}
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 lg:hidden',
        // مساحة أمان لأشرطة الإيماءات في أجهزة الجوال
        'border-t border-ink-600 bg-ink-800/95 backdrop-blur-md',
        'pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3',
      )}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-2 px-4">
        {!isSignedIn ? (
          <Button asChild size="lg" className="w-full">
            <Link href={`/login?next=/market/${detail.id}`}>
              <LogIn className="size-4" />
              {detail.saleType === 'auction'
                ? `سجّل وزايد بـ ${formatAmount(detail.nextBidAmount)} ريال`
                : detail.saleType === 'fixed'
                  ? `سجّل واشترِ بـ ${formatAmount(detail.price)} ريال`
                  : 'سجّل وأرسل عرضك'}
            </Link>
          </Button>
        ) : detail.saleType === 'auction' ? (
          <>
            {detail.endsAt && (
              <p className="flex items-center justify-between text-[11px] text-muted">
                <span>
                  أعلى مزايدة{' '}
                  <b className="tabular-nums text-gold-500">
                    {formatAmount(detail.highestAmount ?? detail.startingPrice)} ريال
                  </b>
                </span>
                <CompactCountdown
                  endsAt={detail.endsAt}
                  serverTime={detail.serverTime}
                  withIcon={false}
                />
              </p>
            )}

            {/* الواجهة نفسها التي يراها على الحاسوب — لا منطقان لفعلٍ واحد */}
            <AuctionBidBox detail={detail} isSignedIn={isSignedIn} onDone={onDone} variant="bar" />
          </>
        ) : detail.saleType === 'fixed' ? (
          <Button
            size="lg"
            className="w-full"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                const response = await fetch(`/api/listings/${detail.id}/buy`, {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ clientRequestId: randomRequestId() }),
                })
                const data = await response.json()
                if (!response.ok) {
                  toast.error(data?.error?.message ?? 'تعذّر إتمام الشراء')
                  return
                }
                /*
                 * إلى صفحة السداد لا إلى تنبيه عابر.
                 *
                 * كان الجوال يكتفي بـ«تم تسجيل طلب الشراء» ثم يُبقي المشتري
                 * في مكانه، وقد صار مرتبطًا بصفقة ومهلتها تجري — وكل ما رآه
                 * توست يختفي بعد ثوانٍ. والحاسوب يفعل الصواب منذ البداية.
                 */
                router.push(`/checkout/${data.orderId}`)
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ShoppingCart className="size-4" />}
            اشترِ الآن بـ {formatAmount(detail.price)} ريال
          </Button>
        ) : (
          <Button asChild size="lg" variant="secondary" className="w-full">
            <a href="#trade">أرسل عرضك</a>
          </Button>
        )}
      </div>
    </div>
  )
}
