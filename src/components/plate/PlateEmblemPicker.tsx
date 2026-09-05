'use client'

import { Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { EmblemIcon } from './EmblemGraphic'
import { PLATE_EMBLEMS, PLATE_EMBLEM_LABELS, type PlateEmblem } from '@/lib/domain/types'

type Props = {
  value: PlateEmblem
  onChange: (value: PlateEmblem) => void
  customUrl?: string | null
  onCustomUrlChange?: (value: string) => void
  allowCustom?: boolean
}

/**
 * اختيار الشعار الوسطي: مصغّرة واسم.
 *
 * ولا معاينة هنا: اللوحة في رأس النموذج تُري أثر الاختيار فورًا، ولوحتان في
 * صفحةٍ واحدة تسألان أيّهما الحقيقية.
 */
export function PlateEmblemPicker({
  value,
  onChange,
  customUrl,
  onCustomUrlChange,
  allowCustom = true,
}: Props) {
  /*
   * لا خيار «بلا شعار».
   *
   * الاختيار لا يُعرض أصلًا إلّا للطويلة الخصوصية، وهي وحدها التي يُرسم في
   * وسطها شعار. فوسطٌ فارغ ليس إصدارًا من إصداراتها، وعرضه يدعو إلى لوحةٍ
   * ناقصة. وتبقى `none` في النطاق لأنّ لوحاتٍ محفوظة قد تحملها.
   */
  const options = PLATE_EMBLEMS.filter(
    (key) => key !== 'none' && (allowCustom || key !== 'custom'),
  )

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
                {key === 'custom' ? (
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

    </div>
  )
}
