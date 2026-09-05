import Link from 'next/link'
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Clock3,
  Gavel,
  HandCoins,
  LayoutList,
  Plus,
  ShoppingBag,
  Store,
  TrendingUp,
  Receipt,
  Wallet,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SaudiLicensePlate } from '@/components/plate/SaudiLicensePlate'
import { CompactCountdown } from '@/components/market/auction-countdown'
import { formatAmount } from '@/lib/domain/money'
import { isClosedListing, type Plate } from '@/lib/domain/types'
import { REFERENCE_LABELS } from '@/lib/domain/reference'
import { ReferenceChip } from '@/components/market/reference-chip'
import { isOverdue } from '@/lib/domain/wallet'
import {
  getAccountBids,
  getAccountListings,
  getOffersReceivedByUser,
} from '@/lib/server/market-service'
import { getPurchases, getSales } from '@/lib/server/order-service'
import { getWalletView } from '@/lib/server/wallet-service'
import { getNotifications } from '@/lib/server/notification-service'
import { requireUserId } from '@/lib/server/require-user'
import { getStore } from '@/lib/store'
import { arabicCount, cn, formatTimestamp } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/**
 * لوحة تحكّم المستخدم.
 *
 * مبنية على مبدأ **ما يحتاج تصرّفًا أولًا**: مزايدة تجاوزك فيها غيرك، أو صفقة
 * اقتربت مهلة سدادها، أو عرض ينتظر ردّك — هذه تتصدّر الصفحة. الأرقام المجرّدة
 * تأتي بعدها، فالرقم يُخبر ولا يُوجّه.
 */
