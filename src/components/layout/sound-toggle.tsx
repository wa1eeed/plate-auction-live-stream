'use client'

import { Volume2, VolumeX } from 'lucide-react'
import { useSound } from '@/lib/hooks/use-sound'
import { cn } from '@/lib/utils'

/** مفتاح أصوات المنصّة — صامت افتراضيًا، والاختيار يُحفظ على الجهاز. */
export function SoundToggle({ className }: { className?: string }) {
  const { enabled, toggle } = useSound()

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={enabled}
      aria-label={enabled ? 'إيقاف أصوات المنصّة' : 'تشغيل أصوات المنصّة'}
      title={enabled ? 'الأصوات مفعّلة' : 'الأصوات صامتة'}
      className={cn(
        'flex size-9 items-center justify-center rounded-xl border transition-colors',
        enabled
          ? 'border-gold-600/50 bg-gold-500/12 text-gold-500'
          : 'border-ink-600 bg-ink-800 text-muted hover:border-ink-500 hover:text-paper',
        className,
      )}
    >
      {enabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
    </button>
  )
}
