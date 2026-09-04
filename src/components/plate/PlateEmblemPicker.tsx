'use client'

import { Ban, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { EmblemIcon } from './EmblemGraphic'
import { SaudiLicensePlate } from './SaudiLicensePlate'
import { PLATE_EMBLEMS, PLATE_EMBLEM_LABELS, type PlateEmblem, type PlateType } from '@/lib/domain/types'

type Props = {
  value: PlateEmblem
  onChange: (value: PlateEmblem) => void
  plateType: PlateType
  arabicLetters: string
  latinLetters: string
  plateNumbers: string
  customUrl?: string | null
  onCustomUrlChange?: (value: string) => void
  allowCustom?: boolean
}

/** اختيار الشعار الوسطي: مصغّرة + اسم + معاينة فورية على اللوحة. */
export function PlateEmblemPicker({
  value,
  onChange,
  plateType,
  arabicLetters,
  latinLetters,
  plateNumbers,
  customUrl,
  onCustomUrlChange,
  allowCustom = true,
}: Props) {
  const options = PLATE_EMBLEMS.filter((key) => allowCustom || key !== 'custom')

  return (
    <div className="space-y-3">
      <Label>شعار منتصف اللوحة</Label>
      <div className="grid grid-cols-3 gap-2">
        {options.map((key) => {
          const selected = value === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              aria-pressed={selected}
              className={cn(
                'group flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-colors',
                selected
                  ? 'border-gold-500 bg-gold-500/10'
                  : 'border-ink-600 bg-ink-900 hover:border-ink-500 hover:bg-ink-800',
              )}
            >
              {/* المربّع يحاكي وجه اللوحة الأبيض، فلونه ثابت لا يتبع رمز النص:
                  `bg-paper` ينقلب أسود في السمة الفاتحة فيختفي الشعار الأسود. */}
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-ink-600 bg-white">
                {key === 'none' ? (
                  <Ban className="size-5 text-muted" />
                ) : key === 'custom' ? (
                  <Upload className="size-5 text-muted" />
                ) : (
                  <EmblemIcon emblem={key} className="h-8 w-8" />
                )}
              </span>
              <span className="text-[11px] leading-tight text-muted group-hover:text-paper">
                {PLATE_EMBLEM_LABELS[key]}
              </span>
            </button>
          )
        })}
      </div>

      {value === 'custom' && (
        <div className="space-y-2">
          <Label htmlFor="custom-emblem">رابط الشعار المخصص (SVG أو PNG)</Label>
          <Input
            id="custom-emblem"
            dir="ltr"
            placeholder="https://…"
            value={customUrl ?? ''}
            onChange={(event) => onCustomUrlChange?.(event.target.value)}
          />
        </div>
      )}

      <div className="rounded-xl border border-ink-600 bg-ink-900/60 p-3">
        <p className="mb-2 text-xs text-muted">معاينة فورية</p>
        <SaudiLicensePlate
          plateType={plateType}
          arabicLetters={arabicLetters}
          latinLetters={latinLetters}
          plateNumbers={plateNumbers}
          emblem={value}
          customEmblemUrl={customUrl ?? null}
          size="fullscreen"
        />
      </div>
    </div>
  )
}
