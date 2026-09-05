import Link from 'next/link'
import { TableSearch } from '@/components/admin/table-search'
import { AdminHeader, Money } from '@/components/admin/admin-ui'
import { SaudiLicensePlate } from '@/components/plate/SaudiLicensePlate'
import { OrderActions } from '@/components/admin/order-actions'
import { ReawardDialog } from '@/components/admin/reaward-dialog'
import { DisputeActions } from '@/components/admin/dispute-actions'
import { formatAmount } from '@/lib/domain/money'
import { Badge } from '@/components/ui/badge'
import { DEPOSIT_STATUS_LABELS, ORDER_STATUS_LABELS } from '@/lib/domain/types'
import { adminOrderBucket, adminOrderTask } from '@/lib/domain/order-timeline'
import { listAdminOrders } from '@/lib/server/admin-service'
import { getStore } from '@/lib/store'
import { requireAdminId } from '@/lib/server/require-admin'
import { cn, formatTimestamp } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'الصفقات' }

const SOURCE_LABELS = { auction: 'مزاد', fixed: 'بيع مباشر', offer: 'عرض مقبول' } as const

export default async function AdminOrdersPage() {
  await requireAdminId()
  const rows = await listAdminOrders()
  // القاعدة السارية — نصّ التأكيد لا يعِد بخصمٍ معطَّل
  const { seller: sellerFee } = await getStore().getCommissionSettings()
  const now = Date.now()

  return (
    <>
      <AdminHeader
        title="الصفقات"
        description="كل صفقة وما تنتظره منك. المبلغ يُحجز أمانةً ولا يخرج إلا بقرارك بعد تحقّقك من نقل الملكية."
      />

      <TableSearch
        placeholder="ابحث باللوحة أو الطرفين أو رقم الصفقة (S26-00001)"
        tabs={[
          { key: 'you', label: 'بانتظار قرارك', hint: 'اعتراض أو مهلة انتهت — لا تمضي بلا قرار منك' },
          { key: 'running', label: 'تحت الإجراء', hint: 'معاملات جارية في مواعيدها' },
          { key: 'done', label: 'معاملة مكتملة', hint: 'انتهت: وصل المبلغ للبائع أو عاد للمشتري أو أُغلقت' },
        ]}
        rows={rows.map((row) => ({
          key: row.id,
          reference: row.reference,
          tab: adminOrderBucket(row, { overdue: row.overdue }, now),
          haystack: [
            row.plate.arabicLetters,
            row.plate.plateNumbers,
            row.buyerName,
            row.sellerName,
            row.id,
          ].join(' '),
        }))}
      >
      {/*
        * بطاقات ممتدّة لا جدولًا.
        *
        * الصفقة تحمل **مهمّة بجملتين** (ما المطلوب ولماذا) وطرفين ومبلغًا
        * وثلاث مهل — وأحد عشر عمودًا لذلك يعني سبعين ريمًا من العرض وتمريرًا
        * أفقيًّا يدفن عمود الإجراءات في آخره. والبطاقة تُوزّع ما يُقرأ معًا
        * في سطرٍ واحد، وتضع الأزرار في طرفها حيث تُطلَب.
        */}
      <ul className="space-y-2.5">
        {rows.map((row) => {
          const task = adminOrderTask(row, { overdue: row.overdue }, now)
          return (
            <li
              key={row.id}
              data-row={row.id}
              className={cn(
                'surface rounded-2xl p-4 transition-colors',
                task.tone === 'act' && 'border-danger/35 bg-danger/[0.03]',
              )}
            >
              {/* الصفّ الأوّل: هويّة الصفقة ومالها وحالتها */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {/*
                  * اللوحة مرسومة لا مكتوبة.
                  *
                  * المشغّل يطابق ما أمامه بلوحةٍ رآها في بلاغٍ أو صورة، ونصٌّ
                  * «هد 5050» يحتاج قراءةً وترجمة. والرسم يُطابَق بلمحة —
                  * والنصّ باقٍ لقارئ الشاشة وللبحث في الصفحة.
                  */}
                <Link
                  href={`/admin/listings/${row.listingId}`}
                  className="shrink-0 rounded-lg border border-transparent transition-colors hover:border-gold-600/60"
                  aria-label={`اللوحة ${row.plate.arabicLetters} ${row.plate.plateNumbers}`}
                >
                  <SaudiLicensePlate {...row.plate} size="thumbnail" />
                </Link>

                <span dir="ltr" className="text-xs font-bold tabular-nums text-gold-500">
                  {row.reference}
                </span>
                <span className="text-xs text-muted">{SOURCE_LABELS[row.source]}</span>

                <span className="text-xs text-muted">
                  المشتري{' '}
                  <Link
                    href={`/admin/users/${row.buyerReference}`}
                    className="font-semibold text-paper hover:underline"
                  >
                    {row.buyerName}
                  </Link>
                  {' ← البائع '}
                  <Link
                    href={`/admin/users/${row.sellerReference}`}
                    className="font-semibold text-paper hover:underline"
                  >
                    {row.sellerName}
                  </Link>
                </span>

                <span className="ms-auto flex items-center gap-3">
                  <Money value={row.amount} className="text-base font-extrabold" />
                  <Badge
                    variant={
                      row.status === 'completed'
                        ? 'success'
                        : row.status === 'defaulted' || row.overdue
                          ? 'danger'
                          : 'muted'
                    }
                  >
                    {row.overdue && row.status === 'awaiting_settlement'
                      ? 'تجاوزت المهلة'
                      : ORDER_STATUS_LABELS[row.status]}
                  </Badge>
                </span>
              </div>

              {/* الصفّ الثاني: المهمّة والمهل والأزرار — ما يُقرأ ثم ما يُفعل */}
              <div className="mt-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-t border-ink-600/70 pt-3">
                <div className="min-w-0 flex-1 basis-72">
                  <p
                    className={
                      task.tone === 'act'
                        ? 'text-sm font-bold text-danger'
                        : task.tone === 'wait'
                          ? 'text-sm font-semibold text-muted'
                          : 'text-sm font-semibold text-success'
                    }
                  >
                    {task.title}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">{task.detail}</p>

                  <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
                    {/*
                      * المهلة المعروضة هي مهلة المرحلة الجارية لا كل مهلة مرّت.
                      *
                      * مهلة السداد على صفقةٍ نُقلت ملكيتها خبرٌ انقضى وقته، وعرضه
                      * إلى جانب «تحقّق ثم حوّل» يوهم أنّ المطلوب سدادٌ لم يقع.
                      */}
                    {row.status === 'awaiting_settlement' && row.paymentDueAt && (
                      <span className={row.overdue ? 'font-bold text-danger' : undefined}>
                        مهلة السداد {formatTimestamp(row.paymentDueAt)}
                      </span>
                    )}
                    {row.status === 'escrow_held' && row.transferDueAt && (
                      <span
                        className={
                          Date.parse(row.transferDueAt) <= now ? 'font-bold text-danger' : undefined
                        }
                      >
                        مهلة نقل الملكية {formatTimestamp(row.transferDueAt)}
                      </span>
                    )}
                    {row.depositStatus && (
                      <span>
                        العربون <Money value={row.depositAmount} className="text-gold-500" /> ·{' '}
                        {DEPOSIT_STATUS_LABELS[row.depositStatus]}
                      </span>
                    )}
                  </p>

                  {/*
                    * الاعتراض يُرى بختمه لا بحالة الصفقة.
                    *
                    * `openDispute` لا يُجمّد إلّا ما كان ماله محجوزًا، فاعتراضٌ
                    * على صفقةٍ لم تُسدَّد بعدُ يُسجَّل ولا تتبدّل حالتها — وكان
                    * لا يظهر في هذا الجدول بحال، فيكتبه صاحبه ولا تراه الإدارة.
                    * وهو أخطر ما في الباب: بابٌ يُفتح على لا أحد.
                    */}
                  {row.disputedAt && (
                    <p className="mt-2 rounded-lg border border-danger/40 bg-danger/[0.07] px-2.5 py-2 text-[11px] leading-relaxed">
                      <span className="font-bold text-danger">
                        اعتراض {formatTimestamp(row.disputedAt)}
                        {row.status !== 'disputed' && ' — والمال لم يُجمَّد (لم يُسدَّد بعد)'}
                      </span>
                      {row.disputeReason && (
                        <span className="mt-1 block whitespace-pre-line text-paper">
                          «{row.disputeReason}»
                        </span>
                      )}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {row.status === 'awaiting_settlement' && (
                    <OrderActions
                      orderId={row.id}
                      plateLabel={`${row.plate.arabicLetters} ${row.plate.plateNumbers}`}
                      reference={row.reference}
                      amount={row.amount}
                      depositAmount={row.depositAmount}
                    />
                  )}
                  {/* إعادة الإرساء متاحة على مزاد تخلّف فائزه أو تجاوز مهلته */}
                  {row.source === 'auction' && (row.status === 'defaulted' || row.overdue) && (
                    <ReawardDialog orderId={row.id} />
                  )}
                  {/* الإفراج قرار إدارة: بعد تحقّقها من النقل، أو فصلها في اعتراض */}
                  {(row.status === 'disputed' || row.status === 'ownership_transferred') && (
                    <DisputeActions
                      sellerFee={sellerFee.enabled}
                      orderId={row.id}
                      buyerName={row.buyerName}
                      sellerName={row.sellerName}
                      amount={formatAmount(row.amount)}
                      proofNote={row.transferProofNote}
                    />
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
      </TableSearch>
    </>
  )
}
