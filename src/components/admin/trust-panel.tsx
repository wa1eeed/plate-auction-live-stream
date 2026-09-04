import Link from 'next/link'
import { Landmark, ShieldCheck, TrendingUp, Wallet } from 'lucide-react'
import { formatAmount } from '@/lib/domain/money'
import type { AdminMetrics } from '@/lib/domain/types'

/**
 * ما تحمله المنصّة الآن — وما دخلها هذا الأسبوع.
 *
 * اللوحة كانت أرقامًا مجرّدة متجاورة، فلا يُقرأ منها **قدر الأمانة** التي في
 * يد المنصّة ولا **اتجاه** إيرادها. وهما سؤالا المشغّل الأوّلان كل صباح.
 *
 * ولا مكتبة رسم: السلسلة سبع قيم يرسمها SVG، والشريط نِسَبٌ من مجموع واحد.
 */
export function TrustPanel({ metrics }: { metrics: AdminMetrics }) {
  const held = metrics.heldDeposits + metrics.escrowHeld
  const depositShare = held > 0 ? (metrics.heldDeposits / held) * 100 : 0
  const escrowShare = held > 0 ? (metrics.escrowHeld / held) * 100 : 0

  const week = metrics.revenueByDay
  const peak = Math.max(1, ...week.map((point) => point.amount))
  const weekTotal = week.reduce((sum, point) => sum + point.amount, 0)

  /*
   * الزمن يمشي مع القراءة: الأقدم يمينًا واليوم يسارًا.
   *
   * إحداثيات SVG لا تنقلب باتّجاه الصفحة، فرسمُ الأقدم عند x=0 يضعه يسارًا —
   * فيقرأ العربيّ منحنًى يسير عكس عينه، وتكذب تسميتا الطرفين.
   */
  const points = week
    .map((point, index) => {
      const x = week.length > 1 ? 100 - (index / (week.length - 1)) * 100 : 50
      const y = 30 - (point.amount / peak) * 26
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')

  return (
    <div className="grid gap-3 lg:grid-cols-[1.35fr_1fr]">
      <section className="surface rounded-2xl p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <ShieldCheck className="size-4 text-gold-500" />
            أمانةٌ في يد المنصّة الآن
          </h2>
          <p className="text-2xl font-extrabold tabular-nums text-gold-500">
            {formatAmount(held)} <span className="text-xs font-bold">ريال</span>
          </p>
        </div>

        {/* شريطٌ واحد مقسوم: نسبة كل نوع من المجموع تُرى قبل أن تُقرأ */}
        <div className="flex h-2.5 overflow-hidden rounded-full bg-ink-700" aria-hidden>
          <div className="bg-gold-500" style={{ width: `${depositShare}%` }} />
          <div className="bg-success" style={{ width: `${escrowShare}%` }} />
        </div>

        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <Slice
            tone="gold"
            icon={Wallet}
            label="عرابين محجوزة"
            value={metrics.heldDeposits}
            hint="لمزايدين في مزادات جارية"
            href="/admin/deposits"
          />
          <Slice
            tone="success"
            icon={Landmark}
            label="مبالغ صفقات محبوسة"
            value={metrics.escrowHeld}
            hint={`${metrics.escrowOrders} صفقة حتى نقل الملكية`}
            href="/admin/orders"
          />
        </dl>

        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          هذا ليس مال المنصّة: عرابين تعود لأصحابها أو تُخصم من صفقاتهم، ومبالغ لا
          تُفرج للبائع إلا بعد نقل الملكية.
        </p>
      </section>

      <section className="surface rounded-2xl p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <TrendingUp className="size-4 text-success" />
            إيراد سبعة أيام
          </h2>
          <p className="text-xl font-extrabold tabular-nums text-success">
            {formatAmount(weekTotal)} <span className="text-xs font-bold">ريال</span>
          </p>
        </div>

        <svg
          viewBox="0 0 100 32"
          preserveAspectRatio="none"
          className="h-20 w-full"
          role="img"
          aria-label={`إيراد آخر سبعة أيام، المجموع ${formatAmount(weekTotal)} ريال`}
        >
          {/* مساحة تحت المنحنى ثم المنحنى فوقها — العين تقرأ الاتجاه لا القيم */}
          <polygon
            points={`100,32 ${points} 0,32`}
            fill="color-mix(in oklab, var(--color-success) 16%, transparent)"
          />
          <polyline
            points={points}
            fill="none"
            stroke="var(--color-success)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <div className="mt-1 flex justify-between text-[10px] text-muted">
          <span>قبل ٧ أيام</span>
          <span>اليوم</span>
        </div>
      </section>
    </div>
  )
}

function Slice({
  tone,
  icon: Icon,
  label,
  value,
  hint,
  href,
}: {
  tone: 'gold' | 'success'
  icon: React.ElementType
  label: string
  value: number
  hint: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-ink-600 bg-ink-900/40 p-3 transition-colors hover:border-gold-600/50"
    >
      <dt className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
        <span
          aria-hidden
          className={tone === 'gold' ? 'size-2 rounded-full bg-gold-500' : 'size-2 rounded-full bg-success'}
        />
        <Icon className="size-3.5" />
        {label}
      </dt>
      <dd className="mt-1 text-lg font-extrabold tabular-nums">{formatAmount(value)}</dd>
      <dd className="text-[11px] text-muted">{hint}</dd>
    </Link>
  )
}
