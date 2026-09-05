'use client'

import Link from 'next/link'
import { ArrowLeft, Gavel, HandCoins, Tag, UserRound } from 'lucide-react'
import { SaudiLicensePlate } from '@/components/plate/SaudiLicensePlate'
import { Badge } from '@/components/ui/badge'
import { formatAmount } from '@/lib/domain/money'
import {
  LISTING_STATUS_LABELS,
  PLATE_FORMAT_LABELS,
  PLATE_TYPE_LABELS,
  SALE_TYPE_LABELS,
  isClosedListing,
  type ListingCard as ListingCardData,
  type SaleType,
} from '@/lib/domain/types'
import { REFERENCE_LABELS } from '@/lib/domain/reference'
import { CardTag } from './card-tag'
import { cn } from '@/lib/utils'
import { CardCountdown, TileCountdown } from './auction-countdown'

const SALE_ICON: Record<SaleType, typeof Gavel> = {
  auction: Gavel,
  fixed: Tag,
  offers: HandCoins,
}

const TAG_TONE: Record<ListingCardData['saleType'], 'gold' | 'success' | 'sky'> = {
  auction: 'gold',
  fixed: 'success',
  offers: 'sky',
}

const SALE_VARIANT: Record<SaleType, 'gold' | 'success' | 'default'> = {
  auction: 'gold',
  fixed: 'success',
  offers: 'default',
}

/** وسمٌ صغير يقول للقارئ إنّ اللوحة له — بنصٍّ واحد أينما وقع. */
export function OwnerTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border border-gold-600/45 bg-gold-500/10 px-2 py-0.5 text-[10px] font-bold leading-none text-gold-400',
        className,
      )}
    >
      <UserRound className="size-3" aria-hidden />
      اللوحة تابعة لك
    </span>
  )
}

