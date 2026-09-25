import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { PageShell } from '@/components/layout/page-shell'
import { SiteHeader } from '@/components/layout/site-header'
import { SaudiLicensePlate } from '@/components/plate/SaudiLicensePlate'
import { CheckoutForm } from '@/components/market/checkout-form'
import { formatAmount } from '@/lib/domain/money'
import { OrderSettlementCard } from '@/components/market/order-timeline'
import { OrderJourney, OrderStageCallout } from '@/components/market/order-journey'
import { currentOrderStage, orderMoneyMarker } from '@/lib/domain/order-timeline'
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

        {/*
          * خطُّ المراحل — **أين نحن من الصفقة كلِّها**.
          *
          * ونداءُ المرحلة فوقه يقول ما المطلوب الآن، وهذا يقول ما قبله وما
          * بعده. فمن يدفع يرى أنّ الدفع محطّةٌ من خمس لا نهايةَ الطريق —
          * فلا يسأل بعده «وماذا الآن؟».
          */}
        {!done && (
          <div className="mb-5">
            <OrderJourney
              steps={order.timeline}
              money={orderMoneyMarker(order, 'buyer')}
            />
          </div>
        )}

        {/*
          * **الرقمُ قبل الوسيلة، واللوحةُ صغيرةٌ لا تتصدّر.**
          *
          * وكان الفعلُ فوق الطيّة بحجّةٍ صحيحة: مهمّةُ الصفحة السدادُ لا
          * تأمّلُ اللوحة — فلا تُصدَّر بلوحةٍ ملءَ الشاشة. لكنّ تفصيلَ
          * المبلغ ليس تأمّلًا، هو **الرقمُ الذي يُدفع**: من أين جاء ٣٤٬٠٠٠،
          * وكم خُصم من عربونه. فكان يُقرأ بعد اختيار الوسيلة، والترتيبُ
          * الطبيعيّ: ما أشتري، بكم، ثمّ كيف أدفع.
          *
          * فصغُرت اللوحةُ على الجوّال وصعد التفصيلُ فوق النموذج، وبقيت
          * الحجّةُ الأولى قائمة: لا شيءَ كبيرٌ يسبق العمل.
          */}
        <div className="grid gap-5 pb-28 lg:grid-cols-[1fr_1.1fr] lg:items-start lg:pb-0">
          <div className="order-1 space-y-4 lg:order-none">
            <div className="rounded-2xl border border-ink-600 bg-ink-700/45 p-3.5 lg:p-5">
              <SaudiLicensePlate
                {...order.plate}
                size="fullscreen"
                className="mx-auto w-[190px] lg:w-full"
              />
            </div>
            <OrderSettlementCard settlement={order.settlement} status={order.status} />
          </div>

          <div className="order-2 space-y-4 lg:order-none">
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
      {/*
        * ولا تذييلَ هنا.
        *
        * صفحةُ السداد مهمّةٌ واحدة، وتذييلُ الموقع يعرض «من نحن» و«تسجيل
        * الدخول» و«الأسئلة الشائعة» تحت زرِّ الدفع — روابطُ خروجٍ في أضيق
        * موضعٍ يحتمل الخروج. وهي في المرجع صفحةٌ مغلقة، وكذلك تكون.
        */}
    </PageShell>
  )
}
