'use client'

import { useEffect, useRef, useState } from 'react'
import { formatAmount, groupAmountInput } from '@/lib/domain/money'
import { cn } from '@/lib/utils'

/** عدد الأرقام في نصٍّ — به يُقاس موضع المؤشّر لا بعدد المحارف. */
function digitsIn(text: string): number {
  let count = 0
  for (const char of text) if (char >= '0' && char <= '9') count += 1
  return count
}

/**
 * حقل مبلغ: رقمٌ كبير مفصول الآلاف.
 *
 * المبلغ هو القرار في هذه الشاشة — مزايدةً كان أو سومًا — فيُكتب بحجمٍ يُقرأ
 * من بعيد لا بحجم أيّ حقلٍ آخر. والفاصلة تدخل مع الرقم الرابع، فيُقرأ
 * «1,000,000» بنظرة ولا يُعدّ بالأصابع صفرًا صفرًا — وهي الحالة التي يقع فيها
 * الغلط: مليونٌ يُكتب مكان مئة ألف.
 *
 * والتنسيق أثناء الكتابة يُزحزح المؤشّر إن حُسب بالمحارف، فتقفز اليد كلّما
 * دخلت فاصلة. فيُحفظ موضعه بعدد الأرقام التي قبله ويُعاد إليه بعد التنسيق.
 */
export function AmountField({
  value,
  onChange,
  onBlur,
  label,
  placeholder,
  disabled,
  invalid,
  suffix = 'ريال',
  size = 'lg',
  id,
  className,
}: {
  /** المبلغ بالهللات، و`null` يعني حقلًا فارغًا */
  value: number | null
  onChange: (halalas: number | null) => void
  onBlur?: () => void
  /** يُقرأ لقارئ الشاشة — الحقل رقمٌ بلا تسمية ظاهرة بجانبه */
  label: string
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  suffix?: string
  /**
   * `lg` حيث المبلغ هو القرار — المزايدة والسوم.
   * `md` في النماذج: أكبر من جيرانه ليُقرأ، ودون أن يُزاحمها.
   */
  size?: 'lg' | 'md'
  id?: string
  className?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState(() => (value === null ? '' : formatAmount(value)))
  /** ما كتبه الحقل آخر مرّة — به نعرف أنّ التغيّر جاء من خارجه */
  const emitted = useRef(value)

  /*
   * القيمة إذا تبدّلت من خارج الحقل — رقاقةٌ أو زرّ زيادة — كُتبت فيه.
   *
   * ولا تُكتب إن كان هو مصدرها، وإلّا أُعيد تنسيق ما تحت اليد في أثناء الكتابة
   * فقفز المؤشّر.
   */
  useEffect(() => {
    if (value === emitted.current) return
    emitted.current = value
    setText(value === null ? '' : formatAmount(value))
  }, [value])

  return (
    <div className={cn('relative min-w-0', className)}>
      <input
        ref={inputRef}
        id={id}
        inputMode="decimal"
        dir="ltr"
        autoComplete="off"
        aria-label={label}
        aria-invalid={invalid || undefined}
        placeholder={placeholder}
        value={text}
        disabled={disabled}
        onBlur={onBlur}
        onChange={(event) => {
          const element = event.target
          const raw = element.value
          const caret = element.selectionStart ?? raw.length
          const digitsBefore = digitsIn(raw.slice(0, caret))

          const grouped = groupAmountInput(raw)
          // ما ليس رقمًا يُهمل، ويبقى الحقل على آخر نصٍّ صحيح
          if (!grouped) return

          setText(grouped.text)
          emitted.current = grouped.halalas
          onChange(grouped.halalas)

          // المؤشّر يعود بعدد الأرقام التي كانت قبله، لا بعدد المحارف
          requestAnimationFrame(() => {
            const node = inputRef.current
            if (!node) return
            let position = grouped.text.length
            let seen = 0
            for (let i = 0; i < grouped.text.length; i += 1) {
              const char = grouped.text[i]
              if (char >= '0' && char <= '9') seen += 1
              if (seen === digitsBefore) {
                position = i + 1
                break
              }
            }
            if (digitsBefore === 0) position = 0
            node.setSelectionRange(position, position)
          })
        }}
        className={cn(
          // النائب يُميَّز عن القيمة بخفوته ووزنه، وإلّا قُرئ مبلغًا مكتوبًا
          'w-full rounded-xl border bg-ink-900 ps-3 font-extrabold tabular-nums leading-none outline-none transition-colors placeholder:font-bold placeholder:text-muted/45 focus:border-gold-600 disabled:opacity-60',
          size === 'lg' ? 'h-14 text-center text-2xl sm:text-3xl' : 'h-12 text-start text-xl',
          suffix ? 'pe-12' : 'pe-3',
          invalid ? 'border-danger text-danger' : 'border-ink-600',
        )}
      />
      {suffix && (
        <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-[11px] font-bold text-muted">
          {suffix}
        </span>
      )}
    </div>
  )
}