export function ListingCard({
  card,
  serverTime,
  index = 0,
  href,
}: {
  card: ListingCardData
  /** مرجع وقت الخادم — بدونه يجمد العدّاد على لحظة الجلب */
  serverTime?: string | null
  index?: number
  /*
   * وجهةٌ مخصّصة — يُمرَّرها معرض البائع ليحمل الرابط أصلَ الزيارة.
   *
   * البطاقة نفسها في السوق وفي المعرض، والفرق في الرابط وحده: منه تعرف صفحة
   * اللوحة أين تُعيد زائرها.
   */
  href?: string
}) {
  const Icon = SALE_ICON[card.saleType]
  const closed = isClosedListing(card.status)
  const isLiveAuction = card.saleType === 'auction' && card.status === 'active'

  return (
    <article
      // الدخول بـ CSS لا بـ JS: البطاقة المُصيَّرة بشفافية صفر تبقى غير مرئية
      // نهائيًا إن تعطّل السكربت — وهي كل ما تعرضه صفحة السوق.
      style={{ '--enter-delay': `${Math.min(index * 25, 250)}ms` } as React.CSSProperties}
      className={cn(
        // `h-full` يجعل البطاقة تملأ خليّة الشبكة، فتتساوى بطاقات الصفّ الواحد
        // مهما اختلف محتواها (المزاد يحمل عدّادًا والبيع المباشر لا يحمله)
        'enter surface group flex h-full flex-col overflow-hidden rounded-2xl transition-[border-color,transform] duration-[var(--duration-base)] ease-[var(--ease-smooth)]',
        closed
          ? 'opacity-75'
          : 'hover:-translate-y-1 hover:border-gold-600/60 hover:shadow-[var(--shadow-lifted)]',
      )}
    >
      {/*
        * صفٌّ ممتدّ على الجوال، وعمودٌ من `sm`.
        *
        * البطاقة العمودية على شاشة ضيّقة تعطي لوحةً بعرض الشاشة فلا يظهر منها
        * إلا واحدة ونصف في الطيّة — والتصفّح على الجوال مسحٌ سريع لا تأمّل.
        * والصفّ يُظهر ثلاثًا ويُبقي اللوحة مقروءة.
        */}
      <Link
        href={href ?? `/market/${card.id}`}
        className="flex flex-1 flex-row items-stretch rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 sm:flex-col"
      >
        {/*
          صندوق بنسبة ثابتة تتوسّطه اللوحة.
          نسب اللوحات تختلف (الطويلة 4.65:1 والدراجة 2.2:1)، والصندوق الموحّد
          يُبقي بطاقات الصفّ الواحد على ارتفاع واحد ولا يتكسّر الكاروسيل.
        */}
        <div className="relative flex w-[54%] shrink-0 flex-col items-center justify-center gap-1.5 overflow-hidden bg-ink-700/45 p-2 sm:aspect-[16/7] sm:w-full sm:gap-0 sm:p-4">
          {/*
            * لمعةٌ تمرّ على اللوحة عند التحويم.
            *
            * السطح المعدني يُعرَف بانعكاسه لا بلونه، وبطاقةٌ ساكنة تمامًا تبدو
            * صورةً لا شيئًا يُمسك. والإزاحة بـ`start` لا `translate`: الاتجاه
            * منطقيّ فتصحّ في RTL بلا استثناء، والعنصر مطلقٌ داخل صندوق مقصوص
            * فلا يكلّف تخطيطًا يُذكر. وتُلغى عند `prefers-reduced-motion`.
            */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 -start-1/3 z-10 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/70 to-transparent opacity-0 transition-all duration-700 ease-out group-hover:start-[110%] group-hover:opacity-100"
          />
          {/*
            لوحة الدراجة نسبتها 2.2:1 والطويلة 4.65:1، فلو ملأت الاثنتان عرض
            الصندوق لبدت الدراجة ضِعف ارتفاع الطويلة. تقييد عرضها إلى ~47٪
            يجعل ارتفاعهما المرئي واحدًا.
          */}
          <div
            className={cn(
              'flex w-full items-center justify-center sm:h-full',
              card.plate.plateType === 'motorcycle' && 'w-[62%] sm:w-[47%]',
            )}
          >
            <SaudiLicensePlate
              plateType={card.plate.plateType}
              plateFormat={card.plate.plateFormat}
              arabicLetters={card.plate.arabicLetters}
              latinLetters={card.plate.latinLetters}
              plateNumbers={card.plate.plateNumbers}
              emblem={card.plate.emblem}
              customEmblemUrl={card.plate.customEmblemUrl}
              size="fill"
            />
          </div>

          {/*
            * الوسوم تحت اللوحة على الجوال.
            *
            * كانت في صفّ واحد مع الرقم المرجعي والعدّاد فوق السعر، فتزدحم
            * أربعة عناصر مختلفة المعنى في سطر ويضيق ما تحتها. والفراغ حول
            * اللوحة كان مهدورًا — فنزلت إليه: وسمان يصفان اللوحة، ملاصقان لها.
            */}
          {/*
            * وسمان تحت اللوحة: طريقتها ونوعها.
            *
            * وتصميمهما أخفّ من `Badge` العامّ — بلا حدٍّ ولا أيقونة، ونقطة
            * ملوّنة تسبق طريقة البيع. الحدّ والأيقونة يصنعان كتلةً تزاحم
            * اللوحة، والوسم هنا يصف ولا يُنادي.
            */}
          <div className="flex flex-wrap items-center justify-center gap-1 sm:hidden">
            <CardTag tone={closed ? 'muted' : TAG_TONE[card.saleType]} dot>
              {closed ? LISTING_STATUS_LABELS[card.status] : SALE_TYPE_LABELS[card.saleType]}
            </CardTag>
            <CardTag tone="muted">{PLATE_TYPE_LABELS[card.plate.plateType]}</CardTag>
            {/*
              * الرياضية وحدها تُوسَم.
              *
              * هي منتجٌ مختلف: لا عربية فيها أصلًا. والاعتيادية والطويلة
              * شكلان لما هو معتاد، فوسمُهما يُثقل البطاقة بما لا يُقرَّر به.
              */}
            {card.plate.plateFormat === 'sport' && (
              <CardTag tone="sky">{PLATE_FORMAT_LABELS.sport}</CardTag>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col sm:contents">
        {/*
          * العدّاد ملاصقًا للوحة: الوقت هو ما يحسم قرار المزايد.
          * وكتلته الكبيرة من `sm`؛ وعلى الجوال رقاقة مضغوطة داخل عمود النصّ،
          * فأربع خانات بأسمائها تمطّ الصفّ وتترك حول اللوحة فراغًا.
          */}
        {isLiveAuction && card.endsAt && (
          <CardCountdown
            endsAt={card.endsAt}
            serverTime={serverTime ?? null}
            frozenMs={serverTime ? null : card.remainingMs}
            className="max-sm:hidden"
          />
        )}

        <div className="flex flex-1 flex-col gap-2.5 p-3 sm:gap-3 sm:p-4">
          <div className="hidden flex-wrap items-center gap-1.5 sm:flex">
            <Badge variant={SALE_VARIANT[card.saleType]}>
              <Icon className="size-3" />
              {SALE_TYPE_LABELS[card.saleType]}
            </Badge>
            <Badge variant="muted">{PLATE_TYPE_LABELS[card.plate.plateType]}</Badge>
            {card.plate.plateFormat === 'sport' && (
              <Badge variant="default">{PLATE_FORMAT_LABELS.sport}</Badge>
            )}
            {closed && <Badge variant="muted">{LISTING_STATUS_LABELS[card.status]}</Badge>}
          </div>

          {/*
            * العدّاد سطرٌ مستقلّ تحت السعر على الجوال.
            *
            * الوقت والسعر هما ما يحسم قرار المزايد، فيقعان معًا ويُقرآن معًا —
            * لا رقاقةً صغيرة محشورة بين وسمين لا تخصّانها.
            */}
          <div className="mt-auto flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-muted">{card.priceLabel}</p>
              <p
                data-card-price
                className={cn(
                  'text-xl font-extrabold tabular-nums',
                  card.status === 'sold' ? 'text-success' : 'text-gold-500',
                )}
              >
                {card.displayPrice > 0 ? formatAmount(card.displayPrice) : '—'}
                {card.displayPrice > 0 && (
                  <span className="ms-1 text-[11px] font-semibold opacity-70">ريال</span>
                )}
              </p>
            </div>

            {card.saleType === 'auction' && (
              <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted">
                <Gavel className="size-3.5" />
                {card.bidCount}
              </span>
            )}
            {card.saleType === 'offers' && card.offerCount > 0 && (
              <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted">
                <HandCoins className="size-3.5" />
                {card.offerCount}
              </span>
            )}
          </div>

          {isLiveAuction && card.endsAt && (
            <TileCountdown
              endsAt={card.endsAt}
              serverTime={serverTime ?? null}
              frozenMs={serverTime ? null : card.remainingMs}
              className="sm:hidden"
            />
          )}

        </div>
        </div>
      </Link>

      {/*
        * التذييل: الدعوة ورقمها.
        *
        * اسم البائع لا يُقرَّر به شراء لوحة — والبطاقة مساحةٌ لما يُقرَّر به.
        * وموضعه أنسب لما يُنقر: سطرٌ كامل بعرض البطاقة، أسهل إصابةً بالإبهام
        * من سطرٍ محشور بين السعر وحافّة العمود.
        */}
      <p className="flex items-center justify-between gap-3 border-t border-ink-700 px-3 py-2.5 text-[11px] text-muted sm:px-4">
        <span className="flex min-w-0 items-center gap-2">
          <span
            dir="ltr"
            title={REFERENCE_LABELS.listing}
            className="shrink-0 tabular-nums text-muted/70"
          >
            {card.reference}
          </span>
          {/*
            * وسمُ الملكية بجانب رقم الإعلان.
            *
            * البطاقات متشابهة، ولوحةُ صاحبها بينها لا يميّزها شيء — فيفتحها
            * ليزايد عليها، أو يمرّ عليها ولا يعرف أنّ عليه متابعتها. وموضعه
            * الكعب لا الصدر: الصدر لما يُقرَّر به شراءً، وهذا خبرٌ عن القارئ
            * لا عن اللوحة.
            */}
          {card.isMine && <OwnerTag />}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold-400 transition-transform group-hover:-translate-x-0.5">
          {closed ? 'عرض التفاصيل' : card.saleType === 'fixed' ? 'اشترِ الآن' : 'التفاصيل والمزايدة'}
          <ArrowLeft className="size-3.5" />
        </span>
      </p>
    </article>
  )
}
