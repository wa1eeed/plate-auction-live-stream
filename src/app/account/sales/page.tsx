import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { OrderTabs } from '@/components/market/order-tabs'
import { formatAmount } from '@/lib/domain/money'
import { arabicCount } from '@/lib/utils'
import { getSales } from '@/lib/server/order-service'
import { getStore } from '@/lib/store'
import { requireUserId } from '@/lib/server/require-user'

export const dynamic = 'force-dynamic'

export default async function SalesPage() {
  const userId = await requireUserId()
  const orders = await getSales(userId)
  // القاعدة السارية الآن — الجملة تصف ما سيقع لا ما كان يقع
  const { seller: sellerFee } = await getStore().getCommissionSettings()
  /*
   * ثلاثة أرقام بأسمائها لا رقمٌ أخضر واحد.
   *
   * كان «إجمالي المبيعات» يجمع `amount` لكل صفقة غير ملغاة **بلون النجاح** —
   * فيقرأ بائعٌ نصفُ صفقاته لم يُسدَّد رقمًا يقول إنه قبضه، وبقيمةٍ قبل خصم
   * عمولتنا. والأخضر في هذه المنصّة لون المال الذي وقع.
   *
   * و`settlement.net` هو صافي ما يصل البائع بعد عمولته وضريبتها.
   */
  const sum = (rows: typeof orders) => rows.reduce((total, order) => total + order.settlement.net, 0)
  const received = sum(orders.filter((order) => order.status === 'completed'))
  const onTheWay = sum(
    orders.filter((order) =>
      ['escrow_held', 'ownership_transferred', 'disputed'].includes(order.status),
    ),
  )
  const awaiting = sum(orders.filter((order) => order.status === 'awaiting_settlement'))
  const pending = orders.filter((order) => order.status === 'awaiting_settlement').length

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">مبيعاتي</h1>
          <p className="mt-1 text-sm text-muted">
            {arabicCount(orders.length, {
              zero: 'لا مبيعات بعد',
              one: 'صفقة واحدة',
              two: 'صفقتان',
              few: 'صفقات',
              many: 'صفقة',
            })}
            {pending > 0 ? ` · ${pending} بانتظار السداد` : ''}
          </p>
        </div>
        {orders.length > 0 && (
          <dl className="flex flex-wrap gap-2">
            <SaleTotal label="وصلك" value={received} tone="success" />
            <SaleTotal label="في الطريق" value={onTheWay} tone="gold" />
            <SaleTotal label="بانتظار السداد" value={awaiting} tone="muted" />
          </dl>
        )}
      </header>

      <OrderTabs
        orders={orders}
        side="seller"
        serverTime={new Date().toISOString()}
        emptyTitle="لا توجد مبيعات بعد"
        emptyHint="اعرض لوحاتك في السوق لتبدأ البيع."
        emptyAction={
          <Button asChild>
            <Link href="/account/listings/new">
              <Plus className="size-4" />
              أضف لوحة
            </Link>
          </Button>
        }
      />

      {orders.length > 0 && (
        <>
          <p className="rounded-xl border border-ink-600 bg-ink-800/60 p-4 text-xs leading-relaxed text-muted">
            لم يعد لديك زرّ «تمّت»: يصل مبلغ المشتري فيُحجز أمانةً، فتنقل الملكية وترفع إثباتها،
            ثم يصلك بعد تحقّق الإدارة من نقل الملكية
            {sellerFee.enabled ? ' — بعد خصم عمولة المنصّة وضريبتها.' : ' كاملًا، بلا عمولة.'}
          </p>
        </>
      )}
    </div>
  )
}

/** رقمٌ واحد باسمه ولونه — والأخضر لما وقع وحده. */
function SaleTotal({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'success' | 'gold' | 'muted'
}) {
  return (
    <div className="rounded-xl border border-ink-600 bg-ink-800 px-3.5 py-2">
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd
        className={
          tone === 'success'
            ? 'text-base font-extrabold tabular-nums text-success'
            : tone === 'gold'
              ? 'text-base font-extrabold tabular-nums text-gold-500'
              : 'text-base font-extrabold tabular-nums text-muted'
        }
      >
        {formatAmount(value)} <span className="text-[11px] font-semibold">ريال</span>
      </dd>
    </div>
  )
}
