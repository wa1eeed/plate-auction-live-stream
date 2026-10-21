'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useReducedMotion } from 'framer-motion'
import { ArrowLeft, ChevronLeft, ChevronRight, Gavel, HandCoins, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ListingCard } from './listing-card'
import type { ListingCard as ListingCardData } from '@/lib/domain/types'

/**
 * كاروسيل لوحات.
 *
 * مبنيّ على تمرير أصلي مع `scroll-snap` لا على تحويلات محسوبة يدويًا:
 *  • السحب باللمس يعمل بلا كود — وهو ما يفعله المستخدم على الجوال أولًا.
 *  • التمرير بلوحة المفاتيح والعجلة يعمل تلقائيًا.
 *  • قارئ الشاشة يجد قائمة عادية لا عناصر مخفية بتحويلات.
 *
 * الأسهم إضافة لمستخدمي الفأرة، وتختفي إذا لم يكن هناك ما يُمرَّر إليه.
 * والاتجاه RTL مضبوط: `scrollLeft` يصير سالبًا في المتصفّحات الحديثة،
 * فنتعامل مع القيمة المطلقة بدل افتراض الاتجاه.
 */
/**
 * الأيقونات تُختار باسمها لا بتمرير المكوّن.
 * السبب: الصفحة مكوّن خادم والكاروسيل مكوّن عميل، وReact لا يستطيع تسلسل
 * دالة عبر هذا الحدّ — تمرير المكوّن مباشرةً يُسقط الصفحة بخطأ تسلسل.
 */
const ICONS = { gavel: Gavel, tag: Tag, offers: HandCoins } as const

export type CarouselIcon = keyof typeof ICONS

