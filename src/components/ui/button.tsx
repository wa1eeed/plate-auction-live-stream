'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-[background,color,box-shadow,transform] duration-150 disabled:pointer-events-none disabled:opacity-45 active:scale-[0.985] [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-gold-500 text-ink-950 hover:bg-gold-400 shadow-[0_8px_24px_-12px_rgba(214,168,75,0.9)]',
        secondary: 'bg-ink-700 text-paper hover:bg-ink-600 border border-ink-600',
        outline: 'border border-ink-600 bg-transparent text-paper hover:bg-ink-800',
        ghost: 'text-muted hover:bg-ink-800 hover:text-paper',
        success: 'bg-success text-white hover:bg-success/90',
        danger: 'bg-danger text-white hover:bg-danger/90',
        link: 'text-gold-500 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-12 px-6 text-base',
        xl: 'h-16 px-8 text-lg rounded-2xl',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
