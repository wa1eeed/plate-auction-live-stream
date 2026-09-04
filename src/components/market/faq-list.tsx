'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FAQ_CATEGORY_LABELS, type FaqItem } from '@/lib/domain/types'

/**
 * قائمة أسئلة قابلة للطيّ.
 *
 * أول سؤال مفتوح افتراضيًا: القائمة المطويّة بالكامل تبدو فارغة، والزائر الذي
 * لا يعرف أن فيها إجابات لا يفتحها.
 */
export function FaqList({
  items,
  showCategory = true,
  className,
}: {
  items: FaqItem[]
  showCategory?: boolean
  className?: string
}) {
  const [open, setOpen] = useState<string | null>(items[0]?.id ?? null)

  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-ink-600 bg-ink-800/50 p-8 text-center text-sm text-muted">
        لا توجد أسئلة منشورة بعد.
      </p>
    )
  }

  return (
    <ul className={cn('space-y-2', className)}>
      {items.map((item) => {
        const expanded = open === item.id
        return (
          <li
            key={item.id}
            className={cn(
              'overflow-hidden rounded-2xl border bg-ink-800 transition-colors',
              expanded ? 'border-gold-600/50' : 'border-ink-600',
            )}
          >
            <h3>
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : item.id)}
                className="flex w-full items-center gap-3 p-4 text-start"
              >
                <span className="min-w-0 flex-1 font-bold">{item.question}</span>
                {showCategory && (
                  <span className="hidden shrink-0 rounded-full border border-ink-600 px-2 py-0.5 text-[11px] text-muted sm:inline">
                    {FAQ_CATEGORY_LABELS[item.category]}
                  </span>
                )}
                <ChevronDown
                  className={cn(
                    'size-4 shrink-0 text-muted transition-transform',
                    expanded && 'rotate-180',
                  )}
                />
              </button>
            </h3>
            {expanded && (
              <p className="whitespace-pre-line border-t border-ink-600 px-4 py-3.5 text-sm leading-relaxed text-muted">
                {item.answer}
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}
