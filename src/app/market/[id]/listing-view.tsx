'use client'

import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Award,
  ChevronsLeft,
  Clock3,
  Crown,
  Gavel,
  HandCoins,
  Share2,
  Tag,
} from 'lucide-react'
import { SaudiLicensePlate } from '@/components/plate/SaudiLicensePlate'
import { TradePanel } from '@/components/market/trade-panel'
import { MobileBidBar } from '@/components/market/mobile-bid-bar'
import { FaqList } from '@/components/market/faq-list'
import { LocalTime, LocalZoneNote } from '@/components/market/local-time'
import { Badge } from '@/components/ui/badge'
import { OwnerTag } from '@/components/market/listing-card'
import { OverdueTag } from '@/components/market/overdue-tag'
import { formatAmount } from '@/lib/domain/money'
import {
  LISTING_STATUS_LABELS,
  listingOutcomeLabel,
  PLATE_TYPE_LABELS,
  SALE_TYPE_LABELS,
  isClosedListing,
  type FaqItem,
  type ListingDetail,
} from '@/lib/domain/types'
import { REFERENCE_LABELS } from '@/lib/domain/reference'
import { ReferenceChip } from '@/components/market/reference-chip'
import { AuctionStage } from '@/components/market/auction-stage'
import { useListing } from '@/lib/hooks/use-listing'
import { cn } from '@/lib/utils'

