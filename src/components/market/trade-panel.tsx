'use client'

import { useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, Clock3, Loader2, LogIn, Receipt, ShieldCheck, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatAmount } from '@/lib/domain/money'
import {
  LISTING_STATUS_LABELS,
  OFFER_STATUS_LABELS,
  isClosedListing,
  type ListingDetail,
} from '@/lib/domain/types'
import { cn } from '@/lib/utils'
import { muteNextSoldToast } from '@/lib/sold-announcement'
import { AuctionBidBox } from './auction-bid-box'
import { OfferBox } from './offer-box'
import { CommissionNotice } from './commission-notice'

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
  const inFlight = useRef(false)

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
    /*
     * **يُكتم قبل الطلب لا بعده.**
     *
     * فالخادم يبثّ `listing_sold` في أثناء معالجة الطلب، والمقبسُ يُسلّمه
     * إلى هذا التبويب قد يسبق وصولَ الردّ. فكتمٌ بعد `await` سباقٌ يُخسر
     * على وصلةٍ سريعة — وقد ظهرت النافذةُ للمشتري فعلًا.
     *
     * وعلامةٌ تُترك بلا شراءٍ يقع لا تضرّ: تنقضي بعد عشرين ثانية، ولا تكتم
     * في مدّتها إلّا بيعَ هذه اللوحة بعينها — وهو ما كان المشتري سيفعله.
     */
    muteNextSoldToast(detail.id)
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
        {/*
          * **ولا يُعاد السعرُ هنا.**
          *
          * فبطاقةُ «سعر البيع» فوق هذه اللوحة تحمله بحجمه، وشريطُ الجوال
          * يحمله في زرّه. فثالثٌ في المنتصف يُقرأ سعرًا آخر لا تأكيدًا —
          * جُرّب فخرجت ثلاثةُ أرقامٍ متطابقةٍ على شاشةٍ واحدة.
          *
          * فما يبقى لهذه اللوحة ما لا يقوله غيرُها: ما تُؤخذ عليه عمولةً،
          * وما يقع بعد الضغطة.
          */}
        <CommissionNotice detail={detail} />

        {/*
          * **والزرُّ للحاسوب وحده.**
          *
          * فشريطُ الجوال الثابت (`MobileBidBar`، وهو `lg:hidden`) يحمل زرَّ
          * الشراء بسعره — فكان الزرّان معًا على شاشةٍ واحدة، أحدُهما يلاحق
          * التمرير والآخرُ يسكن في اللوحة. وهو تكرارٌ يُربك: أيُّهما يشتري؟
          * فبقي في الجوّال ما لا يغيب عن الإبهام، وبقي في الحاسوب ما في
          * موضعه — ولا شاشةَ فيها اثنان.
          */}
        <Button
          size="xl"
          className="mt-3 hidden w-full lg:inline-flex"
          disabled={busy}
          onClick={() => void buyNow()}
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : <ShoppingCart className="size-5" />}
          اشترِ الآن
        </Button>

        <ul className="mt-3 space-y-1.5 text-[11px] leading-relaxed text-muted">
          <li className="flex items-start gap-1.5">
            <ShieldCheck className="mt-px size-3.5 shrink-0 text-success" />
            <span>
              مالُك محفوظٌ لدى المنصّة حتى <b className="text-paper">تنتقل اللوحة باسمك</b>.
            </span>
          </li>
          <li className="flex items-start gap-1.5">
            <Receipt className="mt-px size-3.5 shrink-0 text-muted" />
            <span>
              ننتقل بك إلى صفحة السداد لمراجعة التفاصيل واختيار وسيلتك —{' '}
              <b className="text-paper">لا يُخصم شيء قبل تأكيدك</b>.
            </span>
          </li>
        </ul>
      </Panel>
    )
  }

  /*
   * ------------------------------------------------------------- استقبال عروض
   *
   * **والحقلُ والزرُّ في موضعٍ واحدٍ لكلّ شاشة.**
   *
   * فكان النموذجُ كاملًا في جسم الصفحة، وفي الشريط الثابت زرٌّ نصُّه «أرسل
   * عرضك» لا يُرسل — مرساةٌ تقفز إلى النموذج. فمن ضغطه وجد الصفحةَ تتحرّك
   * ثمّ بحث عن الحقل، ومن مرّر وجد النموذجَ فوق الشريط فلم يعرف أيَّهما
   * يُرسل.
   *
   * فصار في الجوال في الشريط وحده (`MobileBidBar`)، وفي الشاشة الكبيرة في
   * هذه اللوحة وحدها — و`hidden lg:block` هي التي تحصره. وما يبقى للجوال
   * هنا قاعدةُ العمولة وسجلُّ عروضه: خبرٌ يُقرأ، لا فعلٌ يُكرَّر.
   */
  const settledOffers = detail.myOffers.filter((offer) => offer.status !== 'pending')

  return (
    <>
      {/*
        * اللوحةُ للحاسوب: فيها القاعدةُ والنموذجُ وسجلُّ العروض.
        *
        * **ولا تُصيَّر على الجوال**: نموذجُها انتقل إلى الشريط، فتبقى صندوقًا
        * بعنوانٍ «إرسال عرض» لا شيءَ تحته — عنوانٌ يَعِد بفعلٍ ليس فيه.
        */}
      <div className="hidden lg:block">
        <Panel title="إرسال عرض">
          {/* القاعدة هنا، والمبلغ أسفل الحقل — سؤالان لا رقمان متضاربان */}
          <CommissionNotice detail={detail} asRule />
          <OfferBox detail={detail} isSignedIn={isSignedIn} onDone={onDone} />
          <SettledOffers offers={settledOffers} />
        </Panel>
      </div>

      {/*
        * وعلى الجوال سجلُّ ما مضى وحده — **وباسمه لا باسم النموذج**.
        *
        * فهو خبرٌ لا فعل: من رُفض عرضُه يحتاج أن يعرف، ولو غاب مع النموذج
        * لَمَا عرف. ولا يُصيَّر إن كان فارغًا: صندوقٌ بعنوانٍ بلا مضمون.
        */}
      {settledOffers.length > 0 && (
        <div className="lg:hidden">
          <Panel title="عروضك السابقة">
            <SettledOffers offers={settledOffers} bare />
          </Panel>
        </div>
      )}
    </>
  )
}

