import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { PageShell } from '@/components/layout/page-shell'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { SaudiLicensePlate } from '@/components/plate/SaudiLicensePlate'
import { CheckoutForm } from '@/components/market/checkout-form'
import { formatAmount } from '@/lib/domain/money'
import { OrderSettlementCard } from '@/components/market/order-timeline'
import { OrderStageCallout } from '@/components/market/order-journey'
import { currentOrderStage } from '@/lib/domain/order-timeline'
import { ReferenceChip } from '@/components/market/reference-chip'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ORDER_STATUS_LABELS } from '@/lib/domain/types'
import { getCheckoutView } from '@/lib/server/checkout-service'
import { requireUserId } from '@/lib/server/require-user'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'إتمام السداد' }

export default async function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId()
  const { id } = await params
  const view = await getCheckoutView(id, userId).catch(() => null)
  if (!view) notFound()

  const { order, plateLabel, sellerName, methods } = view
  const done = order.paidAt !== null

  return (
    <PageShell>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        <Button asChild variant="ghost" size="sm" className="mb-3">
          <Link href="/account/purchases">
            <ArrowRight className="size-4" />
            مشترياتي
          </Link>
        </Button>

        <header className="mb-6">
          <h1 className="text-2xl font-extrabold sm:text-3xl">إتمام السداد</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>
              {plateLabel} · البائع {sellerName}
            </span>
            <ReferenceChip reference={order.reference} kind="order" />
            <Badge variant={done ? 'success' : 'gold'}>{ORDER_STATUS_LABELS[order.status]}</Badge>
          </p>
        </header>

        {/*
          * المهلة تُقال على الشاشة التي يُنفَّذ فيها الالتزام.
          *
          * صفحة اللوحة وعدت المزايد بمهلة السداد صراحةً، ثم كانت تُخفى هنا —
          * فيقف أمام مبلغٍ بعشرات الآلاف بلا تاريخ ولا عاقبة تأخير. ونداء
          * المرحلة يحمل العدّاد أصلًا.
          */}
        {!done && (
          <div className="mb-5">
            <OrderStageCallout
              {...currentOrderStage(order.timeline, order, 'buyer')}
              serverTime={new Date().toISOString()}
            />
          </div>
        )}

        {/* الفعل فوق الطيّة على الجوال: مهمّة الصفحة السداد لا تأمّل اللوحة */}
        <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr] lg:items-start">
          <div className="order-2 space-y-4 lg:order-none">
            <div className="rounded-2xl border border-ink-600 bg-ink-700/45 p-5">
              <SaudiLicensePlate {...order.plate} size="fullscreen" />
            </div>
            <OrderSettlementCard settlement={order.settlement} status={order.status} />
          </div>

          <div className="order-1 space-y-4 lg:order-none">
            {done ? (
              <div className="rounded-2xl border border-success/50 bg-success-soft p-5 text-center">
                <ShieldCheck className="mx-auto mb-2 size-9 text-success" />
                <p className="font-extrabold text-success">وصل مبلغك وحُجز أمانةً</p>
                <Button asChild className="mt-4">
                  <Link href={`/checkout/${order.id}/thanks`}>عرض الإيصال</Link>
                </Button>
              </div>
            ) : (
              <>
                <CheckoutForm
                  orderId={order.id}
                  methods={methods}
                  due={order.settlement.net}
                  bank={view.payment.bank}
                />
                {/* وعاقبة التأخير تُقال قبل الضغط لا بعده */}
                {order.settlement.deposit > 0 && (
                  <p className="rounded-xl border border-ink-600 bg-ink-900/50 p-3 text-[11px] leading-relaxed text-muted">
                    إن انقضت المهلة بلا سداد جاز للإدارة إلغاء الصفقة ومصادرة عربونك المحجوز
                    ({formatAmount(order.settlement.deposit)} ريال) وإعادة إرساء اللوحة على المزايد
                    الذي يليك.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </PageShell>
  )
}