export default async function AccountOverviewPage() {
  const userId = await requireUserId()
  const now = Date.now()
  // مرجع واحد لعدّادات الصفحة، فلا تنحرف بساعة الجهاز
  const serverTime = new Date(now).toISOString()

  const [user, listings, bids, offers, purchases, sales, wallet, notifications] = await Promise.all([
    getStore().findUser(userId),
    getAccountListings(userId),
    getAccountBids(userId),
    getOffersReceivedByUser(userId),
    getPurchases(userId),
    getSales(userId),
    getWalletView(userId),
    getNotifications(userId, 6),
  ])

  // ---- ما يحتاج تصرّفًا
  const outbid = bids.filter((bid) => !bid.isHighest && !isClosedListing(bid.listingStatus))
  const pendingOffers = offers.filter((offer) => offer.status === 'pending')
  const overduePurchases = purchases.filter((order) => isOverdue(order, now))
  const duePurchases = purchases.filter(
    (order) => order.status === 'awaiting_settlement' && !isOverdue(order, now),
  )
  const drafts = listings.filter((listing) => listing.status === 'draft')

  // ---- مراحل الضمان: ما ينتظرك في صفقات جارية
  const awaitingMyConfirm = purchases.filter((order) => order.status === 'ownership_transferred')
  const awaitingMyTransfer = sales.filter((order) => order.status === 'escrow_held')
  const disputedPurchases = purchases.filter((order) => order.status === 'disputed')
  const disputedSales = sales.filter((order) => order.status === 'disputed')
  const disputed = [...disputedPurchases, ...disputedSales]

  const actions = [
    awaitingMyConfirm.length && {
      tone: 'gold' as const,
      icon: HandCoins,
      title: `${arabicCount(awaitingMyConfirm.length, {
        one: 'لوحة نُقلت ملكيتها',
        two: 'لوحتان نُقلت ملكيتهما',
        few: 'لوحات نُقلت ملكيتها',
        many: 'لوحة نُقلت ملكيتها',
      })} — لدى الإدارة`,
      body: 'لا مطلوب منك شيء: تتحقّق الإدارة من النقل ثم تحوّل المبلغ للبائع. ولو رأيت خللًا فافتح تذكرة قبل التحويل.',
      href: '/account/purchases',
      cta: 'مشترياتي',
    },
    awaitingMyTransfer.length && {
      tone: 'gold' as const,
      icon: Clock3,
      title: `${arabicCount(awaitingMyTransfer.length, {
        one: 'صفقة',
        two: 'صفقتان',
        few: 'صفقات',
        many: 'صفقة',
      })} وصل مالها — انقل الملكية`,
      body: 'المبلغ محجوز لصالحك، ويصلك بعد نقل الملكية وتحقّق الإدارة من إثباتها.',
      href: '/account/sales',
      cta: 'مبيعاتي',
    },
    wallet.dueCommission > 0 && {
      tone: 'danger' as const,
      icon: Receipt,
      title: `عليك عمولة مستحقّة ${formatAmount(wallet.dueCommission)} ريال`,
      body: 'لم تُقتطع وقت اكتمال الصفقة لعدم كفاية رصيدك — اشحن محفظتك لتسويتها.',
      href: '/account/wallet',
      cta: 'محفظتي',
    },
    disputed.length && {
      tone: 'danger' as const,
      icon: AlertTriangle,
      title: `${arabicCount(disputed.length, {
        one: 'صفقة',
        two: 'صفقتان',
        few: 'صفقات',
        many: 'صفقة',
      })} عليها اعتراض`,
      body: 'توقّف تحويل المبلغ حتى تفصل الإدارة.',
      // الاعتراض قد يكون على بيعك لا على شرائك — فلا يُساق البائع إلى «مشترياتي»
      href: disputedPurchases.length > 0 ? '/account/purchases' : '/account/sales',
      cta: disputedPurchases.length > 0 ? 'مشترياتي' : 'مبيعاتي',
    },
    overduePurchases.length && {
      tone: 'danger' as const,
      icon: AlertTriangle,
      title: `${arabicCount(overduePurchases.length, {
        one: 'صفقة',
        two: 'صفقتان',
        few: 'صفقات',
        many: 'صفقة',
      })} تجاوزت مهلة السداد`,
      body: 'قد يُصادَر عربونك — أتمّ السداد وتواصل مع البائع.',
      href: '/account/purchases',
      cta: 'مشترياتي',
    },
    outbid.length && {
      tone: 'gold' as const,
      icon: TrendingUp,
      title: `تجاوزك مزايد في ${arabicCount(outbid.length, {
        one: 'مزاد',
        two: 'مزادين',
        few: 'مزادات',
        many: 'مزاد',
      })}`,
      body: 'زايد من جديد قبل انتهاء الوقت.',
      href: '/account/bids',
      cta: 'مزايداتي',
    },
    pendingOffers.length && {
      tone: 'gold' as const,
      icon: HandCoins,
      title: `${arabicCount(pendingOffers.length, {
        one: 'عرض',
        two: 'عرضان',
        few: 'عروض',
        many: 'عرضًا',
      })} بانتظار ردّك`,
      body: 'اقبل ما يناسبك أو ارفضه ليعرف المشتري.',
      href: '/account/offers',
      cta: 'العروض',
    },
    duePurchases.length && {
      tone: 'default' as const,
      icon: Clock3,
      title: `${arabicCount(duePurchases.length, {
        one: 'صفقة',
        two: 'صفقتان',
        few: 'صفقات',
        many: 'صفقة',
      })} بانتظار السداد`,
      body: 'أتمّها قبل انقضاء المهلة.',
      href: '/account/purchases',
      cta: 'مشترياتي',
    },
    drafts.length && {
      tone: 'default' as const,
      icon: LayoutList,
      title: `${arabicCount(drafts.length, {
        one: 'مسودّة',
        two: 'مسودّتان',
        few: 'مسودّات',
        many: 'مسودّة',
      })} لم تُنشر`,
      body: 'لن تظهر في السوق حتى تنشرها.',
      href: '/account/listings',
      cta: 'إدارة لوحاتي',
    },
  ].filter(Boolean) as {
    tone: 'danger' | 'gold' | 'default'
    icon: React.ElementType
    title: string
    body: string
    href: string
    cta: string
  }[]

  const leadingBids = bids.filter((bid) => bid.isHighest && !isClosedListing(bid.listingStatus))
  const liveBids = bids
    .filter((bid) => !isClosedListing(bid.listingStatus) && bid.endsAt)
    .sort((a, b) => a.remainingMs - b.remainingMs)
    .slice(0, 4)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">أهلًا {user?.displayName ?? ''}</h1>
          <p className="mt-1 text-sm text-muted">ملخّص نشاطك بيعًا وشراءً.</p>
          {/* رقم الحساب مع اسمه لا مختصرًا: هو ما يُقتبَس في أي مراسلة مع
              الإدارة، وهو نفسه ما تراه هي في ملفّك */}
          {user && (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
              <span>{REFERENCE_LABELS.user}</span>
              <ReferenceChip reference={user.reference} kind="user" />
            </p>
          )}
        </div>
        <Button asChild>
          <Link href="/account/listings/new">
            <Plus className="size-4" />
            أضف لوحة
          </Link>
        </Button>
      </header>

      {/* المحفظة أولًا: لا مزايدة في مزاد بعربون بلا رصيد متاح */}
      <Link
        href="/account/wallet"
        className="surface group flex flex-wrap items-center gap-4 rounded-2xl p-5 transition-colors hover:border-gold-600/50"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-gold-600/40 bg-gold-500/10 text-gold-500">
          <Wallet className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-xs text-muted">الرصيد المتاح للمزايدة</span>
          <span className="block text-2xl font-extrabold tabular-nums text-gold-500">
            {formatAmount(wallet.available)}
            <span className="ms-1 text-sm font-normal text-muted">ريال</span>
          </span>
        </span>
        <span className="ms-auto flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted">
          <span>
            الرصيد الكلي <b className="text-paper">{formatAmount(wallet.balance)}</b>
          </span>
          {wallet.held > 0 && (
            <span>
              محجوز كعرابين <b className="text-gold-500">{formatAmount(wallet.held)}</b>
            </span>
          )}
          <span className="flex items-center gap-1 font-semibold text-gold-500">
            المحفظة
            <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
          </span>
        </span>
      </Link>

      {/* ما يحتاج تصرّفًا */}
      {actions.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold">يحتاج تصرّفك</h2>
          <ul className="space-y-2">
            {actions.map((action) => (
              /*
               * الزرّ ينزل سطرًا على الجوال ولا يزاحم النصّ.
               *
               * كان الثلاثة في سطر واحد بـ`flex-wrap`، والنصّ `flex-1` فأساسه
               * صفر: فلا يقع الالتفاف أبدًا، بل ينضغط الكلام بين أيقونةٍ وزرّ
               * فيتكسّر العنوان على ثلاثة أسطر في شاشة ٣٢٠. والشبكة تقول ما
               * أراده الالتفاف صراحةً: عمودان يضمّان الأيقونة والنصّ، والزرّ
               * تحته في العمود الثاني — ثمّ ثلاثة أعمدة في سطر واحد فوق `sm`.
               */
              <li
                key={action.title}
                className={cn(
                  'grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-3 rounded-2xl border p-4',
                  'sm:grid-cols-[auto_1fr_auto] sm:items-center',
                  action.tone === 'danger' && 'border-danger/40 bg-danger/[0.06]',
                  action.tone === 'gold' && 'border-gold-600/40 bg-gold-500/[0.06]',
                  action.tone === 'default' && 'border-ink-600 bg-ink-800',
                )}
              >
                <action.icon
                  className={cn(
                    // نصف سطرٍ نزولًا ليحاذي أوّل حرفٍ من العنوان لا وسط الفقرة
                    'mt-0.5 size-4 shrink-0 sm:mt-0',
                    action.tone === 'danger' && 'text-danger',
                    action.tone === 'gold' && 'text-gold-500',
                    action.tone === 'default' && 'text-muted',
                  )}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-bold">{action.title}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                    {action.body}
                  </span>
                </span>
                <Button
                  asChild
                  size="sm"
                  variant="secondary"
                  className="col-start-2 justify-self-start sm:col-start-3"
                >
                  <Link href={action.href}>{action.cta}</Link>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* الأرقام */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          href="/account/listings"
          icon={LayoutList}
          label="لوحاتي المعروضة"
          value={String(listings.filter((l) => l.status === 'active').length)}
        />
        <StatCard
          href="/account/bids"
          icon={Gavel}
          label="مزايدات أنت الأعلى فيها"
          value={String(leadingBids.length)}
          accent
        />
        <StatCard
          href="/account/purchases"
          icon={ShoppingBag}
          label="مشترياتي"
          value={String(purchases.length)}
        />
        <StatCard
          href="/account/sales"
          icon={Store}
          label="إجمالي مبيعاتي"
          value={formatAmount(
            sales.filter((o) => o.status !== 'cancelled').reduce((sum, o) => sum + o.amount, 0),
          )}
          suffix="ريال"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* مزادات أنت فيها */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold">مزادات أنت فيها</h2>
            <Link href="/account/bids" className="text-xs font-semibold text-gold-500 hover:underline">
              الكل
            </Link>
          </div>
          {liveBids.length === 0 ? (
            <EmptyState
              icon={Gavel}
              title="لم تزايد على لوحة بعد"
              body="تصفّح المزادات الجارية وابدأ المزايدة."
              href="/market?sale=auction"
              cta="المزادات الجارية"
            />
          ) : (
            <ul className="space-y-2">
              {liveBids.map((bid) => (
                <li
                  key={bid.listingId}
                  className="surface flex items-center gap-3 rounded-2xl p-3"
                >
                  <Link href={`/market/${bid.listingId}`} className="w-[92px] shrink-0">
                    <PlateThumb plate={bid.plate} />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold">
                      {bid.plate.arabicLetters} {bid.plate.plateNumbers}
                      <Badge variant={bid.isHighest ? 'success' : 'danger'}>
                        {bid.isHighest ? 'أنت الأعلى' : 'تجاوزك غيرك'}
                      </Badge>
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      مزايدتك {formatAmount(bid.myHighest)} · الحالية{' '}
                      {formatAmount(bid.currentHighest ?? bid.myHighest)}
                    </p>
                    {/*
                      * عدّاد حيّ لا صورة عدّاد.
                      *
                      * كان يُمرَّر `frozenMs` — وهو للمزاد المنتهي: يضبط القيمة
                      * ويُنهي بلا `setInterval`. فيرى صاحب مزاد جارٍ رقمًا
                      * بشكل العدّاد ولونه لا يتحرّك، ويظنّ أمامه وقتًا مضى.
                      */}
                    {bid.endsAt && (
                      <CompactCountdown
                        endsAt={bid.endsAt}
                        serverTime={serverTime}
                        className="mt-1.5"
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* آخر الإشعارات */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold">آخر التنبيهات</h2>
            {notifications.unread > 0 && (
              <Badge variant="danger">{notifications.unread} غير مقروء</Badge>
            )}
          </div>
          {notifications.items.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="لا تنبيهات بعد"
              body="سنُنبّهك عند تجاوزك في مزاد أو وصول عرض على لوحتك."
              href="/market"
              cta="تصفّح السوق"
            />
          ) : (
            <ul className="surface divide-y divide-ink-600/60 overflow-hidden rounded-2xl">
              {notifications.items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href ?? '/account'}
                    className={cn(
                      'block px-4 py-3 transition-colors hover:bg-ink-700/50',
                      !item.readAt && 'bg-gold-500/[0.05]',
                    )}
                  >
                    <p className="flex items-center gap-2 text-sm font-bold">
                      {!item.readAt && <span className="size-1.5 rounded-full bg-gold-500" />}
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">{item.body}</p>
                    <p className="mt-1 text-[11px] text-muted">
                      {formatTimestamp(item.createdAt)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function PlateThumb({ plate }: { plate: Plate }) {
  return (
    <span className="flex aspect-[16/7] items-center justify-center overflow-hidden rounded-lg bg-ink-700/45 p-1">
      <SaudiLicensePlate {...plate} size="fill" showReflection={false} />
    </span>
  )
}

function StatCard({
  href,
  icon: Icon,
  label,
  value,
  suffix,
  accent,
}: {
  href: string
  icon: React.ElementType
  label: string
  value: string
  suffix?: string
  accent?: boolean
}) {
  return (
    <Link
      href={href}
      className="surface group rounded-2xl p-4 transition-colors hover:border-gold-600/50"
    >
      <span className="mb-2 flex size-8 items-center justify-center rounded-lg border border-ink-600 bg-ink-900 text-muted transition-colors group-hover:text-gold-500">
        <Icon className="size-4" />
      </span>
      <span
        className={cn(
          'block text-2xl font-extrabold tabular-nums',
          accent ? 'text-gold-500' : 'text-paper',
        )}
      >
        {value}
        {suffix && <span className="ms-1 text-xs font-normal text-muted">{suffix}</span>}
      </span>
      <span className="mt-0.5 block text-xs text-muted">{label}</span>
    </Link>
  )
}

function EmptyState({
  icon: Icon,
  title,
  body,
  href,
  cta,
}: {
  icon: React.ElementType
  title: string
  body: string
  href: string
  cta: string
}) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-600 bg-ink-800/40 p-8 text-center">
      <Icon className="mx-auto mb-2 size-6 text-muted" />
      <p className="text-sm font-bold">{title}</p>
      <p className="mt-1 text-xs text-muted">{body}</p>
      <Button asChild size="sm" variant="secondary" className="mt-3">
        <Link href={href}>{cta}</Link>
      </Button>
    </div>
  )
}
