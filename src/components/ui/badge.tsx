import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
  {
    variants: {
      variant: {
        default: 'border-ink-600 bg-ink-700 text-paper',
        gold: 'border-gold-600/60 bg-gold-500/12 text-gold-400',
        success: 'border-success/50 bg-success/12 text-success',
        danger: 'border-danger/50 bg-danger/12 text-danger',
        muted: 'border-ink-600 bg-transparent text-muted',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { badgeVariants }
