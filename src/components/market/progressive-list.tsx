'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Children, isValidElement } from 'react'
import { ListPlus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** حجم الدفعة في صفحات الحساب — يملأ شاشتين على الجوال. */
const PAGE_SIZE = 8

/**
 * قائمة تنمو على دفعات.
 *
 * صفحات الحساب تُصيّر كل ما يملكه صاحبها: من له مئة مزايدة يدفع ثمن تصيير
 * مئة بطاقة ليرى أربعًا. والنموّ هنا **بلا طلب شبكة** — البيانات وصلت مع
 * الصفحة، والمكسب في الرسم لا في الشبكة.
 *
 * وزرٌّ صريح مع حارس التمرير لا بدلًا منه: التمرير اللانهائي وحده يحبس من
 * يتنقّل بلوحة المفاتيح فلا يبلغ حافّةً تُحمّل.
 */
export function ProgressiveList({
  children,
  className,
  label = 'عرض المزيد',
}: {
  children: React.ReactNode
  className?: string
  label?: string
}) {
  const items = Children.toArray(children).filter(isValidElement)
  const [shown, setShown] = useState(PAGE_SIZE)
  const [appending, startAppending] = useTransition()
  const sentinel = useRef<HTMLDivElement>(null)

  const total = items.length
  const hasMore = shown < total

  useEffect(() => {
    const node = sentinel.current
    if (!node || !hasMore) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          startAppending(() => setShown((count) => count + PAGE_SIZE))
        }
      },
      // يبدأ قبل بلوغ الحافّة بشاشة، فلا يرى صاحب الصفحة انتظارًا
      { rootMargin: '600px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore])

  return (
    <>
      <ul className={cn('space-y-3', className)}>{items.slice(0, shown)}</ul>

      {hasMore && (
        <div ref={sentinel} className="mt-4 flex flex-col items-center gap-2">
          <Button
            variant="secondary"
            disabled={appending}
            onClick={() => startAppending(() => setShown((count) => count + PAGE_SIZE))}
          >
            {appending ? <Loader2 className="size-4 animate-spin" /> : <ListPlus className="size-4" />}
            {label}
          </Button>
          <p aria-live="polite" className="text-xs text-muted">
            عُرض {Math.min(shown, total)} من {total}
          </p>
        </div>
      )}
    </>
  )
}