function SettledOffers({
  offers,
  bare = false,
}: {
  offers: ListingDetail['myOffers']
  /** بلا خطٍّ فاصلٍ ولا هامشٍ علويّ — حين يكون وحدَه في لوحته */
  bare?: boolean
}) {
  if (offers.length === 0) return null
  return (
    <ul
      className={cn(
        'space-y-1.5 text-xs text-muted',
        !bare && 'mt-3 border-t border-ink-700 pt-3',
      )}
    >
      {offers.map((offer) => (
        <li key={offer.id} className="flex items-center justify-between gap-2">
          <span className={cn(offer.status === 'accepted' && 'font-bold text-success')}>
            {offer.status === 'accepted' && <Check className="me-1 inline size-3" />}
            {OFFER_STATUS_LABELS[offer.status]}
          </span>
          <span className="tabular-nums">{formatAmount(offer.amount)} ريال</span>
        </li>
      ))}
    </ul>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    /*
     * لا التصاق على الجوال: أسفل الشاشة مِلكُ الشريط الثابت (z-40) وهو أطول
     * من هذه اللوحة، فكانت تُقصّ تحته ويُحجب بيان العربون طوال التمرير.
     *
     * **ولا مرساةَ فيها بعد اليوم**: كان شريطُ الجوال يقفز إلى `#trade`،
     * فصار يحمل الحقلَ والزرَّ نفسَه — فلا قافزَ ولا مقفولٌ إليه.
     */
    <section className="rounded-2xl border border-ink-600 bg-ink-800 p-4">
      <h2 className="mb-3 text-sm font-bold">{title}</h2>
      {children}
    </section>
  )
}
