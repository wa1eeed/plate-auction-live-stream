'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StoryView } from '@/lib/domain/types'

/**
 * عارضُ الستوري — ملءَ الشاشة، بشريطِ تقدّمٍ لكلّ حلقة.
 *
 * وثلاثةُ أشياء تجعله يُحَسّ كعارض النظام:
 *
 *  ١. **ضغطةٌ يمينًا تتقدّم ويسارًا تعود** — في صفحةٍ عربية: الضغطةُ في
 *     الثلث الأوّل من العرض تعود، وما بعده يتقدّم. ولا أزرارَ ظاهرة.
 *  ٢. **الضغطُ المطوَّل يوقف** — من أراد قراءة ما في الصورة أمسك.
 *  ٣. **التقدّمُ يتبع الفدّيو نفسه** لا مؤقّتًا موازيًا: فدّيو تأخّر تحميله
 *     لا يسبقه الشريط فيُغلق قبل أن يُرى.
 *
 * **والستوري شرائحُ لا شريحة.** فالتقدّمُ يمضي في شرائحه أوّلًا، فإذا نفدت
 * انتقل إلى الستوري التالي — وشريطُ التقدّم أعلاه يعدّ شرائحَ الحاضر وحده،
 * كما في تطبيقات التواصل. ولولا ذلك لكان شريطٌ بثلاثين قطعةً لا يُقرأ.
 */
