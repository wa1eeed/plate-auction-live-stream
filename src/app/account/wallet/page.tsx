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
      <header className="mb-4">
        <h1 className="text-xl font-extrabold sm:text-2xl">محفظتي</h1>
        <p className="mt-1 text-sm text-muted">
          رصيدك وكشف حسابك والعرابين المحجوزة في المزادات.
        </p>
      </header>

      {/*
        * بطاقةٌ واحدة تحمل الرصيد، كما تفعل تطبيقات البنوك.
        *
        * كانت ثلاث بطاقات متساوية الوزن: الكلي والمحجوز والمتاح — والعين لا
        * تعرف أيّها الرقم الذي يعنيها. والذي يعني المزايد **المتاح**: هو ما
        * يستطيع أن يزايد به الآن، والكلي رقمٌ لا يُنفَق منه شيءٌ محجوز.
        *
        * فصار المتاح هو العنوان، والكلي والمحجوز سطرًا تحته، وبينهما شريطٌ
        * يُري النسبة — فيُعرف بنظرةٍ كم من المال معلّقٌ في مزادات جارية.
        */}
      <section className="mb-6 overflow-hidden rounded-3xl border border-gold-600/35 bg-gradient-to-bl from-gold-500/[0.14] via-ink-800 to-ink-800 shadow-lg shadow-black/10">
        <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-bold text-muted">
              <WalletIcon className="size-3.5 text-gold-500" />
              المتاح للمزايدة
            </p>
            <p className="mt-1.5 text-4xl font-extrabold leading-none tabular-nums text-paper sm:text-5xl">
              {formatAmount(wallet.available)}
              <span className="ms-2 text-base font-bold text-muted">ريال</span>
            </p>
          </div>
          <TopUpDialog options={options} />
        </div>

        {/*
          * الشريط يُقاس بالكلي لا بمجموع الجزأين.
          *
          * ورصيدٌ صفرٌ يقسم على صفر، فيُحرس القاسم — والشريط عندئذٍ فارغٌ كما
          * ينبغي لمحفظةٍ فارغة.
          */}
        <div className="px-5 pb-5 sm:px-6 sm:pb-6">
          <div
            className="flex h-2 overflow-hidden rounded-full bg-ink-900"
            role="img"
            aria-label={`المتاح ${formatAmount(wallet.available)} من أصل ${formatAmount(wallet.balance)} ريال`}
          >
            <span
              className="bg-success/80"
              style={{
                width: `${wallet.balance > 0 ? (wallet.available / wallet.balance) * 100 : 0}%`,
              }}
            />
            <span
              className="bg-gold-500/80"
              style={{
                width: `${wallet.balance > 0 ? (wallet.held / wallet.balance) * 100 : 0}%`,
              }}
            />
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              {/* «المتاح» لا «المتاح للمزايدة»: العنوان فوقه قالها، وتكرارها في
                  دليل الشريط حشوٌ يُقرأ مرّتين */}
              <dt className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
                <span className="size-2 rounded-full bg-success/80" />
                المتاح
              </dt>
              <dd className="mt-0.5 font-extrabold tabular-nums text-success">
                {formatAmount(wallet.available)}
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
                <span className="size-2 rounded-full bg-gold-500/80" />
                محجوز كعرابين
              </dt>
              <dd className="mt-0.5 font-extrabold tabular-nums text-gold-500">
                {formatAmount(wallet.held)}
              </dd>
              <dd className="text-[10px] leading-relaxed text-muted">
                ملكك، غير متاح حتى تنتهي مزاداته
              </dd>
            </div>
            <div className="col-span-2 border-t border-ink-600/60 pt-2 sm:col-span-1 sm:border-0 sm:pt-0">
              <dt className="text-[11px] font-semibold text-muted">الرصيد الكلي</dt>
              <dd className="mt-0.5 font-extrabold tabular-nums text-paper">
                {formatAmount(wallet.balance)}
              </dd>
            </div>
          </dl>
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