export function ListingView({
  faq,
  initialDetail,
  isSignedIn,
  backTo = { href: '/market', label: 'السوق' },
}: {
  faq: FaqItem[]
  initialDetail: ListingDetail
  isSignedIn: boolean
  /** من أين جاء الزائر — إليه يعود، لا إلى السوق دائمًا */
  backTo?: { href: string; label: string }
}) {
  const { detail, status, refetch, viewers } = useListing(initialDetail.id, initialDetail)
  const closed = isClosedListing(detail.status)
  // الشريط الثابت يظهر للزائر غير المالك على إعلان ما زال مفتوحًا
  const showMobileBar = !detail.isMine && !closed
  const isLiveAuction = detail.saleType === 'auction' && detail.status === 'active'

  const share = async () => {
    const url = window.location.href
    const title = `لوحة ${detail.plate.arabicLetters} ${detail.plate.plateNumbers}`
    try {
      if (navigator.share) {
        await navigator.share({ title, url })
        return
      }
      await navigator.clipboard.writeText(url)
      toast.success('تم نسخ رابط اللوحة')
    } catch {
      // ألغى المستخدم المشاركة
    }
  }

  return (
    <main id="main"
      className={cn(
        'mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8',
        // مساحة سفلية بقدر الشريط الثابت نفسه — يقيس نفسه ويكتبها
        showMobileBar && 'pb-[calc(var(--bid-bar-h,13rem)+1.5rem)] lg:pb-8',
      )}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        {/*
          * رابط الرجوع للويب وحده.
          *
          * وفي الغلاف الأصيل زرُّ رجوعٍ في الهيدر وزرُّ جهازٍ في أندرويد —
          * فثلاثة مخارجَ لفعلٍ واحد تزدحم ولا تُفيد، والأعلى منها (الهيدر)
          * هو الموضع الذي تعوّده مستخدم التطبيقات.
          */}
        <Link
          href={backTo.href}
          data-web-only
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-paper"
        >
          <ChevronsLeft className="size-4 rtl:rotate-180" />
          {backTo.label}
        </Link>
        {/* البثّ والمشاهدون في المسرح نفسه — حيث يُقرآن مع ما يصفانه */}
        {/*
          * **وشارةُ الرأس تقول نتيجةَ الجولة لا اسمَ الحالة.**
          *
          * و`LISTING_STATUS_LABELS` أسماءٌ خام: `sold` فيها «مُباع» — فكانت
          * تُعلن البيعَ فوق صفحةٍ يقول خبرُها تحتها «بانتظار الدفع»، وتقول
          * «مُباع» على مزادٍ خبرُه «تمت الترسية». **خبران في شاشة.**
          *
          * فصارت تقرأ من `closingView` نفسِه الذي يبني الخاتمة تحتها —
          * مصدرٌ واحدٌ لا ينحرف أحدُ طرفيه عن الآخر.
          */}
        {!isLiveAuction && closingView(detail) && (
          <Badge variant={CLOSING_BADGE[closingView(detail)!.tone]}>
            {closingView(detail)!.outcome}
          </Badge>
        )}
      </div>

      {/*
       * الترتيب على الجوال: اللوحة ثم **السعر مباشرة** ثم بقيّة التفاصيل.
       * الصفحة تُبثّ وتُشارَك من الجوال، فيجب أن تُقرأ اللوحة وسعرها في أوّل
       * شاشة بلا تمرير — ولو بقي السعر أسفل الوصف والبائع لخرج من الكادر.
       * وعلى الحاسوب يعود العمودان كما كانا بترتيب صريح للصفوف. وصفّ اللوحة
       * `min-content`: عمود السعر يمتدّ على الصفّين، ولولا تقييد الصفّ الأول
       * بمحتواه لوزّع المتصفّح ارتفاعه الطويل على الصفّين فتفتح فجوة تحت اللوحة.
       */}
      {/*
        * `min-w-0` على كلّ عمود — وإلّا فاض الجوال.
        *
        * عنصر الشبكة `min-width: auto` افتراضًا، فلا ينكمش دون **عرض محتواه
        * الأدنى**. وسطرٌ واحد لا ينكسر في كشف المزايدات يرفع العمود إلى ٣٧٦
        * بكسل داخل حاوية ٣٤٣ — فيمتدّ المستند ويظهر تمريرٌ أفقيّ.
        *
        * ولا يُرى على ماك لأنّ شريط التمرير يطفو، ويُرى على لينكس حيث يأخذ
        * عرضًا من الصفحة.
        */}
      <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr] lg:grid-rows-[min-content_1fr] lg:items-start">
        {/* ------------------------------------------------ اللوحة */}
        <div className="order-1 min-w-0 space-y-4 lg:col-start-1 lg:row-start-1">
          {/*
            * منصّة عرض لا صندوق.
            *
            * اللوحة هي المَبيع، وصفحتها أوّل ما يُرى منها. فتُعرض على سطح
            * متدرّج بتوهّج ذهبي خافت خلفها وظلٍّ تحتها — كما تُعرض قطعة في
            * صالة، لا كما تُصفّ صورة في جدول. والتوهّج بـ`background` فلا
            * يكلّف طبقةً ولا يمسّ التخطيط.
            */}
          <div className="glow relative overflow-hidden rounded-2xl border border-ink-600 bg-gradient-to-b from-ink-700/60 to-ink-800 p-5 sm:p-7">
            <div className="drop-shadow-[0_14px_28px_rgba(15,23,42,0.18)]">
              <SaudiLicensePlate
                plateType={detail.plate.plateType}
                plateFormat={detail.plate.plateFormat}
                arabicLetters={detail.plate.arabicLetters}
                latinLetters={detail.plate.latinLetters}
                plateNumbers={detail.plate.plateNumbers}
                emblem={detail.plate.emblem}
                customEmblemUrl={detail.plate.customEmblemUrl}
                size="fullscreen"
                animated={isLiveAuction}
              />
            </div>
          </div>
        </div>

        {/* -------------------------------------- بقيّة تفاصيل اللوحة */}
        <div className="order-3 min-w-0 space-y-4 lg:order-none lg:col-start-1 lg:row-start-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={detail.saleType === 'fixed' ? 'success' : 'gold'}>
              {detail.saleType === 'auction' ? (
                <Gavel className="size-3" />
              ) : detail.saleType === 'fixed' ? (
                <Tag className="size-3" />
              ) : (
                <HandCoins className="size-3" />
              )}
              {SALE_TYPE_LABELS[detail.saleType]}
            </Badge>
            <Badge variant="muted">{PLATE_TYPE_LABELS[detail.plate.plateType]}</Badge>
            {/* الوسم نفسه الذي في كعب البطاقة — لفظًا واحدًا لمعنًى واحد */}
            {detail.isMine && <OwnerTag />}
            {/*
              * **ولا نتيجةَ هنا — قيلت مرّتين فوقه.**
              *
              * فشارةُ الرأس تُقرأ بالمسح من أعلى، والخاتمةُ تحتها تُقرأ
              * بالقصد. وثالثةٌ في صفٍّ يصف **اللوحة** — طريقتَها ونوعَها
              * ورقمَها — تُقحم خبرًا بين أوصافٍ، فيصير اللفظُ نفسُه ثلاثًا
              * في شاشةٍ واحدة. وتكرارٌ بهذا القدر يُفقد اللفظَ وزنَه.
              */}
            <ReferenceChip reference={detail.reference} />

            <button
              type="button"
              onClick={share}
              className="ms-auto inline-flex items-center gap-1.5 rounded-full border border-ink-600 bg-ink-900/60 px-2.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:text-paper"
            >
              <Share2 className="size-3.5" />
              مشاركة
            </button>
          </div>

          {/*
            * **ولا صندوقَ صفقةٍ هنا.**
            *
            * كان في صفحة اللوحة مربّعٌ يعرض صفقةَ صاحبها — مرحلتَها وسكّتَها
            * وأفعالَها. وصفحةُ اللوحة صفحةُ **سلعةٍ تُعرض**، يقرؤها الغريب
            * والطرفان معًا؛ فصندوقُ صفقةٍ فيها يخلط سجلًّا خاصًّا بعرضٍ عامّ،
            * ويُكرّر ما في صفحة الصفقة كاملًا.
            *
            * وموضعُ السجلّ «المعاملات المكتملة» في مشترياتي ومبيعاتي: فيها
            * المرجعُ والتفصيلُ وسببُ عدم الاكتمال — انظر `OrderTabs`.
            */}

          {detail.description && (
            <p className="rounded-xl border border-ink-600 bg-ink-800 p-4 text-sm leading-relaxed text-muted">
              {detail.description}
            </p>
          )}

          {/*
            * الكشف تحت اللوحة لا في عمود التداول.
            *
            * اسم البائع كان يشغل هذا الموضع، ولا يُقرَّر به شراء لوحة — رقمها
            * وحالها وسجلّ منافستها هو ما يُقرَّر به. وكان الكشف في العمود
            * الآخر يزاحم المزايدة نفسها ويدفعها إلى أسفل، والعمود هنا ينتهي
            * بفراغٍ طويل تحت الوصف.
            *
            * فانتقل إلى الفراغ: يُقرأ مع اللوحة التي يخصّها، ويُخلي لصندوق
            * المزايدة عموده.
            */}
          {detail.saleType === 'auction' && <BidLedger detail={detail} />}
        </div>

        {/* ------------------------------------------------ السعر والتداول */}
        <div className="order-2 min-w-0 space-y-4 lg:order-none lg:col-start-2 lg:row-start-1 lg:row-span-2">
          {/*
            * مزادٌ جارٍ له مسرحه، وما عداه بطاقة نتيجة.
            *
            * الحيّ يحتاج حياةً تُرى: بثًّا ونبضًا وزمنًا يجري. والمغلق يحتاج
            * خبرًا واحدًا ساكنًا — وخلطهما في تصميمٍ واحد يُعطي المنتهي حركةً
            * لا معنى لها، ويُعطي الجاري سكونَ ما انتهى.
            */}
          {isLiveAuction ? (
            <AuctionStage detail={detail} status={status} viewers={viewers} />
          ) : (
            <ClosedSummary detail={detail} />
          )}

          <TradePanel detail={detail} isSignedIn={isSignedIn} onDone={refetch} />

          <dl className="grid grid-cols-2 gap-3 rounded-2xl border border-ink-600 bg-ink-800 p-4 sm:grid-cols-3">
            {detail.saleType === 'auction' && (
              <>
                <Field label="السعر الافتتاحي" value={`${formatAmount(detail.startingPrice)} ريال`} />
                <Field label="الحد الأدنى للزيادة" value={`${formatAmount(detail.minimumIncrement)} ريال`} />
                <Field
                  label="التمديد التلقائي"
                  value={
                    detail.extensionTriggerSeconds > 0
                      ? `${detail.extensionDurationSeconds / 60} د عند مزايدة في آخر ${detail.extensionTriggerSeconds / 60} د`
                      : 'معطّل'
                  }
                />
              </>
            )}
            {detail.saleType === 'offers' && detail.minimumOffer > 0 && (
              <Field label="أقل عرض مقبول" value={`${formatAmount(detail.minimumOffer)} ريال`} />
            )}
            {detail.depositAmount > 0 && (
              <>
                <Field label="العربون المطلوب" value={`${formatAmount(detail.depositAmount)} ريال`} />
                <Field label="مهلة سداد الفائز" value={`${detail.paymentWindowHours} ساعة`} />
              </>
            )}
            {/*
              * العمولة تُفصَّل: أساسُها وضريبتها ومجموعهما.
              *
              * كان السطر يجمعها في رقمٍ واحد تحت عنوانٍ يسمّي العمولة وحدها —
              * فمن ضبطها ألفًا قرأ «١٬١٥٠» وظنّ أنّ ضبطه لم يُحترم، والمئة
              * والخمسون ضريبةٌ لا زيادةٌ في العمولة. والتفصيل يقول ذلك بلا
              * أن يُحسب.
              */}
            {detail.commission.buyer.total > 0 && (
              <FieldNode
                label={`عمولة المنصّة على المشتري${detail.saleType === 'auction' ? ' (على السعر الحالي)' : ''}`}
                value={<CommissionValue breakdown={detail.commission.buyer} vatPercent={detail.commission.vatPercent} />}
              />
            )}
            {detail.isMine && detail.commission.seller.total > 0 && (
              <FieldNode
                label={`عمولة المنصّة عليك كبائع${detail.saleType === 'auction' ? ' (على السعر الحالي)' : ''}`}
                value={<CommissionValue breakdown={detail.commission.seller} vatPercent={detail.commission.vatPercent} />}
              />
            )}
            <Field label={REFERENCE_LABELS.listing} value={detail.reference} />
            <FieldNode label="نُشر" value={<LocalTime iso={detail.startsAt} mode="datetime" />} />
            <Field label="المشاهدات" value={String(detail.viewCount)} />
          </dl>
        </div>
      </div>

      {/*
        * الأسئلة في ذيل الصفحة لا في عمود التداول.
        *
        * على الجوال ينهار العمودان إلى عمود واحد بترتيبهما، فكانت الأسئلة —
        * وهي ذيل عمود التداول — تسبق كشف المزايدات: يقرأ الزائر «هل يُعاد
        * العربون؟» قبل أن يرى من زايد وبكم. والكشف هو ما يُتابَع لحظةً بلحظة،
        * والأسئلة مرجعٌ يُقصد عند الحاجة — فمكانه الذيل في الشاشتين معًا.
        */}
      {faq.length > 0 && (
        <section aria-labelledby="listing-faq" className="mt-8">
          <h2 id="listing-faq" className="mb-3 text-sm font-bold">
            أسئلة شائعة قبل المزايدة
          </h2>
          <FaqList items={faq} showCategory={false} />
          <p className="mt-3 text-center text-xs text-muted">
            <Link href="/faq" className="font-semibold text-gold-500 hover:underline">
              كل الأسئلة الشائعة
            </Link>
          </p>
        </section>
      )}

      <MobileBidBar detail={detail} isSignedIn={isSignedIn} onDone={refetch} />
    </main>
  )
}

