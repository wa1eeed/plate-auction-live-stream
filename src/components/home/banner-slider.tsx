'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'
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
        }}
        className="scrollbar-none flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
      >
        {banners.map((banner) => (
          <li key={banner.id} className="w-full shrink-0 snap-center px-4 sm:px-6">
            <BannerCard banner={banner} />
          </li>
        ))}
      </ul>

      {banners.length > 1 && (
        <div className="flex items-center justify-center gap-1.5" aria-hidden>
          {banners.map((banner, index) => (
            <button
              key={banner.id}
              type="button"
              data-compact
              aria-label={`الإعلان ${index + 1}`}
              onClick={() => {
                touched.current = true
                scrollTo(index)
              }}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                index === active ? 'w-5 bg-gold-500' : 'w-1.5 bg-ink-600',
              )}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function BannerCard({ banner }: { banner: BannerView }) {
  /*
   * `next/image` لا يُستعمل هنا.
   *
   * الصورة تسكن R2 بنطاقٍ يُضبط من البيئة، ومُحسِّن Next يشترط `remotePatterns`
   * مخبوزةً في البناء — فنطاقٌ يُبدَّل يعني بناءً جديدًا. والصورة مرفوعةٌ
   * بمقاسها سلفًا (٢:١) ولا تحتاج قصًّا، فالمكسب من المُحسِّن قليلٌ والثمن
   * ربطُ النشر بالبناء.
   */
  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={banner.imageUrl}
      alt={banner.alt}
      width={banner.width}
      height={banner.height}
      loading="lazy"
      decoding="async"
      className="size-full object-cover"
    />
  )

  const frame = 'block overflow-hidden rounded-2xl border border-ink-600/70 bg-ink-800 aspect-[2/1]'

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
