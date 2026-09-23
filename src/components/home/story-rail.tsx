'use client'

import { useEffect, useState } from 'react'
import { Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StoryView } from '@/lib/domain/types'
import { StoryViewer } from './story-viewer'

/**
 * شريطُ الستوريز — أوّلُ ما يُرى في الرئيسية.
 *
 * حلقاتٌ تُمرَّر أفقيًّا وتُفتح ملءَ الشاشة. والحلقةُ تحمل غلافها لا رمزًا:
 * الفدّيو يُعرض بغلافه المرفوع معه، والصورةُ غلافُ نفسها.
 *
 * **والمشاهَد يُحفظ في المتصفّح وحده** (`localStorage`): حلقةٌ رُئيت تفقد
 * إطارها الذهبيّ. ولا يُرفع إلى الخادم — وهو قرارٌ لا كسل: تتبّعُ من رأى
 * ماذا يعني جدولًا يكبر بعدد المستخدمين في عدد الستوريز لأجل حلقةٍ ملوّنة.
 */
const SEEN_KEY = 'pa_stories_seen'

function readSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    /* نافذةٌ خاصّة أو تخزينٌ محجوب — تُعرض كلُّها جديدة، وهو أهون الضررين */
    return new Set()
  }
}

export function StoryRail({ stories }: { stories: StoryView[] }) {
  const [openAt, setOpenAt] = useState<number | null>(null)
  /*
   * يُقرأ في `useEffect` لا في المُهيّئ ولا في جسم الرسم.
   *
   * `localStorage` لا وجود له في الخادم، فقراءتُه في المُهيّئ تجعل ما رُسم
   * هناك يخالف ما رُطِّب هنا. **وجدولتُه من جسم الرسم أسوأ**: تحديثُ حالةٍ
   * من مكوّنٍ لم يُركَّب بعد — وقد صرخ به React في وحدة التحكّم أوّل مرّة.
   * و`useEffect` يقع بعد التركيب، فتُرسم الحلقات كلُّها جديدةً ثمّ يُصحَّح
   * ما رُئي في الإطار التالي.
   */
  const [seen, setSeen] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    setSeen(readSeen())
  }, [])

  const markSeen = (id: string) => {
    setSeen((current) => {
      if (current.has(id)) return current
      const next = new Set(current).add(id)
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify([...next]))
      } catch {
        /* لا يضرّ: الحلقة تبقى بإطارها، والعرض يعمل */
      }
      return next
    })
  }

  if (stories.length === 0) return null

  return (
    <>
      <section aria-label="جديد المنصّة">
        <ul className="scrollbar-none flex gap-3 overflow-x-auto overscroll-x-contain px-4 py-1 sm:px-6">
          {stories.map((story, index) => (
            <li key={story.id} className="shrink-0">
              <button
                type="button"
                onClick={() => {
                  markSeen(story.id)
                  setOpenAt(index)
                }}
                className="flex w-[4.75rem] flex-col items-center gap-1.5 text-center"
              >
                {/*
                  * الإطار حلقةٌ ملوّنة حول الغلاف — والمشاهَد يفقد لونه.
                  *
                  * والحشوة بين الحلقة والغلاف (`p-[3px]` وخلفيّةُ الصفحة)
                  * هي ما يجعلها حلقةً لا حدًّا ملتصقًا.
                  */}
                <span
                  className={cn(
                    'relative grid size-[4.25rem] place-items-center rounded-full p-[3px] transition-colors',
                    seen.has(story.id)
                      ? 'bg-ink-600'
                      : 'bg-[linear-gradient(135deg,var(--color-gold-400),var(--color-gold-600))]',
                  )}
                >
                  <span className="grid size-full place-items-center overflow-hidden rounded-full bg-ink-950 p-[2px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={story.posterUrl ?? story.mediaUrl}
                      alt={story.alt}
                      loading="lazy"
                      decoding="async"
                      className="size-full rounded-full object-cover"
                    />
                  </span>
                  {story.mediaKind === 'video' && (
                    <span
                      aria-hidden
                      className="absolute bottom-0 end-0 grid size-5 place-items-center rounded-full border border-ink-950 bg-gold-500 text-ink-950"
                    >
                      <Play className="size-2.5 fill-current" />
                    </span>
                  )}
                </span>
                <span className="line-clamp-1 w-full text-[11px] font-bold text-muted">
                  {story.title}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {openAt !== null && (
        <StoryViewer
          stories={stories}
          startAt={openAt}
          onSeen={markSeen}
          onClose={() => setOpenAt(null)}
        />
      )}
    </>
  )
}
