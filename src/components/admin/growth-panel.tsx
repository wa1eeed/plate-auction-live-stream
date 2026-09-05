import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import type { GrowthMetrics, Trend } from '@/lib/server/admin-service'
import { formatAmount } from '@/lib/domain/money'
import { cn } from '@/lib/utils'

/**
 * مؤشّرات النمو — نافذةٌ تُقارَن بما قبلها.
 *
 * الأرقام المطلقة تقول «كم» ولا تقول «إلى أين»: مئتا مستخدم رقمٌ لا معنى له
 * حتى يُعرف أكانوا مئةً الأسبوع الماضي أم ثلاثمئة. فكلّ بطاقةٍ هنا تحمل
 * الرقم وسابقَه والفرقَ بينهما.
 *
 * ولا يُلوَّن الفرق بالأخضر والأحمر إلّا حيث يعني ذلك: ارتفاعُ المستخدمين
 * خيرٌ، وارتفاعُ التخلّف ليس منه — ولا مؤشّر تخلّفٍ هنا، فكلّها صاعدةُ الخير.
 */
export function GrowthPanel({ growth }: { growth: GrowthMetrics }) {
  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-sm font-bold text-muted">
          آخر {growth.windowDays} أيام، مقارنةً بالـ{growth.windowDays} التي قبلها
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TrendCard label="مستخدمون جدد" trend={growth.users} />
          <TrendCard label="إعلانات منشورة" trend={growth.listings} />
          <TrendCard label="صفقات جديدة" trend={growth.orders} />
          <TrendCard label="قيمة المبيعات" trend={growth.sales} money />
        </div>
      </div>

      {/*
        * نسبٌ تصف الصحّة لا الحجم.
        *
        * منصّةٌ تنمو إعلاناتها ولا تنمو صفقاتها تبدو صاعدةً في البطاقات أعلاه
        * وهي واقفة — وهذه النسب هي ما يكشف ذلك.
        */}
      <div>
        <p className="mb-2 text-sm font-bold text-muted">نسبٌ تصف الصحّة</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <RatioCard
            label="نسبة ما يُباع"
            value={`${growth.sellThrough}٪`}
            hint="من الإعلانات المنشورة"
          />
          <RatioCard
            label="متوسّط الصفقة"
            value={formatAmount(growth.averageSale)}
            hint="ريال — للصفقات المكتملة"
          />
          <RatioCard
            label="مزايدات لكل مزاد"
            value={String(growth.bidsPerAuction)}
            hint="متوسّط المزايدات المقبولة"
          />
          <RatioCard
            label="مشترون عائدون"
            value={String(growth.repeatBuyers)}
            hint="أتمّوا أكثر من صفقة"
          />
        </div>
      </div>
    </div>
  )
}

function TrendCard({ label, trend, money }: { label: string; trend: Trend; money?: boolean }) {
  const show = (value: number) => (money ? formatAmount(value) : String(value))
  const up = trend.deltaPercent !== null && trend.deltaPercent > 0
  const down = trend.deltaPercent !== null && trend.deltaPercent < 0
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus

  return (
    <div className="rounded-2xl border border-ink-600 bg-ink-800 p-4">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums">
        {show(trend.current)}
        {money && <span className="ms-1 text-xs font-normal text-muted">ريال</span>}
      </p>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
        <span
          className={cn(
            'inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 font-bold',
            up
              ? 'border-success/50 bg-success/10 text-success'
              : down
                ? 'border-danger/50 bg-danger/10 text-danger'
                : 'border-ink-600 bg-ink-900 text-muted',
          )}
        >
          <Icon className="size-3" />
          {/*
            * من صفرٍ إلى شيءٍ لا نسبة له.
            *
            * القسمة على صفر تُخرج «∞٪» أو «NaN» — ويُقال «جديد» لأنّها الحال
            * التي يعنيها الرقم: لم يكن في النافذة السابقة شيءٌ يُقاس عليه.
            */}
          {trend.deltaPercent === null
            ? trend.current > 0
              ? 'جديد'
              : '—'
            : `${trend.deltaPercent > 0 ? '+' : ''}${trend.deltaPercent}٪`}
        </span>
        <span className="text-muted">
          سابقًا <span className="tabular-nums">{show(trend.previous)}</span>
        </span>
      </p>
    </div>
  )
}

function RatioCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-ink-600 bg-ink-800 p-4">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums text-gold-500">{value}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted">{hint}</p>
    </div>
  )
}
