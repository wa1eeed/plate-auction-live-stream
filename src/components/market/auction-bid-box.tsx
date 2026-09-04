'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Crown, Gavel, Loader2, LogIn, Minus, Plus, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { quickBidSteps } from '@/lib/domain/auction'
import { formatAmount, halalasToRiyals, parseAmountInput } from '@/lib/domain/money'
import type { ListingDetail } from '@/lib/domain/types'
import { useSound } from '@/lib/hooks/use-sound'
import { cn } from '@/lib/utils'

function randomRequestId() {
  return `req_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

/**
 * واجهة المزايدة — واحدة للشاشتين.
 *
 * كانت اثنتين: نموذجٌ في العمود الجانبي (زرٌّ بمبلغ ثابت، ثمّ شبكةُ أزرارٍ
 * تزايد فورًا، ثمّ حقلٌ وزرٌّ ثالث) وشريطٌ ثابت على الجوال بمنطقٍ آخر. فكان
 * المزايد على الجوال يرى الاثنين معًا، ويتعلّم على الحاسوب واجهةً لا يجدها
 * حين يفتح الصفحة من جواله.
 *
 * وقاعدة الرقاقات انقلبت عمدًا: كانت `+1000` **تُزايد فورًا** بذلك المبلغ —
 * ضغطةٌ واحدة تلتزم بمال، بلا مراجعة ولا تراجع. وصارت تُعدِّل المبلغ في
 * الحقل، فالالتزام يقع بفعلٍ واحدٍ صريح: الزرّ الكبير وحده.
 */
export function AuctionBidBox({
  detail,
  isSignedIn,
  onDone,
  variant = 'panel',
}: {
  detail: ListingDetail
  isSignedIn: boolean
  onDone: () => void | Promise<void>
  /** `bar` مضغوطة لشريط الجوال الثابت، و`panel` للعمود الجانبي */
  variant?: 'panel' | 'bar'
}) {
  const router = useRouter()
  const { play } = useSound()
  const [amount, setAmount] = useState<number>(detail.nextBidAmount)
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const bar = variant === 'bar'

  /*
   * المبلغ يلاحق الحدّ ولا ينزل عنه.
   *
   * مزايدةٌ تصل لحظيًّا ترفع الحدّ الأدنى، فيصير ما في الحقل أقلّ ممّا يُقبل.
   * ورفعُه تلقائيًّا يُبقي الضغطة التالية صالحة بدل أن تُرفض من الخادم.
   */
  useEffect(() => {
    setAmount((current) => (current < detail.nextBidAmount ? detail.nextBidAmount : current))
  }, [detail.nextBidAmount])

  const step = detail.minimumIncrement > 0 ? detail.minimumIncrement : 100_00
  const belowMinimum = amount < detail.nextBidAmount
  const steps = detail.allowCustomBid ? quickBidSteps(detail.minimumIncrement, detail.nextBidAmount) : []

  // رصيدٌ لا يكفي العربون: يُقال قبل المحاولة لا بعد رفض الخادم
  const shortOnDeposit =
    detail.depositAmount > 0 &&
    detail.myDepositStatus !== 'held' &&
    detail.myAvailableBalance !== null &&
    detail.myAvailableBalance < detail.depositAmount

  if (!isSignedIn) {
    return (
      <Button asChild size={bar ? 'lg' : 'xl'} className="w-full">
        <Link href={`/login?next=/market/${detail.id}`}>
          <LogIn className="size-4" />
          سجّل وزايد بـ {formatAmount(detail.nextBidAmount)} ريال
        </Link>
      </Button>
    )
  }

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
      play('bid')
      toast.success('سُجّلت مزايدتك')
      if (data.extended) toast.info(`مُدّد المزاد ${data.addedSeconds} ثانية`)
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
    <div className={cn('flex flex-col', bar ? 'gap-2' : 'gap-3')}>
      {/*
        * ما سيُحجز وما سيُضاف — قبل الضغط لا بعده.
        * «رسمٌ يكتشفه المشتري بعد أن رست عليه اللوحة يُفسد الثقة».
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
            <span>· عمولة <b>{formatAmount(detail.commission.buyer.total)} ريال</b> تُضاف</span>
          )}
          {shortOnDeposit && (
            <Link href="/account/wallet" className="underline">
              رصيدك لا يكفي — اشحن محفظتك
            </Link>
          )}
        </p>
      )}

      {/* الرقاقات تُعدِّل المبلغ ولا تلتزم به — الالتزام بالزرّ الكبير وحده */}
      {steps.length > 0 && !detail.iAmHighest && (
        <div className="flex flex-wrap gap-1.5">
          {steps.map((value) => (
            <button
              key={value}
              type="button"
              disabled={busy}
              onClick={() => setAmount(detail.nextBidAmount + value)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[11px] font-bold tabular-nums transition-colors',
                amount === detail.nextBidAmount + value
                  ? 'border-gold-600 bg-gold-500/15 text-gold-400'
                  : 'border-ink-600 bg-ink-900/60 text-muted hover:border-gold-600/50 hover:text-paper',
              )}
            >
              <span dir="ltr">+{formatAmount(value)}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        {/* الضبط بالإبهام دون لوحة مفاتيح */}
        <button
          type="button"
          aria-label="إنقاص المبلغ"
          disabled={busy || amount - step < detail.nextBidAmount}
          onClick={() => setAmount((value) => Math.max(detail.nextBidAmount, value - step))}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-ink-600 bg-ink-900 transition-colors hover:border-gold-600/50 disabled:opacity-40"
        >
          <Minus className="size-4" />
        </button>

        <div className="relative min-w-0 flex-1">
          <input
            inputMode="numeric"
            dir="ltr"
            aria-label="مبلغ المزايدة"
            value={formatAmount(amount)}
            disabled={busy}
            onChange={(event) => {
              const parsed = parseAmountInput(event.target.value)
              if (parsed !== null) setAmount(parsed)
            }}
            onBlur={() => {
              if (amount < detail.nextBidAmount) setAmount(detail.nextBidAmount)
            }}
            className={cn(
              'h-11 w-full rounded-xl border bg-ink-900 px-3 text-center text-base font-extrabold tabular-nums outline-none transition-colors focus:border-gold-600',
              belowMinimum ? 'border-danger text-danger' : 'border-ink-600',
            )}
          />
          <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-[10px] font-bold text-muted">
            ريال
          </span>
        </div>

        <button
          type="button"
          aria-label="زيادة المبلغ"
          disabled={busy}
          onClick={() => setAmount((value) => value + step)}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-ink-600 bg-ink-900 transition-colors hover:border-gold-600/50"
        >
          <Plus className="size-4" />
        </button>
      </div>

      <Button
        size={bar ? 'lg' : 'xl'}
        className="w-full"
        disabled={busy || detail.iAmHighest || belowMinimum}
        onClick={() => void submit()}
      >
        {busy ? (
          <Loader2 className="size-5 animate-spin" />
        ) : detail.iAmHighest ? (
          <Crown className="size-5" />
        ) : (
          <TrendingUp className="size-5" />
        )}
        {detail.iAmHighest ? 'أنت أعلى مزايد' : `زايد بـ ${formatAmount(amount)} ريال`}
      </Button>

      {/* الحدّ الأدنى مكتوبٌ دائمًا: من يُنقص المبلغ يعرف أين يقف الحدّ */}
      {!detail.iAmHighest && (
        <p className="flex items-center gap-1.5 text-[11px] text-muted">
          <Gavel className="size-3" />
          أقل مزايدة مقبولة <b className="text-paper">{formatAmount(detail.nextBidAmount)} ريال</b>
        </p>
      )}
    </div>
  )
}
