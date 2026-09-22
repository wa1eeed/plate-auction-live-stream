'use client'

import * as React from 'react'
import * as SwitchPrimitives from '@radix-ui/react-switch'
import { cn } from '@/lib/utils'

/**
 * مقاسُ مفتاح النظام — واحدٌ للحقيقيّ وللوجه.
 *
 * ٥١×٣١ وإبهامٌ ٢٧: هي مقاسات مفتاح iOS بعينها، ومن رآها في مئة تطبيقٍ يعرفها
 * قبل أن يقرأ ما بجانبها. وكانت ٤٤×٢٤ — أصغر من أن تُقرأ مفتاحًا وأصغر من أن
 * يُصيبها الإبهام.
 */
const TRACK = 'inline-flex h-[31px] w-[51px] shrink-0 items-center rounded-full transition-colors duration-200'
const THUMB =
  'absolute size-[27px] rounded-full bg-white shadow-[0_2px_5px_rgba(0,0,0,0.28)] transition-[inset-inline-start] duration-200 ease-out'

/**
 * **وجهُ المفتاح — لا مفتاح.**
 *
 * `span` لا `button`: صفوفُ الإعدادات كلُّها أزرار، والزرّ لا يَسَع زرًّا.
 * ووضعُ `SwitchPrimitives.Root` (وهو `button`) داخلها **يُخرجه المحلّل من
 * الصفّ** — فيسقط سطرًا وحده تحت النصّ، ولا يستجيب لأنّه `pointer-events-none`،
 * فيُرى مفتاحًا مكسورًا لا يُضغط. وقد رُئي.
 *
 * والحالُ تُقرأ من الصفّ نفسه (`aria-pressed`)، فهذا الوجه زينةٌ محضة.
 */
export function SwitchFace({ checked, className }: { checked: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      /* مقبضٌ للفحص: يقيس أنّ الوجه **داخل صفّه** لا سطرًا وحده تحته */
      data-switch-face
      data-state={checked ? 'checked' : 'unchecked'}
      className={cn(TRACK, 'relative', checked ? 'bg-gold-500' : 'bg-ink-600', className)}
    >
      {/* `inset-inline-start` لا `translate`: الاتّجاه يُقلب مع الصفحة وحده */}
      <span className={cn(THUMB, checked ? 'start-[22px]' : 'start-[2px]')} />
    </span>
  )
}

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      TRACK,
      'peer relative cursor-pointer focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-gold-500 data-[state=unchecked]:bg-ink-600',
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        // إبهام أبيض ثابت: `bg-paper` ينقلب أسود في السمة الفاتحة فيضيع التباين مع المسار الذهبي
        THUMB,
        'pointer-events-none block data-[state=checked]:start-[22px] data-[state=unchecked]:start-[2px]',
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