/**
 * ما ليس مزادًا جاريًا: خبرٌ واحد ساكن.
 *
 * بيعٌ مباشر بسعره، أو استقبال عروض بحدّه الأدنى، أو جولةٌ انتهت بنتيجتها.
 * ولا عدّاد ولا نبض: ما لا يتحرّك لا يُعطى واجهة ما يتحرّك.
 */
/**
 * **خاتمةُ اللوحة — عنوانٌ يُقرأ من بعيد، ونتيجةٌ تحته، ثمّ الرقم.**
 *
 * وثلاثُ طبقاتٍ ثابتةٍ مهما اختلف ما وقع:
 *
 * 1. **ما جرى** بخطٍّ عريض: «انتهى المزاد» · «محجوزة» · «بِيعت اللوحة».
 * 2. **نتيجتُه** في شارةٍ ملوّنة: «تمت الترسية» · «لم يحقق سعر البيع» ·
 *    «بانتظار سداد المشتري». فالأوّلُ يقول إنّ البابَ أُغلق، والثاني يقول
 *    كيف أُغلق — وهما سؤالان يُسألان معًا ويُجابان في سطرين لا في جملةٍ
 *    واحدةٍ تحمل الاثنين فتطول ولا تُقرأ.
 * 3. **الرقمُ وتسميتُه**: «رست عند» غير «أعلى مزايدة» غير «السعر الافتتاحي»
 *    — ورقمٌ بلا اسمٍ على لوحةٍ انتهت يُقرأ ثمنًا وقع، وقد لا يكون وقع.
 *
 * **والمزادُ لا يُحجز**: نهايتُه معلنةٌ بوقتها، وخبرُها يُقال مرّةً.
 * و«محجوزة» للبيع المباشر واستقبال العروض وحدهما — انظر `awaitingSettlement`.
 */
