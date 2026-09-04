import Link from 'next/link'
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Banknote,
  Building2,
  Clock3,
  FileText,
  Gavel,
  Handshake,
  Landmark,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react'
import { AdminHeader, MetricCard, MetricGroup, Money } from '@/components/admin/admin-ui'
import { TrustPanel } from '@/components/admin/trust-panel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatAmount } from '@/lib/domain/money'
import { getMetrics, listAdminOrders } from '@/lib/server/admin-service'
import { requireAdminId } from '@/lib/server/require-admin'
import { formatTimestamp } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'المؤشرات' }

export default async function AdminDashboard() {
  await requireAdminId()
  const [metrics, orders] = await Promise.all([getMetrics(), listAdminOrders()])
  const overdue = orders.filter((order) => order.overdue).slice(0, 6)
  const depositShare = metrics.walletBalance
    ? Math.round((metrics.heldDeposits / metrics.walletBalance) * 100)
    : 0

  return (
    <>
      <AdminHeader
        title="مؤشرات المنصّة"
        description="صورة واحدة عن النشاط والأموال والالتزامات."
      />

      {/* الأمانة والإيراد قبل العدّادات: هما ما يُسأل عنه أوّلًا */}
      <div className="mb-6">
        <TrustPanel metrics={metrics} />
      </div>

      <MetricGroup title="النشاط">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="المستخدمون"
            value={String(metrics.users)}
            icon={Users}
            href="/admin/users"
          />
          <MetricCard
            label="الإعلانات"
            value={String(metrics.listings)}
            icon={FileText}
            hint={`${metrics.activeListings} معروضة`}
            share={metrics.listings ? metrics.activeListings / metrics.listings : 0}
            href="/admin/listings"
          />
          <MetricCard
            label="مزادات جارية"
            value={String(metrics.liveAuctions)}
            tone="gold"
            icon={Gavel}
            href="/admin/listings"
          />
          <MetricCard label="مزايدات مقبولة" value={String(metrics.bids)} icon={Handshake} />
        </div>
      </MetricGroup>

      <MetricGroup title="الأموال" tone="success">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="إجمالي المبيعات المكتملة"
            value={formatAmount(metrics.grossSales)}
            tone="success"
            icon={Banknote}
            hint="ريال"
            href="/admin/orders"
          />
          <MetricCard
            label="أرصدة المحافظ"
            value={formatAmount(metrics.walletBalance)}
            icon={Wallet}
            hint="ريال — مجموع أرصدة المستخدمين"
            href="/admin/transactions"
          />
          <MetricCard
            label="عرابين محجوزة"
            value={formatAmount(metrics.heldDeposits)}
            tone="gold"
            icon={ShieldCheck}
            hint={`ريال — ${depositShare}٪ من أرصدة المحافظ`}
            share={metrics.walletBalance ? metrics.heldDeposits / metrics.walletBalance : 0}
            href="/admin/deposits"
          />
          <MetricCard
            label="حوالات بانتظار تحقّقك"
            value={String(metrics.paymentsUnderReview)}
            tone={metrics.paymentsUnderReview > 0 ? 'gold' : 'default'}
            attention={metrics.paymentsUnderReview > 0}
            icon={Building2}
            hint={`${formatAmount(metrics.paymentsUnderReviewAmount)} ريال`}
            href="/admin/payments"
          />
        </div>
      </MetricGroup>

      <MetricGroup title="الالتزامات" tone={metrics.overdueOrders > 0 ? 'danger' : 'default'}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="صفقات مفتوحة"
            value={String(metrics.openOrders)}
            icon={Clock3}
            href="/admin/orders"
          />
          <MetricCard
            label="تجاوزت مهلة السداد"
            value={String(metrics.overdueOrders)}
            tone={metrics.overdueOrders > 0 ? 'danger' : 'default'}
            attention={metrics.overdueOrders > 0}
            icon={AlertTriangle}
            hint="تستحقّ إجراءً"
            href="/admin/orders"
          />
          <MetricCard
            label="متخلّفة عن السداد"
            value={String(metrics.defaultedOrders)}
            tone={metrics.defaultedOrders > 0 ? 'danger' : 'default'}
            icon={Ban}
            href="/admin/orders"
          />
          <MetricCard
            label="إجمالي الصفقات"
            value={String(metrics.orders)}
            icon={Landmark}
            href="/admin/orders"
          />
          <MetricCard
            label="عرابين مُصادَرة"
            value={formatAmount(metrics.forfeitedDeposits)}
            tone={metrics.forfeitedDeposits > 0 ? 'danger' : 'default'}
            icon={Ban}
            hint="ريال"
            href="/admin/deposits"
          />
        </div>
      </MetricGroup>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold text-muted">يحتاج إجراءً الآن</h2>
          <div className="flex gap-1">
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/audit">
                سجلّ التدقيق
                <ArrowLeft className="size-3.5" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/orders">
                كل الصفقات
                <ArrowLeft className="size-3.5" />
              </Link>
            </Button>
          </div>
        </div>

        {overdue.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink-600 bg-ink-800/50 p-8 text-center text-sm text-muted">
            لا توجد صفقات تجاوزت مهلة السداد.
          </div>
        ) : (
          <ul className="space-y-2">
            {overdue.map((order) => (
              <li
                key={order.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-danger/40 bg-danger/[0.06] p-3"
              >
                <AlertTriangle className="size-4 shrink-0 text-danger" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">
                    {order.plate.arabicLetters} {order.plate.plateNumbers}
                    <span className="ms-2 font-normal text-muted">
                      {order.buyerName} ← {order.sellerName}
                    </span>
                  </p>
                  <p className="text-[11px] text-muted">
                    استحقّت {formatTimestamp(order.paymentDueAt)}
                  </p>
                </div>
                <Money value={order.amount} className="text-sm" />
                {order.depositStatus === 'held' && (
                  <Badge variant="gold">عربون {formatAmount(order.depositAmount)}</Badge>
                )}
                <Button asChild size="sm" variant="secondary">
                  <Link href="/admin/deposits">معالجة</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
