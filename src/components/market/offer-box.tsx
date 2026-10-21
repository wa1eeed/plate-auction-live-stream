'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Check, HandCoins, Loader2, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { formatAmount, halalasToRiyals } from '@/lib/domain/money'
import {
  OFFER_STATUS_LABELS,
  computeCommissionSide,
  type ListingDetail,
} from '@/lib/domain/types'
import { cn, formatTimestamp } from '@/lib/utils'
import { useSound } from '@/lib/hooks/use-sound'
import { AmountField } from './amount-field'

/**
 * واجهة إرسال العرض — **واحدةٌ للشاشتين**.
 *
 * وكانت اثنتين في فعلٍ واحد: نموذجٌ كاملٌ في جسم الصفحة، وزرٌّ في الشريط
 * الثابت نصُّه «أرسل عرضك» لا يُرسل شيئًا — بل **مرساةٌ** تقفز إلى النموذج
 * (`#trade`). فمن ضغطه على الجوال وجد الصفحةَ تتحرّك تحته ثمّ بحث عن الحقل،
 * ومن مرّر الصفحة وجد نموذجًا ثانيًا فوق الشريط فلم يعرف أيَّهما يُرسل.
 *
 * فصار الحقلُ والزرُّ **في الشريط الثابت وحده** على الجوال، وفي العمود
 * الجانبيّ وحده على الشاشة الكبيرة — وهو مسلكُ المزايدة نفسُه في
 * [`AuctionBidBox`](./auction-bid-box.tsx): واجهةٌ واحدةٌ بصيغتين، لا
 * منطقان لفعلٍ واحد.
 */