type ClosingTone = 'success' | 'gold' | 'muted'

function closingView(detail: ListingDetail): {
  tone: ClosingTone
  icon: typeof Award
  headline: string
  outcome: string
  amountLabel: string
  amount: number
  note?: string
} | null {
  const auction = detail.saleType === 'auction'

  if (detail.status === 'sold') {
    /*
     * **«محجوزة» قبل السداد، و«بِيعت» بعده.**
     *
     * وحالةُ `sold` تقع لحظةَ الطلب: يبقى السدادُ في مهلته. فكان يُقال
     * «بِيعت» — ويقرؤها **المشتري نفسُه** وهو في طريقه إلى الدفع فيظنّ
     * أنّه دفع. وإن انقضت المهلةُ بلا سدادٍ عادت اللوحة إلى السوق.
     */
    if (detail.settlementPending) {
      return {
        tone: 'gold',
        icon: Clock3,
        headline: 'محجوزة',
        outcome: 'بانتظار سداد المشتري',
        amountLabel: detail.saleType === 'offers' ? 'قُبل العرض عند' : 'سعر البيع',
        amount: detail.soldAmount,
        note: 'لم يصل المال بعد — وإن لم يُسدَّد في مهلته عادت اللوحةُ إلى السوق.',
      }
    }
    return {
      tone: 'success',
      icon: Award,
      headline: auction ? 'انتهى المزاد' : 'بِيعت اللوحة',
      outcome: auction ? 'تمت الترسية' : 'تمّت الصفقة',
      amountLabel: auction ? 'رست عند' : 'بِيعت بـ',
      amount: detail.soldAmount,
    }
  }

  /* انتهت الجولةُ دون بيع — والسببُ هو الخبر، لا انتهاؤها */
  if (detail.status === 'reserve_not_met') {
    return {
      tone: 'muted',
      icon: Gavel,
      headline: 'انتهى المزاد',
      outcome: 'لم يحقق سعر البيع',
      amountLabel: 'أعلى مزايدة',
      amount: detail.highestAmount ?? detail.startingPrice,
      note: 'لم تبلغ المزايداتُ السعرَ الاحتياطيّ الذي حدّده البائع، فلم تُرسَ اللوحة.',
    }
  }

  if (detail.status === 'no_bids') {
    return {
      tone: 'muted',
      icon: Gavel,
      headline: 'انتهى المزاد',
      outcome: 'لم تصل أيّ مزايدة',
      amountLabel: 'السعر الافتتاحي',
      amount: detail.startingPrice,
    }
  }

  if (detail.status === 'cancelled' || detail.status === 'suspended') {
    return {
      tone: 'muted',
      icon: Gavel,
      headline: detail.status === 'cancelled' ? 'أُلغي العرض' : 'أوقفته الإدارة',
      outcome: listingOutcomeLabel(detail.status, detail.saleType) ?? LISTING_STATUS_LABELS[detail.status],
      amountLabel: auction ? 'أعلى مزايدة' : 'السعر المعروض',
      amount: auction ? (detail.highestAmount ?? detail.startingPrice) : detail.price,
    }
  }

  return null
}

