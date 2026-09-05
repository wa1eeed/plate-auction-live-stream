import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CreditCard,
  Gavel,
  LayoutList,
  Receipt,
  ShieldAlert,
  Wallet,
} from 'lucide-react'
import { AdminHeader, AdminTable, Money, Td, Tr } from '@/components/admin/admin-ui'
import { WalletActions } from '@/components/admin/wallet-actions'
import { StatementTable } from '@/components/market/statement-table'
import { LocalTime, LocalZoneNote } from '@/components/market/local-time'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SaudiLicensePlate } from '@/components/plate/SaudiLicensePlate'
import {
  DEPOSIT_STATUS_LABELS,
  LISTING_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  SALE_TYPE_LABELS,
} from '@/lib/domain/types'
import { REFERENCE_LABELS } from '@/lib/domain/reference'
import { UserEditDialog } from '@/components/admin/user-edit-dialog'
import { ReferenceChip } from '@/components/market/reference-chip'
import { ContactCard } from '@/components/admin/contact-card'
import { formatAmount } from '@/lib/domain/money'
import { buildStatement } from '@/lib/domain/wallet'
import { getUserDetail } from '@/lib/server/admin-service'
import { requireAdminId } from '@/lib/server/require-admin'
import { isServiceError } from '@/lib/server/market-service'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'ملفّ المستخدم' }

/**
 * ملفّ المستخدم — نظرة 360°.
 *
 * يجمع في صفحة واحدة كل ما يمسّ هذا المستخدم: ماله، ونشاطه بيعًا وشراءً
 * ومزايدةً، وعرابينه، ومدفوعاته، وتنبيهاته. الأدمن الذي يتحقّق من شكوى أو
 * يقرّر مصادرة يحتاج الصورة كاملة لا جدولًا واحدًا.
 */