export function StoryViewer({
  stories,
  startAt,
  onSeen,
  onClose,
}: {
  stories: StoryView[]
  startAt: number
  onSeen: (id: string) => void
  onClose: () => void
}) {
  const [index, setIndex] = useState(startAt)
  const [slideIndex, setSlideIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const story = stories[index]
  const slide = story?.slides[Math.min(slideIndex, story.slides.length - 1)]

  /**
   * خطوةٌ واحدة — في الشرائح أوّلًا، ثمّ بين الستوريز.
   *
   * وتقدّمٌ من آخر شريحةٍ ينتقل إلى الستوري التالي من أوّله، ورجوعٌ من أوّل
   * شريحةٍ يعود إلى **آخر** شرائح السابق — لا أوّلها: من رجع يريد ما فاته.
   */
  const go = useCallback(
    (delta: number) => {
      setProgress(0)
      setSlideIndex((currentSlide) => {
        const story = stories[index]
        if (!story) return currentSlide
        const next = currentSlide + delta
        if (next >= 0 && next < story.slides.length) return next

        const nextStory = index + delta
        if (nextStory < 0) return currentSlide
        if (nextStory >= stories.length) {
          onClose()
          return currentSlide
        }
        setIndex(nextStory)
        return delta > 0 ? 0 : Math.max(0, stories[nextStory].slides.length - 1)
      })
    },
    [stories, index, onClose],
  )

  /* الحلقة تُعدّ مشاهَدةً بمجرّد بلوغها — لا بإتمامها */
  useEffect(() => {
    if (story) onSeen(story.id)
  }, [story, onSeen])

  /*
   * **الصفحة خلفه لا تُمرَّر.**
   *
   * وبلا هذا يتحرّك ما تحته مع الإصبع وهو يضغط للتقدّم، فتُرى الرئيسية
   * تنزلق خلف عارضٍ يملأ الشاشة.
   */
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      /* في صفحةٍ عربية: السهم الأيسر يتقدّم، والأيمن يعود */
      if (event.key === 'ArrowLeft') go(1)
      if (event.key === 'ArrowRight') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, onClose])

  /* الصورة: مؤقّتٌ بمدّتها. والفدّيو يقود نفسه في `onTimeUpdate` أدناه. */
  useEffect(() => {
    if (!slide || slide.mediaKind === 'video' || paused) return
    const total = slide.durationSeconds * 1000
    const startedAt = Date.now() - progress * total
    let frame = 0

    const tick = () => {
      const ratio = Math.min(1, (Date.now() - startedAt) / total)
      setProgress(ratio)
      if (ratio >= 1) {
        go(1)
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
    // `progress` مقصودُ الإغفال: إدراجه يُعيد بناء المؤقّت في كلّ إطار
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide, paused, go])

  useEffect(() => {
    const node = videoRef.current
    if (!node) return
    if (paused) node.pause()
    else void node.play().catch(() => undefined)
  }, [paused, index, slideIndex])

  if (!story || !slide) return null

  return (
    <div
      role="dialog"
      aria-modal
      aria-label={story.title}
      className="fixed inset-0 z-[60] flex flex-col bg-black"
      style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)' }}
    >
      {/*
        * شريطُ التقدّم — قطعةٌ لكلّ **شريحةٍ في الستوري الحاضر**.
        *
        * ولا قطعةٌ لكلّ ستوري: عشرُ حلقاتٍ بثلاث شرائحَ تُخرج ثلاثين قطعةً
        * لا تُقرأ ولا تُقاس. وهذا ما تفعله التطبيقاتُ نفسها.
        */}
      <div className="flex gap-1 px-3 pt-3" aria-hidden>
        {story.slides.map((item, position) => (
          <span key={item.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/25">
            <span
              className="block h-full rounded-full bg-white"
              style={{
                width:
                  position < slideIndex
                    ? '100%'
                    : position === slideIndex
                      ? `${progress * 100}%`
                      : '0%',
                transition: position === slideIndex ? 'none' : 'width 150ms linear',
              }}
            />
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between px-3 py-2">
        <p className="truncate text-sm font-bold text-white">{story.title}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق"
          className="grid size-9 place-items-center rounded-full bg-white/10 text-white"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        {slide.mediaKind === 'video' ? (
          <video
            ref={videoRef}
            key={slide.id}
            src={slide.mediaUrl}
            poster={slide.posterUrl ?? undefined}
            playsInline
            autoPlay
            /* صامتٌ ابتداءً: متصفّحات الجوال لا تُشغّل تلقائيًّا ما له صوت */
            muted
            onTimeUpdate={(event) => {
              const node = event.currentTarget
              if (node.duration > 0) setProgress(node.currentTime / node.duration)
            }}
            onEnded={() => go(1)}
            className="size-full object-contain"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={slide.id}
            src={slide.mediaUrl}
            alt={slide.alt}
            className="size-full object-contain"
            decoding="async"
          />
        )}

        {/*
          * مناطقُ اللمس فوق المحتوى — لا أزرارَ ظاهرة.
          *
          * والثلثُ الأوّل يعود وما بعده يتقدّم، بالمنطق البصريّ لا بالفيزيائيّ:
          * `start` تنقلب مع اتّجاه الصفحة وحدها.
          */}
        <div className="absolute inset-0 flex">
          <button
            type="button"
            aria-label="السابق"
            className="h-full w-1/3"
            onClick={() => go(-1)}
            onPointerDown={() => setPaused(true)}
            onPointerUp={() => setPaused(false)}
            onPointerCancel={() => setPaused(false)}
          />
          <button
            type="button"
            aria-label="التالي"
            className="h-full flex-1"
            onClick={() => go(1)}
            onPointerDown={() => setPaused(true)}
            onPointerUp={() => setPaused(false)}
            onPointerCancel={() => setPaused(false)}
          />
        </div>
      </div>

      {story.linkUrl && (
        <div className="px-4 pb-4 pt-3">
          <StoryLink href={story.linkUrl} onNavigate={onClose} />
        </div>
      )}
    </div>
  )
}

function StoryLink({ href, onNavigate }: { href: string; onNavigate: () => void }) {
  const label = (
    <>
      اعرض التفاصيل
      <ArrowLeft className="size-4" />
    </>
  )
  const className = cn(
    'flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3',
    'text-sm font-extrabold text-black transition-transform active:scale-[0.98]',
  )

  return href.startsWith('http') ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {label}
    </a>
  ) : (
    <Link href={href} onClick={onNavigate} className={className}>
      {label}
    </Link>
  )
}
