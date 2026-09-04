import { cn } from '@/lib/utils'
import { SkipLink } from './skip-link'

/**
 * غلاف الصفحات بالسمة الفاتحة.
 * `data-theme="light"` يُعاد تعريف رموز الألوان تحته فتتبعه كل المكوّنات
 * تلقائيًا، ويُطبَّق أثناء التصيير على الخادم فلا يحدث وميض داكن.
 */
export function PageShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div data-theme="light" className={cn('relative flex min-h-dvh flex-col bg-ink-950 text-paper', className)}>
      <SkipLink />
      {children}
    </div>
  )
}
