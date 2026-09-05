import Link from 'next/link'
import { ArrowLeft, Clock, Gavel, ShieldCheck, Wallet } from 'lucide-react'
import { TableSearch } from '@/components/admin/table-search'
import { AdminHeader, Money } from '@/components/admin/admin-ui'
import { ListingAdminActions } from '@/components/admin/listing-admin-actions'
import { SaudiLicensePlate } from '@/components/plate/SaudiLicensePlate'
import { Badge } from '@/components/ui/badge'
import { formatAmount } from '@/lib/domain/money'
import { LISTING_STATUS_LABELS, SALE_TYPE_LABELS, isClosedListing } from '@/lib/domain/types'
import { listAdminListings, type AdminListingRow } from '@/lib/server/admin-service'
import { requireAdminId } from '@/lib/server/require-admin'
import { cn, formatTimestamp } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'الإعلانات' }

/** نغمة كل حالة — الموقوف خطر، والمباع نجاح، وما عداهما محايد. */
const LISTING_STATUS_TONE: Record<string, 'success' | 'muted' | 'danger' | 'gold' | 'default'> = {
  active: 'success',
  sold: 'success',
  suspended: 'danger',
  cancelled: 'muted',
  expired: 'muted',
  reserve_not_met: 'gold',
  no_bids: 'muted',
  draft: 'muted',
}

/**
 * الإعلانات — بطاقاتٌ اللوحةُ عنوانها، لا جدولٌ من تسعة أعمدة.
 *
 * كان جدولًا عرضه ٦٢rem يُمرَّر أفقيًّا على الجوال، فتُقرأ اللوحة في عمودٍ
 * والسعر في عمودٍ لا يُريان معًا. والمشغّل هنا لا يمسح أرقامًا: يبحث عن إعلانٍ
 * بعينه — عن لوحته يعرفها بصورتها لا بحروفها مكتوبةً — ثمّ يقرأ حاله وسعره
 * وعرابينه في نظرة، ثمّ يوقفه أو يفتح تفصيله.
 *
 * فاللوحة أوّل ما في البطاقة وأكبره، وما يليها أربعة أرقام يُقرَّر بها.
 */
export default async function AdminListingsPage() {
  await requireAdminId()
  const rows = await listAdminListings()
  const suspended = rows.filter((row) => row.status === 'suspended').length

  return (
    <>
      <AdminHeader
        title="الإعلانات"
        description={`${rows.length} إعلانًا${suspended > 0 ? ` · ${suspended} موقوفة` : ''} — المعروضة والمسودّات والمغلقة.`}
      />

      <TableSearch
        placeholder="ابحث باللوحة أو البائع أو رقم الإعلان (L26-00001)"
        rows={rows.map((row) => ({
          key: row.id,
          reference: row.reference,
          haystack: [
            row.plate.arabicLetters,
            row.plate.latinLetters,
            row.plate.plateNumbers,
            row.sellerName,
            row.id,
          ].join(' '),
        }))}
      >
        {rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-ink-600 p-10 text-center text-sm text-muted">
            لا توجد إعلانات.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {rows.map((row) => (
              <ListingCard key={row.id} row={row} />
            ))}
          </ul>
        )}
      </TableSearch>
    </>
  )
}

