'use client'

import { Toaster as SonnerToaster } from 'sonner'

/**
 * التنبيهات — أعلى الشاشة، وتحت شريط الحالة لا فوقه.
 *
 * وموضعُها أعلى الشاشة مقصود: تنبيهُ «سُجّلت مزايدتك» يُقرأ حيث تنظر العين،
 * لا أسفلَ الشاشة حيث يغطّيه الإبهام على الزرّ نفسه الذي أنتجه.
 *
 * والإزاحة بمقدار الشقّ: بلاها يقع التنبيه **تحت ساعة النظام** فلا يُقرأ.
 * و`calc` لا `var` وحدها — فيُضاف إليها هامشٌ يفصله عن حرف الشريط.
 */
export function Toaster() {
  return (
    <SonnerToaster
      dir="rtl"
      position="top-center"
      offset="calc(var(--safe-top) + 0.75rem)"
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
