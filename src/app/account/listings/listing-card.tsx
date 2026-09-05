import Link from 'next/link'
import { CalendarDays, Eye, Gavel, HandCoins, Lock, ShieldCheck, Users } from 'lucide-react'
import { SaudiLicensePlate } from '@/components/plate/SaudiLicensePlate'
import { CardTag, type CardTagTone } from '@/components/market/card-tag'
import { TileCountdown } from '@/components/market/auction-countdown'
import { LocalTime } from '@/components/market/local-time'
import { ListingActions } from './listing-actions'
import { formatAmount } from '@/lib/domain/money'
import { REFERENCE_LABELS } from '@/lib/domain/reference'
import {
  LISTING_STATUS_LABELS,
  PLATE_TYPE_LABELS,
  SALE_TYPE_LABELS,
  isClosedListing,
  type AccountListing,
  type ListingStatus,
  type SaleType,
} from '@/lib/domain/types'
import { arabicCount, cn } from '@/lib/utils'

const STATUS_TONE: Record<ListingStatus, CardTagTone> = {
  draft: 'muted',
  scheduled: 'sky',
  active: 'gold',
  sold: 'success',
  // انتهت الجولة دون بيع: خبرٌ لا خطأ — فلا تُصبَغ بلون الخطر
  reserve_not_met: 'muted',
  no_bids: 'muted',
  cancelled: 'muted',
  suspended: 'danger',
}

/*
 * شريطٌ رفيع بلون الحالة عند حافّة البطاقة.
 *
 * الوسم يُقرأ بالعين وحدها بعد وقوفها عليه، والشريط يُلتقط بطرفها وهي تمرّ:
 * فيُعرَف المعروض من المُباع من الموقوف في مسحةٍ واحدة لصفحةٍ فيها عشرون لوحة.
 * ولا يُلوَّن ما لا خبر فيه — مسودّةٌ أو جولةٌ انتهت بلا بيع لا تستحقّ نداءً.
 */
const STATUS_ACCENT: Partial<Record<ListingStatus, string>> = {
  active: 'bg-gold-500',
  sold: 'bg-success',
  suspended: 'bg-danger',
  scheduled: 'bg-ink-500',
}

const SALE_TONE: Record<SaleType, CardTagTone> = {
  auction: 'gold',
  fixed: 'success',
  offers: 'sky',
}

/**
 * بطاقة لوحةٍ في «لوحاتي».
 *
 * كانت صفًّا: لوحةٌ بعرض ١٥٠ بكسل، وإلى جانبها وسومٌ وأربع خانات وأزرار — يفيض
 * بعضها إلى سطرٍ ثانٍ، ويبقى فوق اللوحة وتحتها فراغٌ لا يحمل شيئًا.
 *
 * والبطاقة تقرأ من أعلى إلى أسفل ثلاث طبقات: **ما حال اللوحة** فوقها، ثمّ
 * **اللوحة** كبيرةً في وسط عمودها، ثمّ **ما هي** تحتها — وسمان يصفانها بلا
 * حدٍّ ولا أيقونة، هما وسما بطاقة السوق نفسهما فلا تبدو الصفحتان من منصّتين.
 * وإلى جانب العمود ما يُقرَّر به: الرقم، والعدّاد، وما يخصّ البائع وحده.
 */
