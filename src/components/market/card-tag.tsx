import { cn } from '@/lib/utils'

export type CardTagTone = 'gold' | 'success' | 'sky' | 'muted' | 'danger'

const TAG_CLASS: Record<CardTagTone, { chip: string; dot: string }> = {
  gold: { chip: 'bg-gold-500/12 text-gold-400', dot: 'bg-gold-500' },
  success: { chip: 'bg-success/12 text-success', dot: 'bg-success' },
  sky: { chip: 'bg-ink-700/70 text-paper', dot: 'bg-ink-500' },
  muted: { chip: 'bg-ink-700/60 text-muted', dot: 'bg-ink-500' },
  danger: { chip: 'bg-danger/12 text-danger', dot: 'bg-danger' },
}

/**
 * وسم بطاقة: رقاقة خفيفة بلا حدّ — تصف ولا تزاحم اللوحة.
 *
 * موضعها الطبيعي **تحت اللوحة**: هناك فراغ حولها يُستغلّ، وهناك تُقرأ مع ما
 * تصفه لا في طرفٍ بعيد عنه. وهي واحدة في السوق وفي صفقات الحساب: وسمان
 * بتصميمين لمعنًى واحد يجعلان الصفحتين تبدوان من منصّتين.
 */
export function CardTag({
  tone,
  dot = false,
  children,
}: {
  tone: CardTagTone
  dot?: boolean
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold leading-none',
        TAG_CLASS[tone].chip,
      )}
    >
      {dot && <span aria-hidden className={cn('size-1.5 rounded-full', TAG_CLASS[tone].dot)} />}
      {children}
    </span>
  )
}
