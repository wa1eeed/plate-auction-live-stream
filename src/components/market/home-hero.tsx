import Link from 'next/link'
import { ArrowLeft, LayoutGrid, Plus, Radio } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SaudiLicensePlate } from '@/components/plate/SaudiLicensePlate'
import { formatAmount } from '@/lib/domain/money'
import type { Plate } from '@/lib/domain/types'

/**
 * قسم البطل.
 *
 * فكرته أن اللوحة نفسها هي البطل لا النصّ: الزائر جاء ليرى لوحات، فتظهر أمامه
 * لوحة حقيقية من السوق مباشرة — لا صورة زخرفية. وثلاث لوحات متراصّة خلفها
 * توحي بعمق المعروض بلا حاجة إلى ادّعائه بالكلام.
 *
 * مكوّن خادم بلا أي جافاسكربت: حركات الدخول كلّها CSS. الحركة المبنية على JS
 * تُصيَّر بشفافية صفر على الخادم، فيبقى البطل غير مرئي إن تعطّل السكربت —
 * وهو أسوأ ما يمكن أن يصيب أول ما تراه العين.
 */
export function HomeHero({
  plates,
  stats,
}: {
  /** أبرز ثلاث لوحات معروضة — الأولى في المقدّمة */
  plates: Plate[]
  stats: { active: number; liveAuctions: number; sold: number }
}) {
  const [front, ...behind] = plates

  return (
    <section className="relative overflow-hidden">
      {/* طبقتا خلفية: توهّج ذهبي أعلى، وشبكة نقطية تعطي عمقًا بلا ضجيج */}
      <div aria-hidden className="glow pointer-events-none absolute inset-x-0 -top-24 h-[28rem]" />
      <div
        aria-hidden
        className="dot-grid pointer-events-none absolute inset-0 opacity-[0.35] [mask-image:radial-gradient(70%_60%_at_50%_0%,black,transparent)]"
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pb-8 pt-12 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pt-20">
        <div className="text-center lg:text-start">
          <span className="enter inline-flex items-center gap-2 rounded-full border border-gold-600/40 bg-gold-500/10 px-3 py-1.5 text-xs font-bold text-gold-500">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-[pulse-ring_1.6s_ease-out_infinite] rounded-full bg-gold-500 opacity-70" />
              <span className="relative inline-flex size-2 rounded-full bg-gold-500" />
            </span>
            {stats.liveAuctions > 0
              ? stats.liveAuctions === 1
                ? 'مزاد شغّال الحين'
                : `${stats.liveAuctions} مزادات شغّالة الحين`
              : 'سوق تداول لوحات المركبات'}
          </span>

          <h1
            className="enter mt-5 text-balance text-4xl font-extrabold leading-[1.15] sm:text-5xl lg:text-[3.4rem]"
            style={{ '--enter-delay': '60ms' } as React.CSSProperties}
          >
            لوحتك تسوى أكثر
            <br />
            <span className="gold-text">بِعها بسعرها الصح</span>
          </h1>

          <p
            className="enter mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted lg:mx-0"
            style={{ '--enter-delay': '120ms' } as React.CSSProperties}
          >
            اعرض لوحتك بيع مباشر، أو بمزاد، أو استقبل عليها عروض — ومن نفس الحساب زايد على
            لوحات غيرك. المزايدات توصلك لحظة بلحظة، وما يزايد عليك إلا اللي دافع عربونه،
            وسعرك الاحتياطي ما يشوفه أحد غيرك.
          </p>

          <div
            className="enter mt-8 flex flex-wrap justify-center gap-3 lg:justify-start"
            style={{ '--enter-delay': '180ms' } as React.CSSProperties}
          >
            <Button asChild size="lg">
              <Link href="/market">
                <LayoutGrid className="size-4" />
                شوف اللوحات
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/account/listings/new">
                <Plus className="size-4" />
                اعرض لوحتك
              </Link>
            </Button>
          </div>

          <dl
            className="enter mx-auto mt-10 grid max-w-lg grid-cols-3 gap-3 lg:mx-0"
            style={{ '--enter-delay': '240ms' } as React.CSSProperties}
          >
            <Stat value={String(stats.active)} label="لوحة معروضة" />
            <Stat value={String(stats.liveAuctions)} label="مزاد شغّال" accent />
            <Stat value={stats.sold > 0 ? formatAmount(stats.sold) : '—'} label="إجمالي المبيعات" />
          </dl>
        </div>

        {/* رصّة اللوحات — الطبقات الخلفية تحتاج فصلًا واضحًا في الإزاحة
            والدوران والحجم، وإلا بدت نسخة مكرّرة لا رصّة مقصودة */}
        {front && (
          <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
            <div className="relative aspect-[4/3] w-full">
              {behind.slice(0, 2).map((plate, index) => (
                <div
                  key={`${plate.arabicLetters}-${plate.plateNumbers}`}
                  aria-hidden
                  className="enter absolute inset-x-[8%]"
                  style={
                    {
                      top: `${4 + index * 15}%`,
                      zIndex: 1 - index,
                      opacity: 0.5 - index * 0.2,
                      filter: `blur(${1.2 + index * 1.6}px)`,
                      transform: `scale(${0.82 - index * 0.1}) rotate(${-4.5 - index * 4.5}deg)`,
                      '--enter-delay': `${320 + index * 100}ms`,
                    } as React.CSSProperties
                  }
                >
                  <SaudiLicensePlate {...plate} size="fullscreen" showReflection={false} />
                </div>
              ))}

              <div
                className="enter absolute inset-x-0 top-[42%] z-10 rotate-[1.2deg] drop-shadow-[0_34px_64px_rgba(0,0,0,0.6)]"
                style={{ '--enter-delay': '200ms' } as React.CSSProperties}
              >
                <SaudiLicensePlate {...front} size="fullscreen" animated />
              </div>
            </div>

            <p
              className="enter mt-2 flex items-center justify-center gap-1.5 text-xs text-muted"
              style={{ '--enter-delay': '500ms' } as React.CSSProperties}
            >
              <Radio className="size-3 text-gold-500" />
              لوحات معروضة الحين في السوق
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="surface rounded-2xl p-3.5 text-center lg:text-start">
      <dd
        className={`text-xl font-extrabold tabular-nums sm:text-2xl ${accent ? 'text-gold-500' : 'text-paper'}`}
      >
        {value}
      </dd>
      <dt className="mt-0.5 text-[11px] text-muted">{label}</dt>
    </div>
  )
}
