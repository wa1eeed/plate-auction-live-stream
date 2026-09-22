'use client'

import { Volume2, VolumeX } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { useSound } from '@/lib/hooks/use-sound'
import { cn } from '@/lib/utils'

/**
 * صفُّ الصوت في الإعدادات — **صفٌّ كامل يُضغط، لا أيقونةٌ في طرفه**.
 *
 * وأيقونةُ الهيدر تصلح حيث تُختصر المساحة، ولا تصلح في قائمة إعدادات: حالُها
 * تُقرأ من شكلها لا من نصّها، وهدفُها بقدر الأيقونة. وصفوفُ الإعدادات تُقرأ
 * بنظرةٍ وتُبدَّل بلمسةٍ في أيّ موضعٍ منها.
 */
export function SoundSettingRow() {
  const { enabled, toggle } = useSound()

  return (
    <button
      type="button"
      aria-pressed={enabled}
      onClick={toggle}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start transition-colors hover:bg-ink-700/40"
    >
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors',
          enabled ? 'bg-gold-500/15 text-gold-500' : 'border border-ink-600 bg-ink-900 text-muted',
        )}
      >
        {enabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">أصوات المنصّة</span>
        <span className="mt-0.5 block text-[12px] leading-relaxed text-muted">
          {enabled ? 'تكّةٌ عند المزايدة وفي الثواني الأخيرة' : 'صامتة'}
        </span>
      </span>

      {/* يُرى ولا يُضغط وحده — الصفُّ كلُّه هو الهدف */}
      <span className="pointer-events-none shrink-0">
        <Switch checked={enabled} aria-hidden tabIndex={-1} />
      </span>
    </button>
  )
}
