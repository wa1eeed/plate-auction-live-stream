import Link from 'next/link'
import type { Metadata } from 'next'
import { Info, Receipt, Lock, ShieldCheck } from 'lucide-react'
import { StatementTable } from '@/components/market/statement-table'
import { SaudiLicensePlate } from '@/components/plate/SaudiLicensePlate'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DEPOSIT_STATUS_LABELS } from '@/lib/domain/types'
import { formatAmount } from '@/lib/domain/money'
import { getWalletView } from '@/lib/server/wallet-service'
import { getPublicPaymentOptions, getUserPayments } from '@/lib/server/payment-service'
import { RecentActivity } from '@/components/wallet/recent-activity'
import { TopUpDialog } from '@/components/market/top-up-dialog'
import { PendingPayments } from '@/components/market/pending-payments'
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, isClosedPayment } from '@/lib/domain/types'
import { requireUserId } from '@/lib/server/require-user'
import { formatTimestamp, arabicCount } from '@/lib/utils'

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
      {/*
        * بطاقةٌ داكنة تحمل الرصيد — على نمط تطبيقات المال.
        *
        * والسوادُ ليس زينة: الرقم الكبير على خلفيةٍ داكنة يُقرأ من بعيد،
        * والبطاقة تنفصل عمّا تحتها فتُعرف بنظرة. وهي **الشيء الأوّل** في
        * الصفحة، فيُعطى وزنه.
        *
        * وترتيبُها: المتاح عنوانًا، والمحجوز في جيبٍ داخله لا بجانبه —
        * فالمحجوز جزءٌ من ماله لا رقمٌ مستقلّ، وموضعُه يقول ذلك قبل نصِّه.
        */}
      <section className="mb-4 overflow-hidden rounded-3xl bg-[#171C24] p-5 text-white shadow-lg shadow-black/15 sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-white/55">المتاح للمزايدة</p>
            <p className="mt-1.5 text-[2.6rem] font-extrabold leading-none tabular-nums sm:text-5xl">
              {formatAmount(wallet.available)}
              <span className="ms-2 text-base font-bold text-white/55">ريال</span>
            </p>
          </div>
          {/* كشف الحساب في رأس البطاقة — حيث يُبحث عنه */}
          <Link
            href="#statement"
            className="shrink-0 rounded-lg px-2 py-1 text-[12px] font-semibold text-gold-400 transition-colors hover:text-gold-300"
          >
            كشف الحساب
          </Link>
        </div>

        {/*
          * جيبُ المحجوز — يُعرض دائمًا ولو كان صفرًا.
          *
          * فمن لا محجوز له يقرأ «لا عرابين محجوزة» فيطمئنّ، ومن اختفى عنه
          * السطر يظنّ أنّ ماله نقص ولا يجد له تفسيرًا. والصفر خبرٌ كالرقم.
          */}
        <div className="flex items-center gap-3 rounded-2xl bg-white/[0.07] p-3.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gold-500/20 text-gold-400">
            <Lock className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] font-bold">محجوز مؤقّتًا</span>
              <span className="text-[15px] font-extrabold tabular-nums text-gold-400">
                {formatAmount(wallet.held)}
              </span>
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-white/50">
              {heldDeposits.length > 0
                ? `${arabicCount(heldDeposits.length, {
                    one: 'عربونٌ واحد',
                    two: 'عربونان',
                    few: 'عرابين',
                    many: 'عربونًا',
                  })} · يُفرج عنها عند انتهاء المزاد`
                : 'لا عرابين محجوزة الآن'}
            </p>
          </div>
        </div>

        {/* والكلي سطرٌ خفيف: يُذكر ولا يُزاحم */}
        <p className="mt-3 flex items-center justify-between gap-3 text-[11px] text-white/45">
          <span>الرصيد الكلي</span>
          <span className="font-bold tabular-nums text-white/70">
            {formatAmount(wallet.balance)} ريال
          </span>
        </p>
      </section>

      <div className="mb-4">
        <TopUpDialog options={options} triggerClassName="w-full" />
      </div>

      {/*
        * طمأنةٌ عن المحجوز — تُقال قبل أن تُسأل.
        *
        * وأوّلُ ما يخطر لمن رأى رصيده «محجوزًا» أنّه ذهب. وهو أكثر ما يُسأل
        * عنه في منصّات العرابين. فيُقال هنا، تحت الرقم مباشرةً، لا في صفحة
        * أسئلةٍ يُبحث عنها بعد القلق.
        */}
      <div className="mb-6 flex items-start gap-2.5 rounded-2xl border border-success/30 bg-success/[0.07] p-3.5 text-[12px] leading-relaxed">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
        <p className="text-muted">
          <b className="text-paper">المبالغ المحجوزة ملكك</b> — لا تُصرف ولا تُسحب، وتعود إلى
          رصيدك المتاح تلقائيًّا متى انتهى المزاد ولم ترسُ عليك اللوحة.
        </p>
      </div>

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
          {/*
            * اللوحة تُرسم لا تُكتب.
            *
            * «سد ٢٠٢٠» نصٌّ يُفكّ حرفًا حرفًا، ومن له ثلاثة عرابين يقرأ ثلاثة
            * أسطرٍ متشابهة ليعرف أيُّها لوحته. والرسم يُعرف بنظرة، وهو نفسه
            * الذي يراه في السوق فتُطابق ذاكرتُه ما أمامه.
            */}
          <ul className="grid gap-2 sm:grid-cols-2">
            {heldDeposits.map((deposit) => (
              <li
                key={deposit.id}
                className="flex items-center gap-3 rounded-xl border border-gold-600/40 bg-gold-500/[0.06] p-3"
              >
                <Link href={`/market/${deposit.listingId}`} className="shrink-0">
                  {deposit.plate ? (
                    <span className="flex aspect-[16/7] w-[112px] items-center justify-center rounded-lg bg-ink-900/40 p-1">
                      <SaudiLicensePlate {...deposit.plate} size="fill" showReflection={false} />
                    </span>
                  ) : (
                    <span className="font-bold">{deposit.plateLabel}</span>
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <span className="block text-[11px] text-muted">
                    حُجز {formatTimestamp(deposit.createdAt)}
                  </span>
                  <span className="mt-0.5 block font-extrabold tabular-nums text-gold-500">
                    {formatAmount(deposit.amount)}
                    <span className="ms-1 text-[11px] font-normal text-muted">ريال</span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* لمحةٌ أوّلًا، والكشف الكامل تحتها — ولا يُحذف منه شيء */}
      <RecentActivity lines={wallet.statement.lines} />

      <section id="statement" className="mb-6 scroll-mt-20">
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
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-600 bg-ink-800 p-3 text-sm"
                >
                  {/* والسجلّ كذلك: اللوحة رسمًا لا نصًّا */}
                  <Link href={`/market/${deposit.listingId}`} className="shrink-0">
                    {deposit.plate ? (
                      <span className="flex aspect-[16/7] w-[112px] items-center justify-center rounded-lg bg-ink-900/40 p-1">
                        <SaudiLicensePlate {...deposit.plate} size="fill" showReflection={false} />
                      </span>
                    ) : (
                      <span className="font-bold">{deposit.plateLabel}</span>
                    )}
                  </Link>
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
