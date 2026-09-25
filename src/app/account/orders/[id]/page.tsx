import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { SaudiLicensePlate } from '@/components/plate/SaudiLicensePlate'
import { CardTag, type CardTagTone } from '@/components/market/card-tag'
import { OverdueTag } from '@/components/market/overdue-tag'
import { ReferenceChip } from '@/components/market/reference-chip'
import { OrderDetail } from '@/components/market/order-detail'
import { formatAmount } from '@/lib/domain/money'
import { orderDeadline } from '@/lib/domain/order-timeline'
import { ORDER_STATUS_LABELS, PLATE_TYPE_LABELS, type AccountOrder } from '@/lib/domain/types'
import { getAccountOrder } from '@/lib/server/market-service'
import { requireUserId } from '@/lib/server/require-user'
import { formatTimestamp } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'تفاصيل الصفقة' }

const SOURCE_LABELS: Record<AccountOrder['source'], string> = {
  auction: 'رست بمزاد',
  fixed: 'شراء مباشر',
  offer: 'عرض مقبول',
}

const SOURCE_TONE: Record<AccountOrder['source'], CardTagTone> = {
  auction: 'gold',
  fixed: 'success',
  offer: 'sky',
}

const STATUS_TONE: Record<AccountOrder['status'], CardTagTone> = {
  awaiting_settlement: 'gold',
  escrow_held: 'gold',
  ownership_transferred: 'gold',
  disputed: 'danger',
  completed: 'success',
  refunded: 'muted',
  cancelled: 'muted',
  defaulted: 'danger',
}

/**
 * **صفحةُ الصفقة — واحدةٌ لطرفيها.**
 *
 * والدورُ فيها يتبدّل بين بائعٍ ومشترٍ، فلو أُفردت لكلٍّ صفحةٌ لَتكرّر
 * المسارُ والسكّةُ والتسوية بفارق كلمتين — ثمّ افترقا بالإصلاحات.
 *
 * ومن ليس طرفًا **لا يجد صفحةً** لا يُقال له «ممنوع»: الثاني يُثبت أنّ
 * الصفقة قائمة، وهو ما لا يُقال لغير أصحابها.
 */
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId()
  const { id } = await params
  const found = await getAccountOrder(id, userId)
  if (!found) notFound()

  const { order, side } = found
  const backHref = side === 'seller' ? '/account/sales' : '/account/purchases'
  const serverTime = new Date().toISOString()

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-paper"
        >
          <ArrowRight className="size-4" />
          {side === 'seller' ? 'مبيعاتي' : 'مشترياتي'}
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-extrabold">
            {side === 'seller' ? 'صفقة بيع' : 'صفقة شراء'}
          </h1>
          <ReferenceChip reference={order.reference} kind="order" />
        </div>
      </div>

      {/*
        * بطاقةُ الهويّة — مَن وكم وما حالها، في نظرةٍ واحدة قبل أيّ تفصيل.
        */}
      <section className="rounded-2xl border border-ink-600 bg-ink-800 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href={`/market/${order.listingId}`}
            className="shrink-0 rounded-lg border border-transparent transition-colors hover:border-gold-600/60"
            aria-label={`اللوحة ${order.plate.arabicLetters} ${order.plate.plateNumbers}`}
          >
            <SaudiLicensePlate
              {...order.plate}
              size="thumbnail"
              showReflection={false}
              className="w-[150px] sm:w-[190px]"
            />
          </Link>

          <div className="min-w-0 flex-1 basis-44 space-y-2">
            <div className="flex flex-wrap items-center gap-1">
              <CardTag tone={STATUS_TONE[order.status]} dot>
                {ORDER_STATUS_LABELS[order.status]}
              </CardTag>
              <CardTag tone={SOURCE_TONE[order.source]}>{SOURCE_LABELS[order.source]}</CardTag>
              <CardTag tone="muted">{PLATE_TYPE_LABELS[order.plate.plateType]}</CardTag>
              <OverdueTag deadline={orderDeadline(order)} serverTime={serverTime} />
            </div>
            <p className="text-xs text-muted">
              {side === 'buyer' ? 'البائع' : 'المشتري'}:{' '}
              <span className="font-semibold text-paper">{order.counterpartName}</span>
            </p>
            <p className="text-[11px] text-muted">{formatTimestamp(order.createdAt)}</p>
          </div>

          <div className="shrink-0 text-end">
            <p className="text-[11px] text-muted">
              {side === 'seller' ? 'قيمة الصفقة' : 'المبلغ'}
            </p>
            <p className="text-2xl font-extrabold tabular-nums text-gold-500">
              {formatAmount(order.amount)}
              <span className="ms-1 text-[11px] font-semibold text-muted">ر.س</span>
            </p>
          </div>
        </div>
      </section>

      <OrderDetail order={order} side={side} serverTime={serverTime} />
    </div>
  )
}
