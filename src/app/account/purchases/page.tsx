import Link from 'next/link'
import { ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { OrderTabs } from '@/components/market/order-tabs'
import { formatAmount } from '@/lib/domain/money'
import { arabicCount } from '@/lib/utils'
import { getPurchases } from '@/lib/server/order-service'
import { requireUserId } from '@/lib/server/require-user'

export const dynamic = 'force-dynamic'

export default async function PurchasesPage() {
  const userId = await requireUserId()
  const orders = await getPurchases(userId)
  /*
   * رقمان بصدقهما لا رقمٌ واحد يجمع ما لم يقع.
   *
   * كان «إجمالي مشترياتي» يجمع `amount` لكل صفقة غير ملغاة — فيضمّ ما لم
   * يُسدَّد بعد، ويسكت عمّا هو مطلوبٌ منه الآن وهو أهمّ ما يخصّه.
   */
  const paid = orders
    .filter((order) => order.paidAt !== null)
    .reduce((sum, order) => sum + order.settlement.net, 0)
  const due = orders
    .filter((order) => order.status === 'awaiting_settlement')
    .reduce((sum, order) => sum + order.settlement.net, 0)

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">مشترياتي</h1>
          <p className="mt-1 text-sm text-muted">
            {arabicCount(orders.length, {
              zero: 'لا مشتريات بعد',
              one: 'صفقة شراء واحدة',
              two: 'صفقتا شراء',
              few: 'صفقات شراء',
              many: 'صفقة شراء',
            })}
          </p>
        </div>
        {orders.length > 0 && (
          <dl className="flex flex-wrap gap-2">
            {due > 0 && (
              <div className="rounded-xl border border-gold-600/50 bg-gold-500/[0.07] px-3.5 py-2">
                <dt className="text-[11px] text-muted">مطلوب سداده</dt>
                <dd className="text-base font-extrabold tabular-nums text-gold-500">
                  {formatAmount(due)} <span className="text-[11px] font-semibold">ريال</span>
                </dd>
              </div>
            )}
            <div className="rounded-xl border border-ink-600 bg-ink-800 px-3.5 py-2">
              <dt className="text-[11px] text-muted">سدّدته</dt>
              <dd className="text-base font-extrabold tabular-nums text-success">
                {formatAmount(paid)} <span className="text-[11px] font-semibold">ريال</span>
              </dd>
            </div>
          </dl>
        )}
      </header>

      <OrderTabs
        orders={orders}
        side="buyer"
        serverTime={new Date().toISOString()}
        emptyTitle="لا توجد مشتريات بعد"
        emptyHint="اشترِ لوحة مباشرة أو اظفَر بواحدة في مزاد لتظهر هنا."
        emptyAction={
          <Button asChild>
            <Link href="/market">
              <ShoppingBag className="size-4" />
              تصفّح السوق
            </Link>
          </Button>
        }
      />

      {orders.length > 0 && (
        <p className="rounded-xl border border-ink-600 bg-ink-800/60 p-4 text-xs leading-relaxed text-muted">
          تسدّد عبر المنصّة فيُحجز مبلغك أمانةً، ولا يصل البائع إلا بعد نقل الملكية وتحقّق
          الإدارة منها. ونقل الملكية نفسه يتمّ عبر القنوات الرسمية.
        </p>
      )}
    </div>
  )
}
