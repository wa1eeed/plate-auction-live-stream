'use client'

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

/**
 * التابات عربيّة الاتجاه ما لم يُطلب غيره.
 *
 * جذر Radix يفترض `ltr` حين لا يُقال له شيء، **ويكتبها سِمةً على عنصره** —
 * فينقلب كل ما في اللوح: الجداول تبدأ أعمدتها من اليسار، وشريط التمرير الأفقي
 * يفتح على آخر عمودٍ لا أوّله، وكشف الحساب يُقرأ معكوسًا. والصفحة كلّها `rtl`
 * فوقه، فلا يظهر السبب في تنسيقٍ ولا في قاعدة CSS — يظهر في سِمةٍ يكتبها
 * المكوّن نفسه.
 *
 * والإصلاح هنا لا في كل موضع: التابات في السوق وفي الحساب وفي الإدارة كلّها
 * تمرّ بهذا الجذر، وإصلاحُ موضعٍ يترك البقيّة.
 */
const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>
>(({ dir = 'rtl', ...props }, ref) => <TabsPrimitive.Root ref={ref} dir={dir} {...props} />)
Tabs.displayName = TabsPrimitive.Root.displayName

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      // `flex-wrap`: شريحة لا تفيض على 360px فتُنزلق الصفحة كلّها أفقيًّا
      'flex flex-wrap items-center gap-1 rounded-xl border border-ink-600 bg-ink-900 p-1',
      className,
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-muted transition-colors data-[state=active]:bg-ink-700 data-[state=active]:text-paper',
      className,
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content ref={ref} className={cn('mt-4 focus-visible:outline-none', className)} {...props} />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
