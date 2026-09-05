'use client'

import { useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Check,
  Clock3,
  HandCoins,
  Loader2,
  LogIn,
  ShoppingCart,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { formatAmount, halalasToRiyals } from '@/lib/domain/money'
import {
  LISTING_STATUS_LABELS,
  OFFER_STATUS_LABELS,
  isClosedListing,
  type ListingDetail,
} from '@/lib/domain/types'
import { cn, formatTimestamp } from '@/lib/utils'
import { useSound } from '@/lib/hooks/use-sound'
import { AuctionBidBox } from './auction-bid-box'
import { CommissionNotice } from './commission-notice'
import { AmountField } from './amount-field'

function randomRequestId() {
  return `req_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

/**
 * لوحة التداول — تتبدّل حسب طريقة البيع:
 * مزايدة، أو شراء مباشر، أو إرسال عرض. كل تحقق حقيقي يقع على الخادم؛
 * ما هنا تعطيل مبكر للأزرار ورسائل أوضح.
 */
export function TradePanel({
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
  const [offerAmount, setOfferAmount] = useState<number | null>(null)
  const [offerMessage, setOfferMessage] = useState('')
  const inFlight = useRef(false)
  const { play } = useSound()

  /**
   * الشراء المباشر ينقل إلى صفحة السداد لا يُنهي الأمر بتنبيه.
   *
   * الطلب يُسجَّل أوّلًا (فتُحجز اللوحة ولا يسبقه غيره)، ثم يُراجع المشتري
   * التفصيل ويختار وسيلته — فلا يجد نفسه مدينًا بمبلغ لم يره.
   */
  const buyNow = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    try {
      const response = await fetch(`/api/listings/${detail.id}/buy`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clientRequestId: randomRequestId() }),
      })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data?.error?.message ?? 'تعذّر إتمام العملية')
        return
      }
      router.push(`/checkout/${data.orderId}`)
    } catch {
      toast.error('تعذّر الاتصال — تحقّق من الشبكة وأعد المحاولة')
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }, [detail.id, router])

  const send = useCallback(
    async (url: string, body: Record<string, unknown>, successMessage?: string) => {
      if (inFlight.current) return false
      inFlight.current = true
      setBusy(true)
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await response.json()
        if (!response.ok) {
          toast.error(data?.error?.message ?? 'تعذّر إتمام العملية')
          return false
        }
        if (successMessage) toast.success(successMessage)
        play('bid')
        if (data.extended) toast.info(`تم تمديد المزاد ${data.addedSeconds} ثانية`)
        await onDone()
        router.refresh()
        return true
      } catch {
        toast.error('تعذّر الاتصال — تحقّق من الشبكة وأعد المحاولة')
        return false
      } finally {
        inFlight.current = false
        setBusy(false)
      }
    },
    [onDone, router, play],
  )

  if (detail.isMine) {
    return (
      <Panel title="هذا إعلانك">
        <p className="text-sm text-muted">
          تابع المزايدات والعروض وأدر الإعلان من صفحة لوحاتي.
        </p>
        <Button asChild variant="secondary" className="mt-3 w-full">
          <Link href="/account/listings">إدارة لوحاتي</Link>
        </Button>
      </Panel>
    )
  }

  if (isClosedListing(detail.status)) {
    return (
      <Panel title="التداول">
        <p className="flex items-center justify-center gap-2 rounded-xl border border-ink-600 bg-ink-900/60 p-4 text-sm text-muted">
          <Clock3 className="size-4" />
          {detail.status === 'sold' && detail.soldToMe
            ? 'رست عليك هذه اللوحة — تابعها من مشترياتي'
            : LISTING_STATUS_LABELS[detail.status]}
        </p>
        {detail.soldToMe && (
          <Button asChild className="mt-3 w-full">
            <Link href="/account/purchases">مشترياتي</Link>
          </Button>
        )}
      </Panel>
    )
  }

  if (!isSignedIn) {
    const cta =
      detail.saleType === 'auction'
        ? `سجّل وزايد بـ ${formatAmount(detail.nextBidAmount)} ريال`
        : detail.saleType === 'fixed'
          ? `سجّل واشترِ بـ ${formatAmount(detail.price)} ريال`
          : 'سجّل وأرسل عرضك'
    return (
      <Panel title="التداول">
        <Button asChild size="xl" className="w-full">
          <Link href={`/login?next=/market/${detail.id}`}>
            <LogIn className="size-5" />
            {cta}
          </Link>
        </Button>
        <p className="mt-2 text-center text-xs text-muted">
          التصفّح مفتوح للجميع — الحساب مطلوب للتداول فقط.
        </p>
      </Panel>
    )
  }

  // ------------------------------------------------------------- مزاد
  if (detail.saleType === 'auction') {
    /*
     * تُخفى دون `lg`: شريط الجوال الثابت يحمل الواجهة نفسها.
     *
     * كانتا معًا على الشاشة الضيّقة — لوحةٌ في المتن وشريطٌ أسفلها — بمنطقين
     * مختلفين لفعلٍ واحد. فيقرأ المزايد واجهتين ويسأل أيّهما الحقيقيّة.
     */
    return (
      <div className="hidden lg:block">
        <Panel title="المزايدة">
          <AuctionBidBox detail={detail} isSignedIn={isSignedIn} onDone={onDone} />
        </Panel>
      </div>
    )
  }

  // ------------------------------------------------------------- بيع مباشر
  if (detail.saleType === 'fixed') {
    return (
      <Panel title="الشراء">
        <CommissionNotice detail={detail} />
        <Button
          size="xl"
          className="w-full"
          disabled={busy}
          onClick={() => void buyNow()}
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : <ShoppingCart className="size-5" />}
          اشترِ الآن بـ {formatAmount(detail.price)} ريال
        </Button>
        <p className="mt-2 text-center text-xs leading-relaxed text-muted">
          ننتقل بك إلى صفحة السداد لمراجعة التفاصيل واختيار وسيلة الدفع — لا يُخصم شيء قبل
          تأكيدك.
        </p>
      </Panel>
    )
  }

  // ------------------------------------------------------------- استقبال عروض
  const pending = detail.myOffers.find((offer) => offer.status === 'pending')
  return (
    <Panel title="إرسال عرض" id="trade">
      <CommissionNotice detail={detail} />
      {pending ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-gold-600/50 bg-gold-500/10 p-4">
            <p className="text-xs text-muted">عرضك الحالي</p>
            <p className="mt-1 text-2xl font-extrabold text-gold-500 tabular-nums">
              {formatAmount(pending.amount)} <span className="text-sm">ريال</span>
            </p>
            <p className="mt-1 text-xs text-muted">
              {OFFER_STATUS_LABELS[pending.status]} · {formatTimestamp(pending.createdAt, detail.serverTime)}
            </p>
          </div>
          <Button
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={async () => {
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
                router.refresh()
              } finally {
                setBusy(false)
              }
            }}
          >
            اسحب العرض
          </Button>
        </div>
      ) : (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (offerAmount === null || offerAmount <= 0) {
              toast.error('أدخل مبلغًا صحيحًا')
              return
            }
            void send(
              `/api/listings/${detail.id}/offers`,
              { amount: halalasToRiyals(offerAmount), message: offerMessage || undefined },
              'أُرسل عرضك إلى البائع',
            ).then((okResult) => {
              if (okResult) {
                // حفيفُ الذهاب: يُسمع أنّ العرض غادر لا أنّ زرًّا ضُغط
                play('offer-sent')
                setOfferAmount(null)
                setOfferMessage('')
              }
            })
          }}
        >
          {/* المبلغ هو القرار، فيُكتب بحجمه لا بحجم أيّ حقلٍ آخر */}
          <AmountField
            label="مبلغ العرض"
            value={offerAmount}
            onChange={setOfferAmount}
            disabled={busy}
            invalid={detail.minimumOffer > 0 && offerAmount !== null && offerAmount < detail.minimumOffer}
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
          <Textarea
            value={offerMessage}
            onChange={(event) => setOfferMessage(event.target.value)}
            rows={2}
            placeholder="رسالة للبائع (اختياري)"
            disabled={busy}
            aria-label="رسالة للبائع"
          />
          <Button type="submit" size="lg" className="w-full" disabled={busy || offerAmount === null || offerAmount <= 0}>
            {busy ? <Loader2 className="size-5 animate-spin" /> : <HandCoins className="size-5" />}
            أرسل العرض
          </Button>
        </form>
      )}

      {detail.myOffers.filter((offer) => offer.status !== 'pending').length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-ink-700 pt-3 text-xs text-muted">
          {detail.myOffers
            .filter((offer) => offer.status !== 'pending')
            .map((offer) => (
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
    </Panel>
  )
}

function Panel({
  title,
  id,
  children,
}: {
  title: string
  /** مرساة يقفز إليها شريط الجوال */
  id?: string
  children: React.ReactNode
}) {
  return (
    /*
     * لا التصاق على الجوال: أسفل الشاشة مِلكُ الشريط الثابت (z-40) وهو أطول
     * من هذه اللوحة، فكانت تُقصّ تحته ويُحجب بيان العربون طوال التمرير —
     * ويهبط عليها رابط «أرسل عرضك» فلا يرى صاحبه ما قفز إليه.
     */
    <section id={id} className="scroll-mt-24 rounded-2xl border border-ink-600 bg-ink-800 p-4">
      <h2 className="mb-3 text-sm font-bold">{title}</h2>
      {children}
    </section>
  )
}
