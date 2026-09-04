import Link from 'next/link'
import type { Metadata } from 'next'
import { Info, Receipt, Wallet as WalletIcon } from 'lucide-react'
import { StatementTable } from '@/components/market/statement-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DEPOSIT_STATUS_LABELS } from '@/lib/domain/types'
import { formatAmount } from '@/lib/domain/money'
import { getWalletView } from '@/lib/server/wallet-service'
import { getPublicPaymentOptions, getUserPayments } from '@/lib/server/payment-service'
import { TopUpDialog } from '@/components/market/top-up-dialog'
import { PendingPayments } from '@/components/market/pending-payments'
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, isClosedPayment } from '@/lib/domain/types'
import { requireUserId } from '@/lib/server/require-user'
import { formatTimestamp } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'محفظتي' }

export default async function WalletPage() {
  const userId = await requireUserId()
  const [wallet, options, payments] = await Promise.all([
    getWalletView(userId),
    getPublicPaymentOptions(),
    getUserPayments(userId),
  ])
  const heldDeposits = wallet.deposits.filter((deposit) => deposit.status === 'held')

  return (
    <>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold sm:text-2xl">محفظتي</h1>
          <p className="mt-1 text-sm text-muted">
            رصيدك وكشف حسابك والعرابين المحجوزة في المزادات.
          </p>
        </div>
        <TopUpDialog options={options} />
      </header>

      <section className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-ink-600 bg-ink-800 p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
            <WalletIcon className="size-3.5" />
            الرصيد الكلي
          </p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums">
            {formatAmount(wallet.balance)}
            <span className="ms-1 text-sm font-normal text-muted">ريال</span>
          </p>
        </div>

        <div className="rounded-2xl border border-gold-600/40 bg-gold-500/[0.07] p-4">
          <p className="text-xs font-semibold text-muted">محجوز كعرابين</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums text-gold-500">
            {formatAmount(wallet.held)}
            <span className="ms-1 text-sm font-normal text-muted">ريال</span>
          </p>
          <p className="mt-0.5 text-[11px] text-muted">
            ما زال ملكك — لكنه غير متاح حتى تنتهي مزاداته
          </p>
        </div>

        <div className="rounded-2xl border border-ink-600 bg-ink-800 p-4">
          <p className="text-xs font-semibold text-muted">المتاح للمزايدة</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums text-success">
            {formatAmount(wallet.available)}
            <span className="ms-1 text-sm font-normal text-muted">ريال</span>
          </p>
        </div>
      </section>

      {wallet.dueCommission > 0 && (
        <div className="mb-6 flex items-start gap-2.5 rounded-2xl border border-danger/40 bg-danger/[0.06] p-4 text-sm">
          <Receipt className="mt-0.5 size-4 shrink-0 text-danger" />
          <p className="text-muted">
            عليك عمولة مستحقّة{' '}
            <b className="text-danger">{formatAmount(wallet.dueCommission)} ريال</b> لم تُقتطع لعدم
            كفاية رصيدك وقت اكتمال الصفقة. اشحن محفظتك لتسويتها — صفقاتك لم تتعطّل، لكن الالتزام
            قائم.
          </p>
        </div>
      )}

      <PendingPayments payments={payments} options={options} />

      <div className="mb-6 flex items-start gap-2.5 rounded-2xl border border-ink-600 bg-ink-800/60 p-4 text-sm text-muted">
        <Info className="mt-0.5 size-4 shrink-0 text-gold-500" />
        <p>
          {options.tapEnabled
            ? 'الدفع بالبطاقة يضيف الرصيد فورًا. الحوالة البنكية تُضاف بعد تحقّق الإدارة منها.'
            : options.bankTransferEnabled
              ? 'حوّل المبلغ إلى حساب المنصّة ثم أرفق رقم العملية، ويُضاف الرصيد بعد تحقّق الإدارة.'
              : 'لا توجد طريقة دفع مفعّلة حاليًا. تواصل مع الإدارة لشحن رصيدك.'}{' '}
          <Link href="/faq" className="font-semibold text-gold-500 hover:underline">
            اقرأ الأسئلة الشائعة
          </Link>
        </p>
      </div>

      {heldDeposits.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-bold">عرابين محجوزة الآن</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {heldDeposits.map((deposit) => (
              <li
                key={deposit.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-gold-600/40 bg-gold-500/[0.06] p-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/market/${deposit.listingId}`}
                    className="block truncate font-bold hover:underline"
                  >
                    {deposit.plateLabel}
                  </Link>
                  <span className="text-[11px] text-muted">
                    حُجز {formatTimestamp(deposit.createdAt)}
                  </span>
                </div>
                <span className="shrink-0 font-extrabold tabular-nums text-gold-500">
                  {formatAmount(deposit.amount)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-bold">كشف الحساب</h2>
        <StatementTable statement={wallet.statement} />
      </section>

      {wallet.deposits.length > heldDeposits.length && (
        <section>
          <h2 className="mb-2 text-sm font-bold">سجلّ العرابين</h2>
          <ul className="space-y-2">
            {wallet.deposits
              .filter((deposit) => deposit.status !== 'held')
              .map((deposit) => (
                <li
                  key={deposit.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-600 bg-ink-800 p-3 text-sm"
                >
                  <span className="font-bold">{deposit.plateLabel}</span>
                  <span className="tabular-nums">{formatAmount(deposit.amount)} ريال</span>
                  <Badge variant={deposit.status === 'forfeited' ? 'danger' : 'muted'}>
                    {DEPOSIT_STATUS_LABELS[deposit.status]}
                  </Badge>
                  {deposit.reason && (
                    <span className="w-full text-[11px] text-muted">{deposit.reason}</span>
                  )}
                </li>
              ))}
          </ul>
        </section>
      )}

      {payments.some((payment) => isClosedPayment(payment.status)) && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-bold">سجلّ عمليات الدفع</h2>
          <ul className="space-y-2">
            {payments
              .filter((payment) => isClosedPayment(payment.status))
              .map((payment) => (
                <li
                  key={payment.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-600 bg-ink-800 p-3 text-sm"
                >
                  <span className="tabular-nums font-bold">
                    {formatAmount(payment.amount)} ريال
                  </span>
                  <span className="text-xs text-muted">
                    {PAYMENT_METHOD_LABELS[payment.method]} · {payment.reference}
                  </span>
                  <Badge variant={payment.status === 'paid' ? 'success' : 'muted'}>
                    {PAYMENT_STATUS_LABELS[payment.status]}
                  </Badge>
                  <span className="text-[11px] text-muted">
                    {formatTimestamp(payment.createdAt)}
                  </span>
                  {payment.failureReason && (
                    <span className="w-full text-[11px] text-danger">{payment.failureReason}</span>
                  )}
                </li>
              ))}
          </ul>
        </section>
      )}

      <div className="mt-6">
        <Button asChild variant="secondary">
          <Link href="/market">تصفّح السوق</Link>
        </Button>
      </div>
    </>
  )
}
