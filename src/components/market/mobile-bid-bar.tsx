'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Crown, Loader2, LogIn, Minus, Plus, ShoppingCart, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatAmount, halalasToRiyals, parseAmountInput } from '@/lib/domain/money'
import { isClosedListing, type ListingDetail } from '@/lib/domain/types'
import { cn } from '@/lib/utils'
import { CompactCountdown } from './auction-countdown'

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
  const [amount, setAmount] = useState<number>(detail.nextBidAmount)
  const inFlight = useRef(false)

  // الحدّ الأدنى يتحرّك مع كل مزايدة جديدة تصل لحظيًا
  useEffect(() => {
    setAmount((current) => (current < detail.nextBidAmount ? detail.nextBidAmount : current))
  }, [detail.nextBidAmount])

  if (detail.isMine || isClosedListing(detail.status)) return null

  // رصيدٌ لا يكفي العربون: يُقال قبل المحاولة لا بعد رفض الخادم
  const shortOnDeposit =
    detail.depositAmount > 0 &&
    detail.myDepositStatus !== 'held' &&
    detail.myAvailableBalance !== null &&
    detail.myAvailableBalance < detail.depositAmount

  const step = detail.minimumIncrement > 0 ? detail.minimumIncrement : 100_00
  const belowMinimum = amount < detail.nextBidAmount

  async function submit() {
    if (inFlight.current) return
    if (belowMinimum) {
      toast.error(`أقل مزايدة مقبولة ${formatAmount(detail.nextBidAmount)} ريال`)
      setAmount(detail.nextBidAmount)
      return
    }
    inFlight.current = true
    setBusy(true)
    try {
      const response = await fetch(`/api/listings/${detail.id}/bids`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          amount: halalasToRiyals(amount),
          isCustomAmount: amount !== detail.nextBidAmount,
          clientRequestId: randomRequestId(),
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data?.error?.message ?? 'تعذّر تسجيل المزايدة')
        return
      }
      toast.success('سُجّلت مزايدتك')
      if (data.extended) toast.info(`تم تمديد المزاد ${data.addedSeconds} ثانية`)
      await onDone()
      router.refresh()
    } catch {
      toast.error('تعذّر الاتصال بالخادم')
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  return (
    <div
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
                  أقل مزايدة{' '}
                  <b className="text-paper">{formatAmount(detail.nextBidAmount)} ريال</b>
                </span>
                <CompactCountdown
                  endsAt={detail.endsAt}
                  serverTime={detail.serverTime}
                  withIcon={false}
                />
              </p>
            )}

            {/*
              * ما سيُحجز وما سيُضاف — قبل الضغط لا بعده.
              *
              * الشريط هو واجهة المزايدة الوحيدة على الجوال، وكان يزايد بلا
              * ذكر العربون ولا العمولة ولا رصيد صاحبه: من لا يكفي رصيده لا
              * يعرف إلا بعد الرفض. والقاعدة مكتوبة في المنصّة نفسها: «رسمٌ
              * يكتشفه المشتري بعد أن رست عليه اللوحة يُفسد الثقة».
              */}
            {(detail.depositAmount > 0 || detail.commission.buyer.total > 0) && (
              <p
                className={cn(
                  'flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]',
                  shortOnDeposit ? 'font-semibold text-danger' : 'text-muted',
                )}
              >
                {detail.depositAmount > 0 && (
                  <span>
                    عربون <b>{formatAmount(detail.depositAmount)} ريال</b>{' '}
                    {detail.myDepositStatus === 'held' ? 'محجوز' : 'يُحجز'}
                  </span>
                )}
                {detail.commission.buyer.total > 0 && (
                  <span>
                    · عمولة <b>{formatAmount(detail.commission.buyer.total)} ريال</b> تُضاف
                  </span>
                )}
                {shortOnDeposit && (
                  <Link href="/account/wallet" className="underline">
                    رصيدك لا يكفي — اشحن محفظتك
                  </Link>
                )}
              </p>
            )}

            <div className="flex items-center gap-2">
              {/* ضبط المبلغ بالإبهام دون لوحة مفاتيح */}
              <button
                type="button"
                aria-label="إنقاص المبلغ"
                disabled={busy || amount - step < detail.nextBidAmount}
                onClick={() => setAmount((value) => Math.max(detail.nextBidAmount, value - step))}
                className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-ink-600 bg-ink-900 disabled:opacity-40"
              >
                <Minus className="size-4" />
              </button>

              <input
                inputMode="numeric"
                dir="ltr"
                aria-label="مبلغ المزايدة"
                value={formatAmount(amount)}
                onChange={(event) => {
                  const parsed = parseAmountInput(event.target.value)
                  if (parsed !== null) setAmount(parsed)
                }}
                onBlur={() => {
                  // لا ينزل المبلغ عن الحدّ المطلوب أبدًا
                  if (amount < detail.nextBidAmount) setAmount(detail.nextBidAmount)
                }}
                className={cn(
                  'h-11 min-w-0 flex-1 rounded-xl border bg-ink-900 px-3 text-center text-base font-extrabold tabular-nums outline-none',
                  belowMinimum ? 'border-danger text-danger' : 'border-ink-600',
                )}
              />

              <button
                type="button"
                aria-label="زيادة المبلغ"
                disabled={busy}
                onClick={() => setAmount((value) => value + step)}
                className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-ink-600 bg-ink-900"
              >
                <Plus className="size-4" />
              </button>
            </div>

            <Button
              size="lg"
              className="w-full"
              disabled={busy || detail.iAmHighest || belowMinimum}
              onClick={() => void submit()}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : detail.iAmHighest ? (
                <Crown className="size-4" />
              ) : (
                <TrendingUp className="size-4" />
              )}
              {detail.iAmHighest ? 'أنت أعلى مزايد' : `زايد بـ ${formatAmount(amount)} ريال`}
            </Button>
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
