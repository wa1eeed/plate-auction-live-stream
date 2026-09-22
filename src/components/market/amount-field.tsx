'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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
  /** موضع المؤشّر المطلوب بعد التنسيق، مقيسًا بعدد الأرقام قبله */
  const caretDigits = useRef<number | null>(null)

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

  /*
   * المؤشّر يُعاد قبل الرسم لا بعده.
   *
   * كان في `requestAnimationFrame`: إطارٌ كامل بين الكتابة وإعادة المؤشّر،
   * فإن وصل الحرف التالي قبله كُتب في موضع المؤشّر القديم — أوّلِ الحقل —
   * فتتداخل الأرقام. و`useLayoutEffect` يقع في نفس الالتزام قبل أن يرى
   * المتصفّح شيئًا، فلا تبقى نافذةٌ يسبق فيها الحرفُ المؤشّرَ.
   */
  useLayoutEffect(() => {
    const wanted = caretDigits.current
    const node = inputRef.current
    caretDigits.current = null
    if (wanted === null || !node) return

    if (wanted === 0) {
      node.setSelectionRange(0, 0)
      return
    }
    let seen = 0
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i]
      if (char >= '0' && char <= '9') seen += 1
      if (seen === wanted) {
        node.setSelectionRange(i + 1, i + 1)
        return
      }
    }
    node.setSelectionRange(text.length, text.length)
  }, [text])

  return (
    /*
     * الإطارُ حاويةٌ، و«ريال» **داخل الصفّ لا فوقه**.
     *
     * وكان الحقلُ هو الإطار و«ريال» مطليّةً عليه بموضعٍ مطلق. والحقل `dir="ltr"`
     * لأنّ الأرقام تُقرأ يسارًا، والحاوية `rtl` كالصفحة — فـ`pe` في الحقل
     * تحجز يمينه و`end` في اللاحقة تضعها **يساره**. فيبدأ الرقم من اليسار
     * حيث الكلمة، **فيغطّيها**. وقد غطّاها في السعر الافتتاحي وأخويه.
     *
     * والصفُّ لا يُغطّي: ما فيه يقتسم العرض ولا يركب بعضُه بعضًا مهما طال
     * الرقم أو تبدّل الاتّجاه.
     */
    <div
      className={cn(
        'flex min-w-0 items-center gap-2 rounded-xl border bg-ink-900 px-3 transition-colors',
        'focus-within:border-gold-600',
        size === 'lg' ? 'h-14' : 'h-12',
        invalid ? 'border-danger' : 'border-ink-600',
        disabled && 'opacity-60',
        className,
      )}
    >
      {/*
        * فارغٌ بعرض اللاحقة — ليبقى الرقم في وسط الإطار لا في وسط ما بقي منه.
        * وللمقاس الكبير وحده: هو الذي يُوسَّط.
        */}
      {size === 'lg' && suffix && <span aria-hidden className="w-8 shrink-0" />}
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

          // المؤشّر يعود بعدد الأرقام التي كانت قبله، لا بعدد المحارف
          caretDigits.current = digitsBefore
          setText(grouped.text)
          emitted.current = grouped.halalas
          onChange(grouped.halalas)
        }}
        className={cn(
          // النائب يُميَّز عن القيمة بخفوته ووزنه، وإلّا قُرئ مبلغًا مكتوبًا
          'min-w-0 flex-1 border-0 bg-transparent p-0 font-extrabold tabular-nums leading-none outline-none placeholder:font-bold placeholder:text-muted/45 disabled:opacity-100',
          /* اليمين هو مبتدأ القراءة في صفحةٍ عربية، والحقل بذاته يساريّ */
          size === 'lg' ? 'text-center text-2xl sm:text-3xl' : 'text-right text-xl',
          invalid && 'text-danger',
        )}
      />
      {suffix && (
        <span className="w-8 shrink-0 text-[11px] font-bold text-muted">{suffix}</span>
      )}
    </div>
  )
}