export function PlateCarousel({
  title,
  description,
  icon,
  accent,
  cards,
  serverTime,
  href,
  emptyLabel,
}: {
  title: string
  description: string
  icon: CarouselIcon
  /** لون القسم — يميّز المزاد عن البيع المباشر عن العروض بلمحة */
  accent: 'gold' | 'success' | 'sky'
  cards: ListingCardData[]
  serverTime: string
  href: string
  emptyLabel: string
}) {
  const trackRef = useRef<HTMLUListElement>(null)
  const [edges, setEdges] = useState({ start: false, end: false })
  const reduceMotion = useReducedMotion()

  const measure = useCallback(() => {
    const node = trackRef.current
    if (!node) return
    // القيمة المطلقة تتجاوز اختلاف إشارة scrollLeft بين اتجاهي الكتابة
    const offset = Math.abs(node.scrollLeft)
    const max = node.scrollWidth - node.clientWidth
    setEdges({ start: offset > 8, end: offset < max - 8 })
  }, [])

  useEffect(() => {
    measure()
    const node = trackRef.current
    if (!node) return
    node.addEventListener('scroll', measure, { passive: true })
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => {
      node.removeEventListener('scroll', measure)
      observer.disconnect()
    }
  }, [measure, cards.length])

  const scrollBy = (direction: 1 | -1) => {
    const node = trackRef.current
    if (!node) return
    // نقفز بعرض بطاقة كاملة تقريبًا فيستقرّ التمرير على حافة بطاقة
    const step = Math.min(node.clientWidth * 0.85, 360)
    node.scrollBy({ left: direction * step, behavior: reduceMotion ? 'auto' : 'smooth' })
  }

  const Icon = ICONS[icon]

  const ACCENT = {
    gold: 'text-gold-500 bg-gold-500/12 border-gold-600/40',
    success: 'text-success bg-success/12 border-success/40',
    sky: 'text-sky-500 bg-sky-500/12 border-sky-500/40',
  }[accent]

  /*
   * **خطٌّ يبدأ بلون القسم ويخفت — فتُفصل الأقسامُ بلا حواجز.**
   *
   * وثلاثةُ كاروسيلاتٍ متتابعةٍ بالمسافة وحدها تُقرأ كتلةً واحدةً تطول،
   * فلا يُعرف أين انتهى «مزادات جارية» وأين بدأ «بيع مباشر» — وهو ما قاله
   * صاحبُ المنصّة: «فوق بعض بدون تمييز».
   *
   * وصندوقٌ حول كلّ قسمٍ كان أثقل: البطاقاتُ صناديقُ أصلًا، فصندوقٌ يضمّها
   * يصير صندوقًا في صندوق. والخطُّ يكفي — ولونُه لونُ القسم فيربط العنوانَ
   * بما تحته، ويخفت إلى اللاشيء فلا يصير حدًّا يقطع.
   *
   * **وتُكتب الأصناف حرفًا لا تُركَّب**: ماسحُ Tailwind يقرأ نصًّا ولا
   * ينفّذ، فـ`from-${accent}` لا يُولَّد — عطبٌ صامتٌ بلا تحذير.
   */
  const RULE = {
    gold: 'bg-[linear-gradient(to_left,var(--color-gold-500)_0_2.75rem,color-mix(in_oklab,var(--color-ink-600)_80%,transparent)_7rem,transparent_100%)]',
    success:
      'bg-[linear-gradient(to_left,var(--color-success)_0_2.75rem,color-mix(in_oklab,var(--color-ink-600)_80%,transparent)_7rem,transparent_100%)]',
    sky: 'bg-[linear-gradient(to_left,var(--color-sky-500)_0_2.75rem,color-mix(in_oklab,var(--color-ink-600)_80%,transparent)_7rem,transparent_100%)]',
  }[accent]

  return (
    <section aria-labelledby={`carousel-${accent}`} className="py-2">
      {/*
        * العنوانُ و«عرض الكل» في صفٍّ واحد — ولا التفاف.
        *
        * كان `flex-wrap`، فينزل الزرُّ سطرًا مستقلًّا على الجوّال: قِيس فكان
        * أربعةً وتسعين بكسلًا تحت العنوان، ورأسُ القسم مئةً وستّةً وعشرين —
        * أي ثلثَ الشاشة قبل أوّل بطاقة. فصارا متقابلين، والوصفُ تحتهما.
        */}
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2
            id={`carousel-${accent}`}
            className="flex items-center gap-2.5 text-lg font-extrabold sm:text-xl"
          >
            <span
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-xl border',
                ACCENT,
              )}
            >
              <Icon className="size-4.5" />
            </span>
            {title}
            {cards.length > 0 && (
              <span className="rounded-full border border-ink-600 px-2 py-0.5 text-xs font-bold text-muted">
                {cards.length}
              </span>
            )}
          </h2>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {/* الأسهم لمستخدمي الفأرة — مخفية عن قارئ الشاشة لأن القائمة تُتصفّح بالتمرير */}
          <div className="hidden gap-1 sm:flex" aria-hidden>
            <ArrowButton
              direction="start"
              disabled={!edges.start}
              onClick={() => scrollBy(1)}
            />
            <ArrowButton direction="end" disabled={!edges.end} onClick={() => scrollBy(-1)} />
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href={href}>
              عرض الكل
              <ArrowLeft className="size-3.5" />
            </Link>
          </Button>
        </div>
      </header>

      {/*
        * **الوصفُ تحت الصفّ كلِّه، سطرًا واحدًا.**
        *
        * وكان داخل عمود العنوان، فيُقاس عرضُه بما بقي بعد «عرض الكل»
        * والأسهم — فينكسر سطرين على الجوّال، ويزيد رأسُ القسم بسطرٍ قبل
        * أوّل بطاقة. وهنا يأخذ العرض كلَّه، و`truncate` تحفظه سطرًا:
        * وصفٌ يُقرأ بلمحة، وما زاد تقوله البطاقاتُ نفسُها.
        */}
      <p className="mt-1 truncate text-[0.8rem] leading-relaxed text-muted sm:text-sm">
        {description}
      </p>

      {/*
        * قطعةٌ صلبةٌ بلون القسم ثمّ خفوتٌ إلى اللاشيء — لا خطٌّ متساوٍ.
        * فالمتساوي حدٌّ يقطع، وهذا بدايةٌ تُشير إلى ما تحتها.
        *
        * **وخارج الترويسة**: هي `flex` بصفٍّ، فابنٌ ثالثٌ فيها يُعصر إلى
        * عرضٍ لا يُرى. جُرّب فاختفى — والخلفيّةُ محسوبةٌ صحيحةً في الحساب.
        */}
      <span aria-hidden className={cn('mt-2.5 mb-3.5 block h-[2px] rounded-full', RULE)} />

      {cards.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-ink-600 bg-ink-800/40 p-10 text-center text-sm text-muted">
          {emptyLabel}
        </p>
      ) : (
        <div className="relative">
          <ul
            ref={trackRef}
            className={cn(
              'enter-stagger scrollbar-none -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0',
              // تلميح بصري بوجود محتوى بعد الحافة
              edges.end && 'edge-fade-start',
            )}
          >
            {/* الدخول بـ CSS لا بـ whileInView: بطاقة لم تدخل الشاشة قط تبقى
                بشفافية صفر، وهو ما يحدث فعلًا لبطاقات الكاروسيل خارج الحافة */}
            {cards.map((card) => (
              <li key={card.id} className="w-[min(20rem,78vw)] shrink-0 snap-start">
                <ListingCard card={card} serverTime={serverTime} index={0} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function ArrowButton({
  direction,
  disabled,
  onClick,
}: {
  direction: 'start' | 'end'
  disabled: boolean
  onClick: () => void
}) {
  const Icon = direction === 'start' ? ChevronRight : ChevronLeft
  return (
    <button
      type="button"
      tabIndex={-1}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex size-9 items-center justify-center rounded-xl border border-ink-600 bg-ink-800 text-muted',
        'transition-all duration-[var(--duration-fast)]',
        'hover:border-ink-500 hover:text-paper active:scale-95',
        'disabled:pointer-events-none disabled:opacity-30',
      )}
    >
      <Icon className="size-4" />
    </button>
  )
}
