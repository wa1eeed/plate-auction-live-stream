'use client'

import { Toaster as SonnerToaster } from 'sonner'

export function Toaster() {
  return (
    <SonnerToaster
      dir="rtl"
      position="top-center"
      closeButton
      toastOptions={{
        classNames: {
          toast: 'rounded-xl border border-ink-600 bg-ink-800 text-paper shadow-2xl',
          description: 'text-muted',
          actionButton: 'bg-gold-500 text-ink-950',
        },
      }}
    />
  )
}