export function OfferBox({
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
  const bar = variant === 'bar'
  const { play } = useSound()
  const [amount, setAmount] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)

  /*
   * العمولة تُحسب على ما يكتبه لا على ما يُعرض في الصفحة.
   *
   * السوم مبلغٌ من عنده، فحصيلةُ العمولة المرسلة مع الإعلان محسوبةٌ على أقلّ
   * عرضٍ مقبول ولا تصلح لما يزيد عليه. وتُحسب بالقاعدة المرسلة لا بحصيلةٍ
   * جاهزة — و`computeCommissionSide` دالّةٌ خالصةٌ يستعملها الخادم نفسه،
   * فلا يقع أن يَعِد المعروضُ بغير ما يُقتطع.
   */
  const fee = useMemo(
    () =>
      amount && amount > 0
        ? computeCommissionSide(detail.commission.buyerRule, amount, {
            enabled: detail.commission.vatEnabled,
            percent: detail.commission.vatPercent,
          })
        : null,
    [amount, detail.commission],
  )

  const pending = detail.myOffers.find((offer) => offer.status === 'pending')
  const settled = detail.myOffers.filter((offer) => offer.status !== 'pending')

  const submit = useCallback(async () => {
    if (inFlight.current) return
    if (amount === null || amount <= 0) {
      toast.error('أدخل مبلغًا صحيحًا')
      return
    }
    inFlight.current = true
    setBusy(true)
    try {
      const response = await fetch(`/api/listings/${detail.id}/offers`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ amount: halalasToRiyals(amount), message: message || undefined }),
      })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data?.error?.message ?? 'تعذّر إتمام العملية')
        return
      }
      toast.success('أُرسل عرضك إلى البائع')
      // حفيفُ الذهاب: يُسمع أنّ العرض غادر لا أنّ زرًّا ضُغط
      play('offer-sent')
      setAmount(null)
      setMessage('')
      await onDone()
    } catch {
      toast.error('تعذّر الاتصال — تحقّق من الشبكة وأعد المحاولة')
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }, [amount, detail.id, message, onDone, play])

  const withdraw = useCallback(async () => {
    if (!pending || inFlight.current) return
    inFlight.current = true
    setBusy(true)
    try {
      const response = await fetch(`/api/offers/${pending.id}`, { method: 'DELETE' })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        toast.error(data?.error?.message ?? 'تعذّر سحب العرض')
        return
      }
      toast.success('تم سحب عرضك')
      await onDone()
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }, [onDone, pending])

  if (!isSignedIn) {
    return (
      <Button asChild size="lg" className="w-full">
        <Link href={`/login?next=/market/${detail.id}`}>
          <LogIn className="size-4" />
          سجّل وأرسل عرضك
        </Link>
      </Button>
    )
  }

  /*
   * **وعرضٌ قائمٌ يَسبق الحقل**: لا يُرسل الواحدُ عرضين على لوحةٍ واحدة —
   * الخادم يسحب السابقَ عند وصول اللاحق. فيُقال له ما عنده ويُعطى سحبَه،
   * لا حقلٌ يدعوه إلى ما سيُلغي ما فعله.
   */
  if (pending) {
    return (
      <div className={cn('space-y-2', !bar && 'space-y-3')}>
        <div
          className={cn(
            'rounded-xl border border-gold-600/50 bg-gold-500/10',
            bar ? 'flex items-center justify-between gap-3 px-3 py-2' : 'p-4',
          )}
        >
          <div className="min-w-0">
            <p className="text-xs text-muted">عرضك الحالي</p>
            <p
              className={cn(
                'font-extrabold tabular-nums text-gold-500',
                bar ? 'text-lg' : 'mt-1 text-2xl',
              )}
            >
              {formatAmount(pending.amount)} <span className="text-sm">ريال</span>
            </p>
          </div>
          <p className={cn('text-xs text-muted', bar ? 'shrink-0 text-end' : 'mt-1')}>
            {OFFER_STATUS_LABELS[pending.status]}
            {!bar && ` · ${formatTimestamp(pending.createdAt, detail.serverTime)}`}
          </p>
        </div>
        <Button variant="outline" className="w-full" disabled={busy} onClick={() => void withdraw()}>
          اسحب العرض
        </Button>
      </div>
    )
  }

  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      {/* المبلغ هو القرار، فيُكتب بحجمه لا بحجم أيّ حقلٍ آخر */}
      <AmountField
        label="مبلغ العرض"
        value={amount}
        onChange={setAmount}
        disabled={busy}
        invalid={detail.minimumOffer > 0 && amount !== null && amount < detail.minimumOffer}
        placeholder={detail.minimumOffer > 0 ? formatAmount(detail.minimumOffer) : '0'}
      />
      {detail.minimumOffer > 0 && (
        <p className="text-[11px] text-muted">
          أقل عرض يقبله البائع{' '}
          <span dir="ltr" className="font-bold text-paper">
            {formatAmount(detail.minimumOffer)}
          </span>{' '}
          ريال
        </p>
      )}

      {/*
        * الرسمُ يتبدّل مع الرقم رقمًا رقمًا — ورسمٌ يُكتشف بعد الالتزام
        * يُفسد الثقة أكثر ممّا يجمع.
        *
        * **وفي الشريط سطرٌ واحد**: الإجماليُّ وحده. فشرحُ القاعدة له موضعُه
        * في اللوحة، والشريطُ يقف على ما لا يُستغنى عنه قبل الضغط — وشريطٌ
        * يطول يأكل الشاشةَ التي جاء يخدمها.
        */}
      {fee && fee.total > 0 && (
        <div
          className={cn(
            'rounded-xl border border-ink-600 bg-ink-900/50 text-[11px]',
            bar ? 'px-2.5 py-1.5' : 'space-y-1 p-2.5',
          )}
        >
          {!bar && (
            <p className="flex items-center justify-between gap-3 text-muted">
              <span>
                عمولة المنصّة
                {detail.commission.vatEnabled && ` + ضريبة ${detail.commission.vatPercent}٪`}
              </span>
              <span dir="ltr" className="font-bold tabular-nums text-paper">
                {formatAmount(fee.total)}
              </span>
            </p>
          )}
          <p className="flex items-center justify-between gap-3 font-bold">
            <span className="text-muted">الإجمالي إن قُبل عرضك</span>
            <span dir="ltr" className="tabular-nums text-gold-500">
              {formatAmount((amount ?? 0) + fee.total)} ريال
            </span>
          </p>
          {!bar && (
            <p className="leading-relaxed text-muted">
              تُضاف العمولة وضريبتها على مبلغ عرضك، وتُستحقّ عند قبول البائع — وتُسدَّد معه
              في خطوة واحدة.
            </p>
          )}
        </div>
      )}

      {/*
        * والرسالةُ اختياريّةٌ تبقى في الشريط — **سطرًا لا مربّعًا**.
        *
        * فحذفُها من الجوال يحذفها عن أكثر المستخدمين، و`Textarea` بسطرين
        * يُطيل شريطًا ثابتًا يقف على الشاشة دائمًا.
        */}
      {bar ? (
        <Input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="رسالة للبائع (اختياري)"
          disabled={busy}
          aria-label="رسالة للبائع"
        />
      ) : (
        <Textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={2}
          placeholder="رسالة للبائع (اختياري)"
          disabled={busy}
          aria-label="رسالة للبائع"
        />
      )}

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={busy || amount === null || amount <= 0}
      >
        {busy ? <Loader2 className="size-5 animate-spin" /> : <HandCoins className="size-5" />}
        أرسل العرض
      </Button>

      {!bar && settled.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-ink-700 pt-3 text-xs text-muted">
          {settled.map((offer) => (
            <li key={offer.id} className="flex items-center justify-between gap-2">
              <span className={cn(offer.status === 'accepted' && 'font-bold text-success')}>
                {offer.status === 'accepted' && <Check className="me-1 inline size-3" />}
                {OFFER_STATUS_LABELS[offer.status]}
              </span>
              <span className="tabular-nums">{formatAmount(offer.amount)} ريال</span>
            </li>
          ))}
        </ul>
      )}
    </form>
  )
}