export function MyListingCard({
  listing,
  serverTime,
}: {
  listing: AccountListing
  /** مرجع وقت الخادم — بدونه يجمد العدّاد على لحظة الجلب */
  serverTime: string | null
}) {
  const closed = isClosedListing(listing.status)
  const liveAuction = listing.saleType === 'auction' && listing.status === 'active'
  const href = `/market/${listing.id}`

  return (
    <li
      className={cn(
        'surface group relative overflow-hidden rounded-2xl transition-[border-color,box-shadow]',
        closed ? 'opacity-80' : 'hover:border-gold-600/50 hover:shadow-[var(--shadow-lifted)]',
      )}
    >
      {STATUS_ACCENT[listing.status] && (
        <span
          aria-hidden
          className={cn(
            'absolute inset-y-0 start-0 w-[3px]',
            STATUS_ACCENT[listing.status],
            closed && 'opacity-70',
          )}
        />
      )}

      <div className="flex flex-row items-stretch gap-3 p-3 sm:gap-5 sm:p-4">
        {/*
          * عمود اللوحة: حالتها فوقها، ووصفها تحتها.
          *
          * الفراغ حول اللوحة كان مهدورًا وهو أقرب موضعٍ إلى ما يصفها — فالوسم
          * يُقرأ مع صاحبه لا في طرفٍ بعيد عنه.
          */}
        <Link
          href={href}
          className="relative flex w-1/2 max-w-[280px] shrink-0 flex-col items-center justify-center gap-2 overflow-hidden rounded-xl bg-ink-700/40 p-1.5 transition-colors hover:bg-ink-700/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 sm:gap-2.5 sm:p-3"
        >
          {/*
            * لمعةٌ تمرّ على اللوحة عند التحويم — كما في بطاقة السوق.
            *
            * السطح المعدني يُعرَف بانعكاسه لا بلونه، وصندوقٌ ساكن تمامًا يبدو
            * صورةً لا شيئًا يُمسك. والإزاحة بـ`start` لا `translate` فتصحّ في
            * RTL بلا استثناء، وتُلغى عند `prefers-reduced-motion`.
            */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 -start-1/3 z-10 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/60 to-transparent opacity-0 transition-all duration-700 ease-out group-hover:start-[110%] group-hover:opacity-100 motion-reduce:hidden"
          />

          <CardTag tone={STATUS_TONE[listing.status]} dot>
            {LISTING_STATUS_LABELS[listing.status]}
          </CardTag>

          {/*
            لوحة الدراجة نسبتها 2.2:1 والطويلة 4.65:1، فلو ملأت الاثنتان عرض
            العمود لبدت الدراجة ضِعف ارتفاع الطويلة.
          */}
          <div
            className={cn(
              'flex w-full items-center justify-center',
              listing.plateType === 'motorcycle' && 'w-[64%]',
            )}
          >
            <SaudiLicensePlate
              plateType={listing.plateType}
              plateFormat={listing.plateFormat}
              arabicLetters={listing.arabicLetters}
              latinLetters={listing.latinLetters}
              plateNumbers={listing.plateNumbers}
              emblem={listing.emblem}
              customEmblemUrl={listing.customEmblemUrl}
              size="fill"
            />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-1">
            <CardTag tone={SALE_TONE[listing.saleType]}>
              {SALE_TYPE_LABELS[listing.saleType]}
            </CardTag>
            <CardTag tone="muted">{PLATE_TYPE_LABELS[listing.plateType]}</CardTag>
          </div>
        </Link>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <span
              dir="ltr"
              title={REFERENCE_LABELS.listing}
              className="shrink-0 text-[11px] tabular-nums text-muted/70"
            >
              {listing.reference}
            </span>
            {listing.pendingOfferCount > 0 && (
              <CardTag tone="sky" dot>
                {listing.pendingOfferCount} عرض جديد
              </CardTag>
            )}
          </div>

          {/*
            * عمودٌ على الجوال، وصفُّ مقاييس على الشاشة الواسعة.
            *
            * الرقم الكبير وحده في عمودٍ عرضه أربعمئة بكسل يترك تحته بياضًا
            * طويلًا. وصفُّ المقاييس يقرأ عرضًا: الرقم، ثمّ ما يفسّره خلف فاصل.
            */}
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:gap-5">
            <Headline listing={listing} />
            <Stats listing={listing} />
          </div>

          {liveAuction && listing.endsAt && (
            <TileCountdown
              endsAt={listing.endsAt}
              serverTime={serverTime}
              frozenMs={null}
              className="mt-auto"
            />
          )}
        </div>

        {/*
          * لوحُ البائع — على الشاشة الواسعة وحدها.
          *
          * البطاقة على اللاب توب تقارب ألف بكسل، ولوحةٌ بعرض ٢٨٠ ورقمٌ بجانبها
          * يتركان نصفها بياضًا. وما يملؤه ليس زخرفة: ما يسأل عنه البائع وهو
          * ينظر إلى إعلانه — كم رآه الناس، ومن يتصدّر، وكم بقي على الاحتياطي.
          * ويُخفى دون `lg` لأنّ عمودًا ثالثًا في ٣٧٥ بكسل يسحق العمودين قبله.
          */}
        <Insights listing={listing} />
      </div>

      {/*
        * الأزرار في تذييلٍ بعرض البطاقة.
        *
        * محشورةً في عمود النصّ كانت تلتفّ سطرين وتزاحم الأرقام، وهنا تُصاب
        * بالإبهام ولا تُزاحم — و«عرض اللوحة» أوّلها لأنها الوجهة لا الأمر.
        */}
      <div className="scrollbar-none flex flex-nowrap items-center gap-1.5 overflow-x-auto border-t border-ink-700 px-3 py-2.5 sm:gap-2 sm:px-4">
        <Link
          href={href}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-ink-600 bg-ink-700/60 px-2.5 text-xs font-bold text-paper transition-colors hover:border-gold-600/50 hover:text-gold-400"
        >
          <Eye className="size-3.5" />
          عرض اللوحة
        </Link>
        <ListingActions
          listingId={listing.id}
          status={listing.status}
          canEdit={!isClosedListing(listing.status) && listing.bidCount === 0}
        />
      </div>
    </li>
  )
}

/** الرقم الذي يُقرأ أوّلًا — يختلف بطريقة البيع وبانتهاء الجولة. */
function Headline({ listing }: { listing: AccountListing }) {
  const sold = listing.status === 'sold'
  const { label, value } = sold
    ? { label: 'بيعت بـ', value: listing.soldAmount }
    : listing.saleType === 'fixed'
      ? { label: 'سعر البيع', value: listing.price }
      : listing.saleType === 'offers'
        ? { label: 'أقلّ عرض مقبول', value: listing.minimumOffer }
        : listing.highestAmount
          ? { label: 'أعلى مزايدة', value: listing.highestAmount }
          : { label: 'السعر الافتتاحي', value: listing.startingPrice }

  return (
    <div className="min-w-0">
      <p className="text-[11px] text-muted">{label}</p>
      <p
        className={cn(
          'text-xl font-extrabold tabular-nums sm:text-2xl',
          sold ? 'text-success' : 'text-gold-500',
        )}
      >
        {value > 0 ? formatAmount(value) : '—'}
        {value > 0 && <span className="ms-1 text-[11px] font-semibold opacity-70">ريال</span>}
      </p>
    </div>
  )
}

/** ما يخصّ البائع وحده: عدد المتنافسين، وحال الاحتياطي. */
function Stats({ listing }: { listing: AccountListing }) {
  if (listing.saleType === 'auction') {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] lg:flex-col lg:items-start lg:gap-1.5 lg:self-end lg:border-s lg:border-ink-700 lg:ps-5">
        <span className="inline-flex items-center gap-1 font-semibold text-muted">
          <Gavel className="size-3.5" />
          {arabicCount(listing.bidCount, {
            zero: 'لا مزايدات بعد',
            one: 'مزايدة واحدة',
            two: 'مزايدتان',
            few: 'مزايدات',
            many: 'مزايدة',
          })}
        </span>
        {listing.reservePrice > 0 &&
          (listing.reserveMet ? (
            <span className="inline-flex items-center gap-1 font-bold text-success">
              <ShieldCheck className="size-3.5" />
              تجاوزت الاحتياطي
            </span>
          ) : (
            /*
              * الاحتياطي للبائع وحده — ولا يُذكر إلا وبجانبه ما يقول إنه سرّ.
              *
              * رقمٌ ذهبيّ بلا قفلٍ يقرؤه صاحبه فيحسب أنّ المزايدين يرونه،
              * فيرفعه أو يخفضه بناءً على ظنٍّ لا أساس له.
              */
            <span
              title="لا يظهر للمزايدين"
              className="inline-flex items-center gap-1 text-gold-600"
            >
              <Lock className="size-3" />
              الاحتياطي{' '}
              <b className="tabular-nums text-gold-500">{formatAmount(listing.reservePrice)}</b>
            </span>
          ))}
      </div>
    )
  }

  if (listing.saleType === 'offers') {
    return (
      <p className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted lg:self-end lg:border-s lg:border-ink-700 lg:ps-5">
        <HandCoins className="size-3.5" />
        {arabicCount(listing.offerCount, {
          zero: 'لم يصلك عرض بعد',
          one: 'عرض واحد',
          two: 'عرضان',
          few: 'عروض',
          many: 'عرضًا',
        })}
      </p>
    )
  }

  return null
}

