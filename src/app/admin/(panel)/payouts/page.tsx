import Link from 'next/link'
import { AlertTriangle, Landmark, CircleCheckBig, Wallet } from 'lucide-react'
import { TableSearch } from '@/components/admin/table-search'
import { AdminHeader, MetricCard, Money } from '@/components/admin/admin-ui'
import { PayoutActions } from '@/components/admin/payout-actions'
import { Badge } from '@/components/ui/badge'
import { formatAmount } from '@/lib/domain/money'
import {
  DISBURSEMENT_KIND_LABELS,
  DISBURSEMENT_STATUS_LABELS,
  formatIban,
} from '@/lib/domain/types'
import { getPayouts } from '@/lib/server/admin-service'
import { requireAdminId } from '@/lib/server/require-admin'
import { cn, formatTimestamp } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'أوامر الصرف' }

export default async function AdminPayoutsPage() {
  await requireAdminId()
  const { rows, totals } = await getPayouts()

  return (
    <>
      <AdminHeader
        title="أوامر الصرف"
        description="كل قرار بتحويل أو إعادة يفتح أمر صرف هنا. المبلغ قُيّد في محفظة صاحبه فور القرار، وهذه الورقة تُخرجه إلى حسابه البنكي وتُقفل بمرجع الحوالة."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="بانتظار الصرف"
          value={formatAmount(totals.pending)}
          tone={totals.pending > 0 ? 'gold' : 'default'}
          attention={totals.pending > 0}
          icon={Landmark}
          hint={`ريال — ${totals.pendingCount} أمر`}
        />
        <MetricCard
          label="بيانات بنكية ناقصة"
          value={String(totals.blocked)}
          tone={totals.blocked > 0 ? 'danger' : 'default'}
          attention={totals.blocked > 0}
          icon={AlertTriangle}
          hint={totals.blocked > 0 ? 'أمر لا يُنفَّذ حتى يكملها صاحبه' : 'لا شيء موقوف'}
        />
        <MetricCard
          label="صُرف هذا الشهر"
          value={formatAmount(totals.paidThisMonth)}
          tone="success"
          icon={CircleCheckBig}
          hint="ريال — غادرت حساب المنصّة"
        />
        <MetricCard
          label="أوامر منفّذة"
          value={String(totals.paidCount)}
          icon={Wallet}
          hint="مقفلة بمرجع حوالة"
        />
      </div>

      <TableSearch
        placeholder="ابحث بالمستفيد أو اللوحة أو رقم أمر الصرف (F26-00001)"
        tabs={[
          { key: 'due', label: 'بانتظار قرارك', hint: 'التزامات قائمة لم تُصرف بعد' },
          { key: 'blocked', label: 'بيانات ناقصة', hint: 'ينقصها حساب بنكي — نبّه صاحبها' },
          { key: 'closed', label: 'معاملة مكتملة', hint: 'صُرفت بحوالة أو أُلغيت' },
        ]}
        rows={rows.map((row) => ({
          key: row.id,
          reference: row.reference,
          tab:
            row.status !== 'pending' ? 'closed' : row.payable ? 'due' : 'blocked',
          haystack: [
            row.beneficiaryName,
            row.plateLabel,
            row.orderReference,
            row.bankIban ?? '',
            row.paymentReference ?? '',
          ].join(' '),
        }))}
      >
        {/*
          * بطاقات ممتدّة لا جدولًا.
          *
          * أمر الصرف ورقةٌ يُقرأ منها المحاسب سبعة أشياء قبل أن يحوّل:
          * لمن، وكم، وعن أي صفقة، وإلى أي آيبان، وكم خُصم عمولةً، ومتى صدر،
          * وهل نُفّذ. وجدولٌ بسبعة أعمدة يدفن الآيبان — وهو أخطرها — في
          * تمريرة أفقية.
          */}
        <ul className="space-y-2.5">
          {rows.map((row) => {
            const pending = row.status === 'pending'
            return (
              <li
                key={row.id}
                data-row={row.id}
                className={cn(
                  'surface rounded-2xl p-4 transition-colors',
                  pending && !row.payable && 'border-danger/35 bg-danger/[0.03]',
                  pending && row.payable && 'border-gold-600/35',
                )}
              >
                {/* الصفّ الأوّل: لمن وكم وعن أي صفقة */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span dir="ltr" className="text-xs font-bold tabular-nums text-gold-500">
                    {row.reference}
                  </span>
                  <Badge variant={row.kind === 'seller_payout' ? 'gold' : 'muted'}>
                    {DISBURSEMENT_KIND_LABELS[row.kind]}
                  </Badge>

                  <span className="text-xs text-muted">
                    المستفيد{' '}
                    <Link
                      href={`/admin/users/${row.beneficiaryReference}`}
                      className="font-semibold text-paper hover:underline"
                    >
                      {row.beneficiaryName}
                    </Link>
                  </span>

                  <span className="text-xs text-muted">
                    عن الصفقة{' '}
                    <Link
                      href={`/admin/listings/${row.listingId}`}
                      className="font-semibold text-paper hover:underline"
                    >
                      {row.orderReference}
                    </Link>
                    {' · '}
                    {row.plateLabel}
                  </span>

                  <span className="ms-auto flex items-center gap-3">
                    <Money value={row.amount} className="text-base font-extrabold" />
                    <Badge
                      variant={
                        row.status === 'paid'
                          ? 'success'
                          : row.status === 'cancelled'
                            ? 'muted'
                            : row.payable
                              ? 'gold'
                              : 'danger'
                      }
                    >
                      {pending && !row.payable
                        ? 'بيانات بنكية ناقصة'
                        : DISBURSEMENT_STATUS_LABELS[row.status]}
                    </Badge>
                  </span>
                </div>

                {/* الصفّ الثاني: الحساب البنكي وتفصيل المبلغ — والأزرار في طرفه */}
                <div className="mt-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-t border-ink-600/70 pt-3">
                  <div className="min-w-0 flex-1 basis-72 space-y-1.5">
                    {row.bankIban ? (
                      <p className="text-sm font-semibold">
                        {row.bankAccountName}
                        <span className="text-muted"> · {row.bankName}</span>
                        <br />
                        {/*
                          * الآيبان بالإنجليزية وبمجموعات رباعية.
                          *
                          * رقمٌ من أربع وعشرين خانة يُطابَق بالعين قبل تحويل
                          * لا رجعة فيه — والتجميع يجعل الخطأ في خانة مرئيًّا.
                          */}
                        <span dir="ltr" className="font-mono text-xs tabular-nums text-gold-500">
                          {formatIban(row.bankIban)}
                        </span>
                      </p>
                    ) : (
                      <p className="text-sm font-bold text-danger">
                        لا حساب بنكي للمستفيد
                        <span className="block text-xs font-normal text-muted">
                          يُدخله صاحبه في إعداداته، ولا يُحوَّل إلى آيبان مظنون.
                        </span>
                      </p>
                    )}

                    <p className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
                      <span>صدر {formatTimestamp(row.createdAt)}</span>
                      <span>
                        قيمة الصفقة <Money value={row.grossAmount} className="text-paper" />
                      </span>
                      {row.commissionAmount > 0 && (
                        <span>
                          خُصم عمولةً وضريبةً{' '}
                          <Money
                            value={row.commissionAmount + row.vatAmount}
                            className="text-paper"
                          />
                        </span>
                      )}
                      <span>
                        رصيد المستفيد الآن{' '}
                        <Money value={row.beneficiaryBalance} className="text-paper" />
                      </span>
                    </p>

                    {row.status === 'paid' && row.paymentReference && (
                      <p className="text-[11px] text-success">
                        صُرف {formatTimestamp(row.paidAt)} · مرجع الحوالة{' '}
                        <span dir="ltr" className="font-mono">
                          {row.paymentReference}
                        </span>
                      </p>
                    )}
                    {row.status === 'cancelled' && (
                      <p className="text-[11px] text-muted">أُلغي: {row.cancelReason}</p>
                    )}
                    {row.note && row.status === 'pending' && (
                      <p className="text-[11px] text-muted">{row.note}</p>
                    )}
                  </div>

                  {pending && (
                    <PayoutActions
                      id={row.id}
                      reference={row.reference}
                      beneficiaryName={row.beneficiaryName}
                      amount={formatAmount(row.amount)}
                      iban={row.bankIban}
                      payable={row.payable}
                    />
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </TableSearch>
    </>
  )
}
