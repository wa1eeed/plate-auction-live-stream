import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CheckCircle2, Clock3, Receipt } from 'lucide-react'
import { PageShell } from '@/components/layout/page-shell'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { SaudiLicensePlate } from '@/components/plate/SaudiLicensePlate'
import { OrderSettlementCard } from '@/components/market/order-timeline'
import { OrderJourney, OrderStageCallout } from '@/components/market/order-journey'
import { currentOrderStage, orderMoneyMarker } from '@/lib/domain/order-timeline'
import { PendingPayments } from '@/components/market/pending-payments'
import { ReferenceChip } from '@/components/market/reference-chip'
import { Button } from '@/components/ui/button'
import { getCheckoutView } from '@/lib/server/checkout-service'
import { requireUserId } from '@/lib/server/require-user'
import { syncTapPayment } from '@/lib/server/payment-service'
import { getStore } from '@/lib/store'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'تمّ استلام سدادك' }

/**
 * صفحة الشكر.
 *
 * تفرّق بين **سُدّد** و**بدأ السداد**: الدفع من المحفظة يُتمّ الصفقة فورًا،
 * أمّا البطاقة والحوالة فتنتظران ردّ البوابة أو تحقّق الإدارة — وإخبار المشتري
 * بأن صفقته تمّت وهي معلّقة يجعله يظنّ اللوحة ملكه.
 */
export default async function ThanksPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ ref?: string; tap_id?: string }>
}) {
  const userId = await requireUserId()
  const [{ id }, { ref, tap_id: chargeId }] = await Promise.all([params, searchParams])

  /*
   * العودة من البوابة لا تعني الدفع.
   *
   * نقرأ الحالة من Tap مباشرة **قبل** بناء الصفحة، فمن يفتح هذا الرابط يدويًا
   * لا يُسوّي صفقته. و`tap_id` دليلٌ للعثور على العملية لا إثبات لنتيجتها.
   */
  if (chargeId) {
    const found = await getStore().findPaymentByCharge(chargeId)
    if (found && found.userId === userId && found.orderId === id) {
      await syncTapPayment(found.id).catch(() => null)
    }
  }

  const view = await getCheckoutView(id, userId).catch(() => null)
  if (!view) notFound()

  const { order, plateLabel } = view
  // «وصل» لا «اكتمل»: المال يُحجز أمانةً، والصفقة تكتمل بالإفراج بعد نقل الملكية
  const captured = order.paidAt !== null

  /*
   * ثلاث حالات لا اثنتان.
   *
   * كانت الصفحة تقول لمن اختار الحوالة «استلمنا طلب سدادك — عمليتك قيد
   * المعالجة»، ولم يُستلم شيء ولا يُعالَج شيء: الحوالة تُنشأ `awaiting_transfer`
   * والمشتري هو من يحوّل بنفسه. فمن يقرأ ذلك يغلق الصفحة مطمئنًّا وتنقضي مهلته.
   */
  const payment = ref ? await getStore().findPaymentByReference(ref) : null
  const awaitingTransfer =
    !captured && payment?.method === 'bank_transfer' && payment.status === 'awaiting_transfer'

  return (
    <PageShell>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <div className="mb-6 text-center">
          <span
            className={
              captured
                ? 'mx-auto flex size-16 items-center justify-center rounded-full border border-success/50 bg-success/10 text-success'
                : 'mx-auto flex size-16 items-center justify-center rounded-full border border-gold-600/50 bg-gold-500/10 text-gold-500'
            }
          >
            {captured ? <CheckCircle2 className="size-8" /> : <Clock3 className="size-8" />}
          </span>
          <h1 className="mt-4 text-2xl font-extrabold sm:text-3xl">
            {captured
              ? 'تمّ سدادك بنجاح'
              : awaitingTransfer
                ? 'بقي أن تحوّل المبلغ'
                : 'استلمنا طلب سدادك'}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
            {captured
              ? `مبلغ «${plateLabel}» محفوظ لدى المنصّة، ولا يصل البائع إلا بعد نقل الملكية وتحقّق الإدارة منها.`
              : awaitingTransfer
                ? `لم يصلنا مبلغ «${plateLabel}» بعد. حوّله إلى حساب المنصّة بالبيانات أدناه واكتب الرقم المرجعي في ملاحظات الحوالة، ثم بلّغنا برقم عمليتك.`
                : `عمليتك قيد المعالجة. يُحجز مبلغ «${plateLabel}» أمانةً فور اعتماد السداد.`}
          </p>
          {ref && (
            <p className="mt-3 flex items-center justify-center gap-2 text-xs text-muted">
              رقم العملية
              <ReferenceChip reference={ref} kind="payment" />
            </p>
          )}
        </div>

        {/*
          * ومن بقي عليه أن يحوّل يجد هنا ما يحوّل به — لا في صفحة أخرى.
          * المكوّن نفسه المستعمل في المحفظة: بيانات الحساب بأزرار نسخ، والرقم
          * المرجعي، وبلاغ رقم العملية.
          */}
        {awaitingTransfer && payment && (
          <PendingPayments payments={[payment]} options={view.payment} />
        )}

        <div className="mb-5 rounded-2xl border border-ink-600 bg-ink-700/45 p-5">
          <div className="mx-auto w-full max-w-sm">
            <SaudiLicensePlate {...order.plate} size="fullscreen" />
          </div>
        </div>

        {/*
          * أوّل ما يفتحه المشتري بعد أن غادر ماله يده: أين هو الآن، وأين ماله.
          * فالمسار هنا كما في صفحة الإعلان — نداءٌ ثم سكّة ثم تفصيل — لا قائمة
          * رأسية بخطّ 11px بجانب الأرقام.
          */}
        <div className="mb-4 space-y-3">
          <OrderStageCallout
            {...currentOrderStage(order.timeline, order, 'buyer')}
            serverTime={new Date().toISOString()}
          />
          <div className="rounded-xl border border-ink-600 bg-ink-900/50 p-3.5 pt-4">
            <OrderJourney steps={order.timeline} money={orderMoneyMarker(order, 'buyer')} />
          </div>
        </div>

        <OrderSettlementCard settlement={order.settlement} status={order.status} />

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {/*
            * الرابط يحمل القسم الذي صارت فيه المعاملة.
            *
            * من سدّد للتوّ تنتقل صفقته إلى «تحت الإجراء»، فلو فُتحت الصفحة على
            * «بانتظار ردّك» لبحث عنها ولم يجدها — والعدّاد وحده لا يكفي لمن
            * جاء من صفحة الشكر يتوقّع أن يراها.
            */}
          <Button asChild size="lg">
            <Link href={captured ? '/account/purchases?stage=running' : '/account/purchases'}>
              <Receipt className="size-4" />
              عرض الطلب
            </Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href={`/market/${order.listingId}`}>صفحة اللوحة</Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </PageShell>
  )
}