/** نغمةُ الشارة في الرأس — تتبع نغمةَ الخاتمة فلا يفترق وصفان لحالٍ واحدة */
const CLOSING_BADGE: Record<ClosingTone, 'success' | 'gold' | 'muted'> = {
  success: 'success',
  gold: 'gold',
  muted: 'muted',
}

const CLOSING_SKIN: Record<ClosingTone, { box: string; icon: string; chip: string }> = {
  success: {
    box: 'border-success/55 bg-success-soft',
    icon: 'text-success',
    chip: 'border-success/45 bg-success/12 text-success',
  },
  gold: {
    box: 'border-gold-600/60 bg-gold-500/[0.07]',
    icon: 'text-gold-500',
    chip: 'border-gold-600/45 bg-gold-500/12 text-gold-400',
  },
  muted: {
    box: 'border-ink-600 bg-ink-800',
    icon: 'text-muted',
    chip: 'border-ink-600 bg-ink-900/60 text-muted',
  },
}

function ClosedSummary({ detail }: { detail: ListingDetail }) {
  const view = closingView(detail)
  if (view) {
    const skin = CLOSING_SKIN[view.tone]
    const Icon = view.icon
    return (
      <div className={cn('overflow-hidden rounded-2xl border text-center', skin.box)}>
        <div className="px-5 pt-5">
          <Icon className={cn('mx-auto mb-2.5 size-9', skin.icon)} />
          {/* ما جرى — أعرضُ خطٍّ في الصفحة، يُقرأ قبل أيّ رقم */}
          <p className="text-xl font-extrabold leading-tight sm:text-2xl">{view.headline}</p>
          {/* وكيف جرى — شارةٌ لا جملة: تُمسح بالعين ولا تُقرأ سطرًا */}
          <p
            className={cn(
              'mx-auto mt-2 inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold',
              skin.chip,
            )}
          >
            {view.outcome}
          </p>
        </div>

        {/*
          * والرقمُ في قاعٍ مستقلّ — باسمه فوقه.
          *
          * فرقمٌ عارٍ على لوحةٍ انتهت يُقرأ ثمنًا وقع، و«أعلى مزايدة» على
          * مزادٍ لم يبلغ سعرَه ليست ثمنًا. والفصلُ بخلفيّةٍ أغمق يجعل
          * الخبرَ طبقةً والرقمَ طبقة.
          */}
        <div className="mt-4 border-t border-inherit bg-ink-950/15 px-5 py-3.5">
          <p className="text-[11px] font-semibold text-muted">{view.amountLabel}</p>
          <p className="mt-0.5 text-3xl font-extrabold leading-none tabular-nums text-gold-500">
            {formatAmount(view.amount)}
            <span className="ms-1.5 text-sm font-bold">ريال</span>
          </p>
        </div>

        {view.note && (
          <p className="border-t border-inherit px-5 py-3 text-[11px] leading-relaxed text-muted">
            {view.note}
          </p>
        )}
      </div>
    )
  }

  const done = isClosedListing(detail.status)
  const { label, value } = done
    ? { label: 'انتهت الجولة عند', value: detail.highestAmount ?? detail.startingPrice }
    : detail.saleType === 'fixed'
      ? { label: 'سعر البيع', value: detail.price }
      : detail.saleType === 'offers'
        ? { label: 'أقل عرض مقبول', value: detail.minimumOffer }
        : { label: 'السعر الافتتاحي', value: detail.startingPrice }

  return (
    <div
      className={cn(
        'rounded-2xl border p-5',
        done ? 'border-ink-600 bg-ink-800' : 'border-gold-600/50 bg-gold-500/8',
      )}
    >
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p
        className={cn(
          'mt-1 text-4xl font-extrabold leading-none tabular-nums',
          done ? 'text-muted' : 'text-gold-500',
        )}
      >
        {formatAmount(value)}
        <span className="ms-2 text-sm font-bold">ريال</span>
      </p>
      {/*
        * ما يدفعه المشتري فعلًا، حيث يقرأ السعر لا في ذيل التفاصيل.
        *
        * العمولة كانت سطرًا في قائمة أسفل الصفحة، فيقرأ من يشتري مباشرةً
        * «28,000» ويضغط «اشترِ الآن» ثمّ يجد في صفحة السداد رقمًا أكبر —
        * ورسمٌ يُكتشف بعد الالتزام يُفسد الثقة أكثر ممّا يجمع. والمبلغ هنا
        * معلوم قبل الضغط لأنّ السعر ثابت؛ وفي المزاد لا يُعلم حتى تُعرف
        * المزايدة الفائزة، فيبقى في التفاصيل.
        */}
      {!done && detail.saleType === 'fixed' && detail.commission.buyer.total > 0 && (
        <div className="mt-3 space-y-1 border-t border-gold-600/25 pt-3 text-xs text-muted">
          <p className="flex items-center justify-between gap-3">
            <span>
              عمولة المنصّة
              {detail.commission.vatEnabled && ` + ضريبة ${detail.commission.vatPercent}٪`}
            </span>
            <span dir="ltr" className="font-bold tabular-nums text-paper">
              {formatAmount(detail.commission.buyer.total)}
            </span>
          </p>
          <p className="flex items-center justify-between gap-3 font-bold text-paper">
            <span>الإجمالي عند الشراء</span>
            <span dir="ltr" className="tabular-nums text-gold-500">
              {formatAmount(detail.price + detail.commission.buyer.total)} ريال
            </span>
          </p>
        </div>
      )}
      {done && (
        <p className="mt-3 flex items-center gap-1.5 border-t border-ink-600/70 pt-3 text-xs text-muted">
          <Clock3 className="size-3.5" />
          {LISTING_STATUS_LABELS[detail.status]}
        </p>
      )}
    </div>
  )
}