export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminId()
  const { id } = await params

  let detail
  try {
    detail = await getUserDetail(id)
  } catch (error) {
    if (isServiceError(error) && error.status === 404) notFound()
    throw error
  }

  const { user, wallet, ledger, deposits, listings, purchases, sales, bids, payments, notifications, summary } =
    detail
  const statement = buildStatement(ledger, {
    userId: user.id,
    balance: wallet.balance,
    held: wallet.held,
    updatedAt: user.createdAt,
  })

  const flags = [
    summary.overdueOrders > 0 && {
      tone: 'danger' as const,
      text: `${summary.overdueOrders} صفقة تجاوزت مهلة السداد`,
    },
    summary.defaultedOrders > 0 && {
      tone: 'danger' as const,
      text: `${summary.defaultedOrders} تخلّف عن السداد`,
    },
    summary.forfeitedTotal > 0 && {
      tone: 'danger' as const,
      text: `مصادرات بقيمة ${formatAmount(summary.forfeitedTotal)} ريال من عرابينه`,
    },
    wallet.available <= 0 &&
      wallet.balance > 0 && { tone: 'gold' as const, text: 'رصيده المتاح صفر — كلّه محجوز' },
  ].filter(Boolean) as { tone: 'danger' | 'gold'; text: string }[]

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ms-2">
        <Link href="/admin/users">
          <ArrowRight className="size-3.5" />
          كل المستخدمين
        </Link>
      </Button>

      <AdminHeader
        title={user.displayName}
        description={`${user.email}${user.city ? ` · ${user.city}` : ''}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <UserEditDialog user={user} />
            <WalletActions userId={user.id} />
          </div>
        }
      />

      {/* رقم العضوية بارزًا لا مدفونًا في سطر: هو ما يُقتبَس في كل مراسلة عن
          هذا الحساب، وما يحمله الرابط في شريط العنوان */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <ReferenceChip reference={user.reference} kind="user" />
        <span className="text-xs text-muted">
          {REFERENCE_LABELS.user} — اقتبسه في أي مراسلة عن هذا الحساب
        </span>
      </div>

      <ContactCard phone={user.phone} social={user.social} className="mb-5" />

      {flags.length > 0 && (
        <ul className="mb-5 flex flex-wrap gap-2">
          {flags.map((flag) => (
            <li
              key={flag.text}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold',
                flag.tone === 'danger'
                  ? 'border-danger/50 bg-danger/10 text-danger'
                  : 'border-gold-600/50 bg-gold-500/10 text-gold-500',
              )}
            >
              <AlertTriangle className="size-3.5" />
              {flag.text}
            </li>
          ))}
        </ul>
      )}

      {/* المحفظة */}
      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        <WalletCard label="الرصيد الكلي" value={wallet.balance} icon={Wallet} />
        <WalletCard label="محجوز كعرابين" value={wallet.held} icon={ShieldAlert} tone="gold" />
        <WalletCard label="المتاح للاستعمال" value={wallet.available} tone="success" icon={Wallet} />
      </section>

      {/* مؤشّرات موجزة */}
      <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="أنفق (صفقات مكتملة)" value={formatAmount(summary.totalSpent)} suffix="ريال" />
        <Metric label="حصّل (مبيعات مكتملة)" value={formatAmount(summary.totalEarned)} suffix="ريال" tone="success" />
        <Metric label="شُحن لمحفظته" value={formatAmount(summary.topupTotal)} suffix="ريال" />
        <Metric
          label="مزايدات جارية"
          value={String(summary.activeBids)}
          hint={`${summary.leadingBids} هو الأعلى فيها`}
          tone="gold"
        />
      </section>

      <Tabs defaultValue="activity">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="activity">
            <Gavel className="size-3.5" />
            النشاط
          </TabsTrigger>
          <TabsTrigger value="money">
            <Wallet className="size-3.5" />
            المال
          </TabsTrigger>
          <TabsTrigger value="listings">
            <LayoutList className="size-3.5" />
            لوحاته ({listings.length})
          </TabsTrigger>
          <TabsTrigger value="orders">
            <Receipt className="size-3.5" />
            صفقاته ({purchases.length + sales.length})
          </TabsTrigger>
        </TabsList>

        {/* النشاط: المزايدات والتنبيهات */}
        <TabsContent value="activity" className="space-y-6">
          <section>
            <h2 className="mb-2 text-sm font-bold">مزايداته</h2>
            <AdminTable
              empty="لم يزايد على أي لوحة."
              minWidth="44rem"
              columns={[
                { label: 'اللوحة', width: '28%', minWidth: '9rem' },
                { label: 'أعلى مزايدة له', numeric: true, width: '18%', minWidth: '8rem' },
                { label: 'الأعلى حاليًا', numeric: true, width: '18%', minWidth: '8rem' },
                { label: 'موقفه', width: '18%', minWidth: '7rem' },
                { label: 'حالة الإعلان', width: '18%', minWidth: '7rem' },
              ]}
            >
              {bids.map((bid) => (
                <Tr key={bid.listingId}>
                  <Td>
                    <Link href={`/admin/listings/${bid.listingId}`} className="font-bold hover:underline">
                      {bid.plateLabel}
                    </Link>
                  </Td>
                  <Td numeric>
                    <Money value={bid.myHighest} className="text-sm" />
                  </Td>
                  <Td numeric>
                    {bid.currentHighest ? (
                      <Money value={bid.currentHighest} className="text-sm" />
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </Td>
                  <Td>
                    <Badge variant={bid.isHighest ? 'success' : 'muted'}>
                      {bid.isHighest ? 'الأعلى' : 'تجاوزه غيره'}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge variant={bid.listingStatus === 'active' ? 'gold' : 'muted'}>
                      {LISTING_STATUS_LABELS[bid.listingStatus]}
                    </Badge>
                  </Td>
                </Tr>
              ))}
            </AdminTable>
          </section>

          <section>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold">
              <Bell className="size-4 text-muted" />
              آخر تنبيهاته
            </h2>
            {notifications.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-ink-600 bg-ink-800/40 p-8 text-center text-sm text-muted">
                لا تنبيهات.
              </p>
            ) : (
              <ul className="surface divide-y divide-ink-600/60 overflow-hidden rounded-2xl">
                {notifications.map((item) => (
                  <li key={item.id} className="px-4 py-3">
                    <p className="flex items-center gap-2 text-sm font-bold">
                      {!item.readAt && <span className="size-1.5 rounded-full bg-gold-500" />}
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">{item.body}</p>
                    <LocalTime iso={item.createdAt} mode="datetime" className="mt-1 block text-[11px] text-muted" />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </TabsContent>

        {/* المال: الكشف والعرابين والمدفوعات */}
        <TabsContent value="money" className="space-y-6">
          <section>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold">كشف الحساب</h2>
              <LocalZoneNote />
            </div>
            <StatementTable statement={statement} />
          </section>

          <section>
            <h2 className="mb-2 text-sm font-bold">العرابين</h2>
            <AdminTable
              empty="لا عرابين."
              minWidth="46rem"
              columns={[
                { label: 'اللوحة', width: '18%', minWidth: '8rem' },
                { label: 'المبلغ', numeric: true, width: '16%', minWidth: '7.5rem' },
                { label: 'الحالة', width: '16%', minWidth: '7rem' },
                { label: 'التاريخ', width: '22%', minWidth: '10rem' },
                { label: 'السبب', width: '28%', minWidth: '10rem' },
              ]}
            >
              {deposits.map((deposit) => (
                <Tr key={deposit.id}>
                  <Td className="font-bold">{deposit.plateLabel}</Td>
                  <Td numeric>
                    <Money value={deposit.amount} className="text-sm" />
                  </Td>
                  <Td>
                    <Badge
                      variant={
                        deposit.status === 'held'
                          ? 'gold'
                          : deposit.status === 'forfeited'
                            ? 'danger'
                            : 'muted'
                      }
                    >
                      {DEPOSIT_STATUS_LABELS[deposit.status]}
                    </Badge>
                  </Td>
                  <Td className="text-xs text-muted">
                    <LocalTime iso={deposit.createdAt} mode="datetime" />
                  </Td>
                  <Td className="text-xs text-muted">{deposit.reason ?? '—'}</Td>
                </Tr>
              ))}
            </AdminTable>
          </section>

          <section>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold">
              <CreditCard className="size-4 text-muted" />
              عمليات الشحن
            </h2>
            <AdminTable
              empty="لا عمليات دفع."
              minWidth="44rem"
              columns={[
                { label: 'المرجع', width: '24%', minWidth: '9rem' },
                { label: 'المبلغ', numeric: true, width: '18%', minWidth: '7.5rem' },
                { label: 'الطريقة', width: '18%', minWidth: '7rem' },
                { label: 'الحالة', width: '16%', minWidth: '6.5rem' },
                { label: 'التاريخ', width: '24%', minWidth: '10rem' },
              ]}
            >
              {payments.map((payment) => (
                <Tr key={payment.id}>
                  <Td className="font-bold tabular-nums">{payment.reference}</Td>
                  <Td numeric>
                    <Money value={payment.amount} className="text-sm" />
                  </Td>
                  <Td className="text-xs">{PAYMENT_METHOD_LABELS[payment.method]}</Td>
                  <Td>
                    <Badge
                      variant={
                        payment.status === 'paid'
                          ? 'success'
                          : payment.status === 'failed'
                            ? 'danger'
                            : 'muted'
                      }
                    >
                      {PAYMENT_STATUS_LABELS[payment.status]}
                    </Badge>
                  </Td>
                  <Td className="text-xs text-muted">
                    <LocalTime iso={payment.createdAt} mode="datetime" />
                  </Td>
                </Tr>
              ))}
            </AdminTable>
          </section>
        </TabsContent>

        {/* لوحاته */}
        <TabsContent value="listings">
          <AdminTable
            empty="لم يعرض أي لوحة."
            minWidth="56rem"
            columns={[
              { label: 'اللوحة', width: '10rem', minWidth: '10rem' },
              { label: 'الطريقة', width: '12%', minWidth: '6rem' },
              { label: 'الحالة', width: '12%', minWidth: '6.5rem' },
              { label: 'مزايدات', numeric: true, width: '10%', minWidth: '5.5rem' },
              { label: 'أعلى مزايدة', numeric: true, width: '16%', minWidth: '8rem' },
              { label: 'الاحتياطي', numeric: true, width: '16%', minWidth: '8rem' },
              { label: 'العربون', numeric: true, width: '16%', minWidth: '8rem' },
            ]}
          >
            {listings.map((listing) => (
              <Tr key={listing.id}>
                <Td>
                  <Link href={`/admin/listings/${listing.id}`} className="block w-[120px]">
                    <span className="flex aspect-[16/7] items-center justify-center rounded-lg bg-ink-700/45 p-1.5">
                      <SaudiLicensePlate {...listing.plate} size="fill" showReflection={false} />
                    </span>
                  </Link>
                </Td>
                <Td className="text-xs">{SALE_TYPE_LABELS[listing.saleType]}</Td>
                <Td>
                  <Badge variant={listing.status === 'active' ? 'success' : 'muted'}>
                    {LISTING_STATUS_LABELS[listing.status]}
                  </Badge>
                </Td>
                <Td numeric>{listing.bidCount}</Td>
                <Td numeric>
                  {listing.highestAmount ? (
                    <Money value={listing.highestAmount} className="text-sm" />
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </Td>
                <Td numeric>
                  {listing.reservePrice > 0 ? (
                    <Money value={listing.reservePrice} className="text-sm" />
                  ) : (
                    <span className="text-muted">بلا</span>
                  )}
                </Td>
                <Td numeric>
                  {listing.depositAmount > 0 ? (
                    <Money value={listing.depositAmount} className="text-sm text-gold-500" />
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </Td>
              </Tr>
            ))}
          </AdminTable>
        </TabsContent>

        {/* صفقاته */}
        <TabsContent value="orders" className="grid gap-6 xl:grid-cols-2">
          <OrderSection title="مشترياته" orders={purchases} side="seller" />
          <OrderSection title="مبيعاته" orders={sales} side="buyer" />
        </TabsContent>
      </Tabs>
    </>
  )
}

function WalletCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string
  value: number
  icon: React.ElementType
  tone?: 'gold' | 'success'
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-4',
        tone === 'gold'
          ? 'border-gold-600/40 bg-gold-500/[0.07]'
          : tone === 'success'
            ? 'border-success/40 bg-success/[0.07]'
            : 'surface',
      )}
    >
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
        <Icon className="size-3.5" />
        {label}
      </p>
      <Money
        value={value}
        className={cn(
          'mt-1 block text-2xl',
          tone === 'gold' && 'text-gold-500',
          tone === 'success' && 'text-success',
        )}
      />
    </div>
  )
}

function Metric({
  label,
  value,
  suffix,
  hint,
  tone,
}: {
  label: string
  value: string
  suffix?: string
  hint?: string
  tone?: 'gold' | 'success'
}) {
  return (
    <div className="surface rounded-2xl p-4">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p
        className={cn(
          'mt-1 text-xl font-extrabold tabular-nums',
          tone === 'gold' && 'text-gold-500',
          tone === 'success' && 'text-success',
        )}
      >
        {value}
        {suffix && <span className="ms-1 text-xs font-normal text-muted">{suffix}</span>}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-muted">{hint}</p>}
    </div>
  )
}

function OrderSection({
  title,
  orders,
  side,
}: {
  title: string
  orders: Awaited<ReturnType<typeof getUserDetail>>['purchases']
  side: 'buyer' | 'seller'
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-bold">{title}</h2>
      <AdminTable
        empty="لا صفقات."
        minWidth="42rem"
        columns={[
          { label: 'اللوحة', width: '20%', minWidth: '7rem' },
          { label: side === 'seller' ? 'البائع' : 'المشتري', width: '22%', minWidth: '8rem' },
          { label: 'المبلغ', numeric: true, width: '18%', minWidth: '7.5rem' },
          { label: 'مهلة السداد', width: '24%', minWidth: '10rem' },
          { label: 'الحالة', width: '16%', minWidth: '7rem' },
        ]}
      >
        {orders.map((order) => (
          <Tr key={order.id}>
            <Td className="font-bold">
              {order.plate.arabicLetters} {order.plate.plateNumbers}
            </Td>
            <Td className="text-xs">{order.counterpartName}</Td>
            <Td numeric>
              <Money value={order.amount} className="text-sm" />
            </Td>
            <Td className="text-xs text-muted">
              {order.paymentDueAt ? <LocalTime iso={order.paymentDueAt} mode="datetime" /> : '—'}
            </Td>
            <Td>
              <Badge
                variant={
                  order.status === 'completed'
                    ? 'success'
                    : order.status === 'defaulted' || order.overdue
                      ? 'danger'
                      : 'muted'
                }
              >
                {order.overdue && order.status === 'awaiting_settlement'
                  ? 'تجاوزت المهلة'
                  : ORDER_STATUS_LABELS[order.status]}
              </Badge>
            </Td>
          </Tr>
        ))}
      </AdminTable>
    </section>
  )
}