/** ما يسأل عنه البائع عن إعلانه — يظهر حيث يتّسع له العرض. */
function Insights({ listing }: { listing: AccountListing }) {
  const auction = listing.saleType === 'auction'

  return (
    <dl className="hidden w-52 shrink-0 flex-col gap-2.5 self-center border-s border-ink-700 ps-5 text-xs lg:flex xl:w-60">
      <InsightLine icon={Eye} label="المشاهدات" value={listing.viewCount.toLocaleString('en')} />

      {auction && listing.highestBidderName && (
        <InsightLine icon={Users} label="يتصدّرها" value={listing.highestBidderName} />
      )}

      {auction && !listing.reserveMet && listing.reserveGap > 0 && (
        <InsightLine
          icon={Lock}
          label="يفصلها عن الاحتياطي"
          value={formatAmount(listing.reserveGap)}
          tone="gold"
        />
      )}

      {listing.saleType === 'offers' && listing.pendingOfferCount > 0 && (
        <InsightLine
          icon={HandCoins}
          label="عروض تنتظر ردّك"
          value={String(listing.pendingOfferCount)}
          tone="gold"
        />
      )}

      {auction && listing.endsAt && listing.status === 'active' ? (
        <InsightLine
          icon={CalendarDays}
          label="ينتهي"
          value={<LocalTime iso={listing.endsAt} mode="datetime" />}
        />
      ) : (
        <InsightLine
          icon={CalendarDays}
          label="أُضيفت"
          value={<LocalTime iso={listing.createdAt} mode="date" />}
        />
      )}
    </dl>
  )
}

function InsightLine({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType
  label: string
  value: React.ReactNode
  tone?: 'gold'
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="inline-flex items-center gap-1.5 text-muted">
        <Icon className="size-3.5 shrink-0 self-center" />
        {label}
      </dt>
      <dd className={cn('shrink-0 font-bold tabular-nums', tone === 'gold' && 'text-gold-500')}>
        {value}
      </dd>
    </div>
  )
}
