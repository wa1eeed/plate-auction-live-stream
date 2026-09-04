'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * دُرج جانبي مبنيّ على Radix Dialog.
 *
 * نبنيه على Dialog لا على عنصر مخصّص لأن Radix يتكفّل بما يصعب فعله يدويًا:
 * حبس التركيز داخل الدُرج، وإرجاعه إلى الزرّ عند الإغلاق، وإغلاقه بـ Escape،
 * وإخفاء بقية الصفحة عن قارئ الشاشة، ومنع تمرير الخلفية.
 */
const Sheet = DialogPrimitive.Root
const SheetTrigger = DialogPrimitive.Trigger
const SheetClose = DialogPrimitive.Close

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      /*
       * الحجاب داكن في السمة الفاتحة.
       *
       * `ink-950` هو **خلفية الصفحة** لا نقيضها، فحجابٌ منه في السمة الفاتحة
       * وشاحٌ أبيض على أبيض لا يفصل الدُّرج عمّا خلفه. والحجاب يُقاس بالتباين
       * لا بالرمز — فاسودّ ثابتًا كما في الحوارات.
       */
      'layer-overlay fixed inset-0 z-50 bg-black/45 backdrop-blur-sm',
      className,
    )}
    {...props}
  />
))
SheetOverlay.displayName = 'SheetOverlay'

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    side?: 'start' | 'end' | 'bottom'
  }
>(({ className, children, side = 'end', ...props }, ref) => (
  <DialogPrimitive.Portal>
    <SheetOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'surface-overlay fixed z-50 flex flex-col gap-4 overflow-hidden border-ink-600 p-5',
        'transition-transform duration-300 ease-[var(--ease-smooth)]',
        side === 'end' &&
          'inset-y-0 end-0 h-full w-[min(21rem,88vw)] border-s data-[state=closed]:translate-x-full rtl:data-[state=closed]:-translate-x-full',
        side === 'start' &&
          'inset-y-0 start-0 h-full w-[min(21rem,88vw)] border-e data-[state=closed]:-translate-x-full rtl:data-[state=closed]:translate-x-full',
        side === 'bottom' &&
          'inset-x-0 bottom-0 max-h-[86dvh] rounded-t-3xl border-t pb-[max(1.25rem,env(safe-area-inset-bottom))] data-[state=closed]:translate-y-full',
        className,
      )}
      {...props}
    >
      {/*
        * يُمرَّر المحتوى وحده، ويبقى زرّ الإغلاق ثابتًا فوقه.
        *
        * كان الدُرج `h-full` بلا تمرير: فما تجاوز الشاشة يُقصّ ولا يُبلغ إليه
        * بحال — وقع ذلك في أقسام الإدارة، ثلاثة عشر قسمًا آخرها «الإعدادات»
        * خلف الحافّة السفلى. والقصّ صامت: لا شريط ولا ظلّ يدلّ على بقيّة.
        *
        * والتمرير في غلافٍ داخليّ لا في الدُرج نفسه، وإلّا انزلق زرّ الإغلاق
        * مع المحتوى فغاب عمّن بلغ آخر القائمة. و`overscroll-contain` يمنع
        * تمرير الصفحة خلفه عند بلوغ طرفه.
        */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain">
        {children}
      </div>
      <DialogPrimitive.Close
        className="absolute end-4 top-4 rounded-lg p-1.5 text-muted transition-colors hover:bg-ink-700 hover:text-paper focus-visible:outline-none"
        aria-label="إغلاق"
      >
        <X className="size-4" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
SheetContent.displayName = 'SheetContent'

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('text-base font-extrabold', className)} {...props} />
))
SheetTitle.displayName = 'SheetTitle'

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn('text-sm text-muted', className)} {...props} />
))
SheetDescription.displayName = 'SheetDescription'

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetTitle, SheetDescription }