function ListingCard({ row }: { row: AdminListingRow }) {
  const detail = `/admin/listings/${row.reference}`
  const price = row.highestAmount ?? (row.saleType === 'fixed' ? row.price : row.startingPrice)
  const closed = isClosedListing(row.status)
  const actionable = !closed || row.status === 'suspended'

  return (
    /*
     * البطاقة كلّها تُلمس، والأزرار فوقها.
     *
     * رابطٌ ممدود على مساحتها يفتح التفصيل بلمسةٍ في أي موضع — كما تُفتح
     * الصفوف في التطبيقات — و«إيقاف» يعلوه بطبقةٍ فلا يبتلعه الرابط. ولولا
     * ذلك لوجب أن يُصاد رابطٌ صغير بالإصبع في صفٍّ عرضه شاشة.
     */
    <li
      data-row={row.id}
      className={cn(
        'surface group relative overflow-hidden rounded-2xl p-3 transition-colors hover:border-gold-600/40 sm:p-4',
        row.status === 'suspended' && 'border-danger/35 bg-danger/[0.03]',
      )}
    >
      <Link
        href={detail}
        aria-label={`تفاصيل الإعلان ${row.reference}`}
        className="absolute inset-0 rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-500"
      />

      <div className="flex items-start gap-3 sm:gap-4">
        {/*
          * اللوحة بعرضٍ ثابت ونسبتها تحكم ارتفاعها — كما تُعرض في السوق.
          * وهي هوية الإعلان: يعرفها المشغّل بصورتها قبل أن يقرأ رقمها.
          */}
        <div className="w-[112px] shrink-0 sm:w-[150px]">
          <SaudiLicensePlate {...row.plate} size="fullscreen" showReflection={false} />
        </div>

        <div className="min-w-0 flex-1">
          {/*
            * `justify-between` لا هامشٌ تلقائيّ.
            *
            * كان الرقم يحمل `ms-auto` و`dir="ltr"` معًا، والهامش المنطقيّ
            * يُحسب باتّجاه العنصر نفسه لا باتّجاه أبيه — فانقلب إلى يساره
            * ودفعه إلى الجهة التي جاء منها بدل أن يُقصيه إلى طرف السطر.
            */}
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
            <span className="flex items-center gap-1.5">
              <Badge variant={LISTING_STATUS_TONE[row.status]}>
                {LISTING_STATUS_LABELS[row.status]}
              </Badge>
              <span className="text-[11px] text-muted">{SALE_TYPE_LABELS[row.saleType]}</span>
            </span>
            <span
              dir="ltr"
              className="shrink-0 rounded-lg bg-ink-700 px-2 py-0.5 font-mono text-[11px] font-bold text-gold-500"
            >
              {row.reference}
            </span>
          </div>

          <p className="mt-2 truncate text-xs">
            <Link href={`/admin/users/${row.sellerReference}`} className="relative font-semibold hover:underline">
              {row.sellerName}
            </Link>
          </p>
          <p className="mt-0.5 text-[11px] text-muted">{formatTimestamp(row.createdAt)}</p>
        </div>
      </div>

      {/*
        * أربعة أرقام يُقرَّر بها: السعر، والمزايدات، والعربون، والمهلة.
        * وعمودان على الجوال لا أربعة، فلا يضيق الرقم حتى يُقرأ حرفين.
        */}
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-ink-600/70 pt-3 sm:grid-cols-4">
        <Stat icon={Wallet} label={row.highestAmount ? 'أعلى مزايدة' : 'السعر'}>
          <Money value={price} className="text-sm" />
          {row.reservePrice > 0 && (
            <span className="block text-[10px] text-gold-500">
              احتياطي {formatAmount(row.reservePrice)}
            </span>
          )}
        </Stat>

        <Stat icon={Gavel} label="المزايدات">
          <span className="text-sm font-bold tabular-nums">{row.bidCount}</span>
        </Stat>

        <Stat icon={ShieldCheck} label="العربون">
          {row.depositAmount > 0 ? (
            <>
              <Money value={row.depositAmount} className="text-sm text-gold-500" />
              {row.heldDeposits > 0 && (
                <span className="block text-[10px] text-muted">{row.heldDeposits} محجوز</span>
              )}
            </>
          ) : (
            <span className="text-sm text-muted">—</span>
          )}
        </Stat>

        <Stat icon={Clock} label={closed ? 'أُغلق' : 'ينتهي'}>
          <span className="text-[11px] font-semibold leading-tight">
            {row.endsAt || row.endedAt ? formatTimestamp(row.endedAt ?? row.endsAt) : '—'}
          </span>
        </Stat>
      </dl>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        {/* `relative` ترفع الأزرار فوق الرابط الممدود فتبقى قابلةً للضغط */}
        <div className="relative flex flex-wrap gap-2">
          {actionable && (
            <ListingAdminActions
              listingId={row.id}
              label={`${row.plate.arabicLetters} ${row.plate.plateNumbers}`}
              suspended={row.status === 'suspended'}
            />
          )}
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-gold-500">
          التفاصيل
          <ArrowLeft className="size-3" />
        </span>
      </div>
    </li>
  )
}

function Stat({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-[10px] font-semibold text-muted">
        <Icon className="size-3" />
        {label}
      </dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  )
}
