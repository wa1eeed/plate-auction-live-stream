'use client'

import { X } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SAUDI_PLATE_LETTERS } from '@/lib/saudi-plate-mapping'
import { cn } from '@/lib/utils'

/** خانة فارغة — الحروف من واحد إلى ثلاثة، فالخانتان الأخيرتان اختياريتان. */
const EMPTY = '—'

/**
 * اختيار حروف اللوحة من قوائم لا بالكتابة.
 *
 * الحروف المعتمدة سبعة عشر فقط، ومقابلها اللاتيني غير متوقّع لغويًا
 * (ص → X، م → Z، ع → E). الكتابة الحرّة تعني أخطاءً متكرّرة وتطبيعًا صامتًا
 * يفاجئ البائع؛ والقائمة تعرض الحرف ومقابله معًا فلا يبقى تخمين.
 *
 * أوّل خانة إلزامية والباقي اختياري، وإفراغ خانة يُسقط ما بعدها فلا تبقى
 * فجوة بين الحروف.
 */
export function LetterPicker({
  value,
  onChange,
  maxLetters,
  error,
}: {
  /** الحروف العربية المعتمدة، من صفر إلى `maxLetters` */
  value: string
  onChange: (letters: string) => void
  maxLetters: number
  error?: string
}) {
  const letters = Array.from(value)
  const slots = Array.from({ length: maxLetters }, (_, index) => letters[index] ?? '')

  function setSlot(index: number, letter: string) {
    const next = [...slots]
    next[index] = letter === EMPTY ? '' : letter
    // إفراغ خانة يُسقط ما بعدها: «ا _ ح» ليست لوحة صالحة
    if (!next[index]) for (let i = index + 1; i < next.length; i += 1) next[i] = ''
    onChange(next.filter(Boolean).join(''))
  }

  return (
    <div className="space-y-1.5">
      <Label>حروف اللوحة</Label>
      <div className="grid grid-cols-3 gap-2" dir="rtl">
        {slots.map((letter, index) => {
          // لا تُفتح خانة قبل ملء ما قبلها
          const disabled = index > 0 && !slots[index - 1]
          return (
            <Select
              key={index}
              value={letter || EMPTY}
              onValueChange={(next) => setSlot(index, next)}
              disabled={disabled}
            >
              <SelectTrigger
                aria-label={`الحرف ${index + 1}`}
                className={cn('h-12', error && index === 0 && 'border-danger')}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {index > 0 && (
                  <SelectItem value={EMPTY}>
                    <span className="flex items-center gap-2 text-muted">
                      <X className="size-3.5" />
                      بلا حرف
                    </span>
                  </SelectItem>
                )}
                {SAUDI_PLATE_LETTERS.map((entry) => (
                  <SelectItem key={entry.ar} value={entry.ar}>
                    <span className="flex items-center gap-2.5">
                      <span className="text-base font-extrabold">{entry.ar}</span>
                      <span className="text-xs text-muted" dir="ltr">
                        {entry.en}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        })}
      </div>
      <p className="text-[11px] text-muted">
        {maxLetters === 2
          ? 'حرف واحد أو حرفان — لوحات الدراجات النارية.'
          : 'حرف واحد على الأقل، وثلاثة على الأكثر.'}
      </p>
      {error && <p className="text-[11px] font-semibold text-danger">{error}</p>}
    </div>
  )
}