/**
 * كشف المزايدات.
 *
 * سجلّ رسمي لا قائمة عرض: كل مزايدة برقم تسلسلي وختم زمني كامل **بتوقيت جهاز
 * القارئ**، والملغاة تظهر موسومة لا محذوفة. من يشكّك في مزاد يحتاج أن يقرأ
 * السجلّ بتوقيته هو لا بتوقيت الخادم.
 */
function BidLedger({ detail }: { detail: ListingDetail }) {
  const cancelled = detail.ledger.filter((bid) => bid.status === 'cancelled').length
  const accepted = detail.ledger.filter((bid) => bid.status === 'accepted')
  const leadId = accepted[0]?.id

  return (
    <section className="surface overflow-hidden rounded-2xl">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-600 px-4 py-3">
        <div>
          <h2 className="text-sm font-bold">كشف المزايدات</h2>
          <LocalZoneNote className="mt-0.5 block" />
        </div>
        <div className="flex gap-2">
          <Badge variant="muted">{detail.bidCount} مقبولة</Badge>
          {cancelled > 0 && <Badge variant="danger">{cancelled} ملغاة</Badge>}
        </div>
      </header>

      {detail.ledger.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted">لم تُسجَّل أي مزايدة بعد.</p>
      ) : (
        <div className="max-h-[26rem] overflow-y-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-ink-900/95 backdrop-blur">
              <tr className="border-b border-ink-600 text-[11px] text-muted">
                <th className="w-10 px-3 py-2 text-center font-bold">#</th>
                <th className="px-3 py-2 text-start font-bold">المزايد</th>
                <th className="px-3 py-2 text-start font-bold">وقت المزايدة</th>
                <th className="px-3 py-2 text-end font-bold">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {detail.ledger.map((bid, index) => {
                  const isLead = bid.id === leadId
                  return (
                    <motion.tr
                      key={bid.id}
                      initial={{ opacity: 0, backgroundColor: 'rgba(214,168,75,0.14)' }}
                      animate={{ opacity: 1, backgroundColor: 'rgba(0,0,0,0)' }}
                      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                      className={cn(
                        'border-b border-ink-700/70 last:border-0',
                        bid.status === 'cancelled' && 'opacity-55',
                      )}
                    >
                      <td className="px-3 py-2.5 text-center text-[11px] tabular-nums text-muted">
                        {detail.ledger.length - index}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            'flex items-center gap-1.5 truncate font-bold',
                            bid.isMine && 'text-gold-500',
                          )}
                        >
                          {isLead && bid.status === 'accepted' && (
                            <Crown className="size-3.5 shrink-0 text-gold-500" />
                          )}
                          {bid.isMine ? 'أنت' : bid.bidderName}
                        </span>
                        {bid.status === 'cancelled' && (
                          <span className="text-[11px] text-danger">ملغاة</span>
                        )}
                        {/* من رست عليه ولم يسدّد — يراه البائع وصاحبه وحدهما */}
                        <OverdueTag
                          deadline={bid.paymentDueAt}
                          serverTime={detail.serverTime}
                          className="mt-1"
                        />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-[11px] text-muted">
                        <LocalTime iso={bid.createdAt} />
                      </td>
                      <td
                        className={cn(
                          'whitespace-nowrap px-3 py-2.5 text-end font-extrabold tabular-nums',
                          bid.status === 'cancelled' ? 'text-muted line-through' : 'text-paper',
                        )}
                      >
                        {formatAmount(bid.amount)}
                        <span className="ms-1 text-[10px] font-normal text-muted">ريال</span>
                      </td>
                    </motion.tr>
                  )
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function FieldNode({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold">{value}</dd>
    </div>
  )
}

/**
 * قيمة العمولة مفصَّلةً.
 *
 * المجموع أوّلًا لأنّه ما يُدفع، وتحته من أين جاء — فلا يُقارَن بما ضُبط
 * فيُظنّ مخالفًا له. وبلا ضريبةٍ مفعّلة لا سطر ثانٍ: لا شيء يُفسَّر.
 */
function CommissionValue({
  breakdown,
  vatPercent,
}: {
  breakdown: { base: number; vat: number; total: number }
  vatPercent: number
}) {
  return (
    <>
      <span dir="ltr" className="inline-block tabular-nums">
        {formatAmount(breakdown.total)}
      </span>{' '}
      ريال
      {breakdown.vat > 0 && (
        <span className="mt-0.5 block text-[11px] font-normal text-muted">
          {formatAmount(breakdown.base)} عمولة + {formatAmount(breakdown.vat)} ضريبة {vatPercent}٪
        </span>
      )}
    </>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold">{value}</dd>
    </div>
  )
}

