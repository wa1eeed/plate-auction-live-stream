'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { MediaImage } from '@/components/ui/media-image'
import type { BannerView } from '@/lib/domain/types'

/** تبديلٌ تلقائيّ كلّ هذه المدّة — ما لم تلمسه يدٌ أو يُطلب تقليل الحركة. */
const ROTATE_MS = 6000

/**
 * شريحةُ بنرات — إعلاناتٌ مدفوعة وترويجُ أقسام.
 *
 * ومبنيّةٌ على **تمريرٍ أصليّ** بـ`scroll-snap` لا على تحويلاتٍ محسوبة: السحب
 * باللمس يعمل بلا كود، والاتّجاه ينقلب مع الصفحة وحده، وقارئُ الشاشة يجد
 * قائمةً لا عناصرَ مخفيّةً بتحويلات. وهو ما فُعل بكاروسيل اللوحات قبله.
 *
 * **والنسبة مفروضةٌ عند الرفع (2:1)، ومحجوزةٌ هنا بـ`aspect-[2/1]`.** فلا
 * يقفز ما تحت البنر حين تنزل الصورة — وقفزةُ التخطيط في أوّل الشاشة أسوأ
 * ما يُرى في صفحةٍ أوّلُها إعلان.
 */
export function BannerSlider({ banners }: { banners: BannerView[] }) {
  const trackRef = useRef<HTMLUListElement>(null)
  const [active, setActive] = useState(0)
  const reduceMotion = useReducedMotion()
  /** يدٌ لمست الشريحة — فلا يُبدَّل تحتها */
  const touched = useRef(false)
  /*
   * ونسخةٌ في الحالة لا في المِعلاق وحده: شريطُ المهلة في النقطة يُرسم،
   * والمِعلاقُ لا يُعيد الرسم. فاللمسةُ توقف العدّ **وتُرى** واقفًا.
   */
  const [held, setHeld] = useState(false)

  const scrollTo = useCallback((index: number) => {
    const node = trackRef.current
    if (!node) return
    const child = node.children[index] as HTMLElement | undefined
    if (!child) return
    node.scrollTo({ left: child.offsetLeft - node.offsetLeft, behavior: 'smooth' })
  }, [])

  /*
   * الشريحةُ الظاهرة تُقرأ من التمرير لا تُحسب.
   *
   * فالسحب باليد والتبديل التلقائيّ يُحدِّثان النقاط بالطريق نفسه، ولا
   * يفترقان فتُضيء نقطةٌ غيرُ التي تُرى.
   */
  useEffect(() => {
    const node = trackRef.current
    if (!node) return

    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const width = node.clientWidth || 1
        setActive(Math.round(Math.abs(node.scrollLeft) / width))
      })
    }
    node.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      node.removeEventListener('scroll', onScroll)
    }
  }, [])

  useEffect(() => {
    if (banners.length < 2 || reduceMotion) return
    const timer = setInterval(() => {
      if (touched.current) return
      setActive((current) => {
        const next = (current + 1) % banners.length
        scrollTo(next)
        return next
      })
    }, ROTATE_MS)
    return () => clearInterval(timer)
  }, [banners.length, reduceMotion, scrollTo])

  /* لا عدَّ مع تقليل الحركة، ولا بعد أن تُمسك الشريحةُ بيد */
  const paused = held || Boolean(reduceMotion)

  if (banners.length === 0) return null

  return (
    <section aria-label="إعلانات المنصّة" className="space-y-2">
      <ul
        ref={trackRef}
        /*
         * `touchstart` لا `pointerdown`: التبديل يُوقَف بلمسةٍ لا بمرور
         * الفأرة فوقه — وعلى الحاسوب تكفي الأسهم والنقاط.
         */
        onTouchStart={() => {
          touched.current = true
          setHeld(true)
        }}
        /*
          * **وتُطلّ المجاورةُ من الحافّة.**
          *
          * وشريحةٌ بعرض الشاشة كاملًا تُخفي ما بعدها، فلا يُعرف أنّ ثَمّ
          * غيرَها إلّا من النقاط تحتها — ولا يدعو شيءٌ إلى السحب. وطرفٌ
          * ظاهرٌ من التالية يقول «ثَمّ مزيد» ويُغري باليد، وهو ما تفعله
          * الشرائحُ في التطبيقات.
          *
          * والهامشُ `7%` من الجانبين مع عرضِ `86%`: به تستقرّ الشريحةُ في
          * منتصف الشاشة تمامًا عند الالتقاط، وتبقى للأولى والأخيرة مساحةٌ
          * تتوسّطان فيها.
          */
        className="scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-[7%] scroll-px-[7%]"
      >
        {/*
          * **الحاضرةُ وحدها بكامل حجمها.**
          *
          * وشريطٌ تنزلق فيه بطاقاتٌ متساويةٌ يُقرأ قائمةً مسطّحة. وانكماشُ
          * ما لم يحضر وبهتانُه يصنع عمقًا: تُحسّ البطاقةُ قادمةً من خلف
          * أختها، وهو ما يفرّق شريحةً حيّةً من صفٍّ يُمرَّر.
          *
          * وبـ`transform` و`opacity` وحدهما: كلتاهما تُرسمان في المُركِّب
          * بلا إعادة تخطيط، فلا تهتزّ الصفحةُ مع كلّ تمريرة.
          */}
        {banners.map((banner, index) => (
          <li
            key={banner.id}
            className={cn(
              'w-[86%] shrink-0 snap-center transition-[scale,opacity] duration-500 ease-out',
              index === active ? 'scale-100 opacity-100' : 'scale-[0.93] opacity-55',
            )}
          >
            <BannerCard banner={banner} priority={index === 0} />
          </li>
        ))}
      </ul>

      {banners.length > 1 && (
        <div
          className="flex items-center justify-center gap-1.5"
          aria-hidden
          style={{ '--banner-rotate': `${ROTATE_MS}ms` } as CSSProperties}
        >
          {banners.map((banner, index) => (
            <button
              key={banner.id}
              type="button"
              data-compact
              aria-label={`الإعلان ${index + 1}`}
              onClick={() => {
                touched.current = true
                setHeld(true)
                scrollTo(index)
              }}
              className={cn(
                'h-1.5 overflow-hidden rounded-full transition-all duration-300',
                index === active ? 'w-7 bg-ink-600' : 'w-1.5 bg-ink-600',
              )}
            >
              {/*
                * **النقطةُ الحاضرة تمتلئ بمقدار ما بقي.**
                *
                * فشريحةٌ تتبدّل كلّ ستّ ثوانٍ بلا إشارةٍ إلى موعدها تبدّلُ
                * نفسَها فجأةً تحت العين. والامتلاءُ يقول متى — وهو ما تفعله
                * القصصُ في التطبيقات.
                *
                * ويقف مع التبديل: من لمس الشريحة ملكها، فلا عدٌّ يُلاحقه.
                */}
              <span
                key={`${banner.id}-${active}-${String(paused)}`}
                className={cn(
                  'block h-full rounded-full bg-gold-500',
                  index === active && !paused ? 'banner-tick' : 'w-full',
                  index === active ? '' : 'hidden',
                )}
              />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

function BannerCard({ banner, priority }: { banner: BannerView; priority: boolean }) {
  /*
   * `next/image` لا يُستعمل هنا.
   *
   * ومُحسِّنُه يقتضي `sharp` في الحاوية، والخادمُ بنواةٍ واحدة (`cpus: 1`)
   * — فتحويلُ صورةٍ عليه يحبسه عن كلّ طلبٍ آخر. والتصغيرُ يقع حيث يكلّف
   * مرّةً واحدة: في متصفّح من يرفع (`@/lib/client/downscale-image`).
   *
   * وكان التعليلُ هنا أنّ الصور تسكن R2 بنطاقٍ من البيئة — وR2 أُسقط من
   * المشروع، والقرارُ باقٍ بعلّةٍ أمتن.
   */
  const image = (
    <MediaImage
      src={banner.imageUrl}
      alt={banner.alt}
      width={banner.width}
      height={banner.height}
      /*
       * **الأوّلُ يُجلب فورًا.** وهو فوق الطيّة دائمًا، و`lazy` عليه تأجيلٌ
       * حتى يُحسب التخطيط — فيبدأ طلبُه متأخّرًا بلا مكسب.
       */
      priority={priority}
    />
  )

  /* `edge-runner` شعاعٌ يمشي على الأطراف — تعريفُه وعلّتُه في `globals.css` */
  const frame =
    'edge-runner block overflow-hidden rounded-2xl border border-ink-600/70 bg-ink-800 aspect-[2/1]'

  if (!banner.linkUrl) {
    return <div className={frame}>{image}</div>
  }

  const external = banner.linkUrl.startsWith('http')
  return external ? (
    <a
      href={banner.linkUrl}
      /* `noopener` شرطٌ لا زينة: بلاه تبلغ الصفحةُ المفتوحة نافذتَنا وتوجّهها */
      target="_blank"
      rel="noopener noreferrer"
      className={cn(frame, 'transition-transform active:scale-[0.99]')}
    >
      {image}
    </a>
  ) : (
    <Link href={banner.linkUrl} className={cn(frame, 'transition-transform active:scale-[0.99]')}>
      {image}
    </Link>
  )
}
