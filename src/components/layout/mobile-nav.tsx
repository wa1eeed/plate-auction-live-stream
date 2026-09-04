'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Gavel, HelpCircle, LayoutGrid, Menu, Plus, Route, Wallet } from 'lucide-react'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { SoundToggle } from './sound-toggle'
import { cn } from '@/lib/utils'

const PUBLIC_LINKS = [
  { href: '/market', label: 'السوق', icon: LayoutGrid },
  { href: '/how-it-works', label: 'كيف يعمل', icon: Route },
  { href: '/faq', label: 'الأسئلة الشائعة', icon: HelpCircle },
] as const

const ACCOUNT_LINKS = [
  { href: '/account/listings/new', label: 'أضف لوحة', icon: Plus },
  { href: '/account/listings', label: 'لوحاتي', icon: Gavel },
  { href: '/account/wallet', label: 'محفظتي', icon: Wallet },
] as const

/** دُرج التنقّل على الجوال — يُغلق تلقائيًا عند تغيّر المسار. */
export function MobileNav({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // بلا هذا يبقى الدُرج مفتوحًا فوق الصفحة الجديدة بعد الانتقال
  useEffect(() => setOpen(false), [pathname])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="secondary" size="icon" className="md:hidden" aria-label="القائمة">
          <Menu className="size-4" />
        </Button>
      </SheetTrigger>

      <SheetContent side="end">
        <SheetTitle>التنقّل</SheetTitle>

        <nav className="space-y-1">
          {PUBLIC_LINKS.map((link) => (
            <DrawerLink key={link.href} {...link} active={pathname.startsWith(link.href)} />
          ))}
        </nav>

        {signedIn && (
          <>
            <div className="h-px bg-ink-600" />
            <nav className="space-y-1">
              {ACCOUNT_LINKS.map((link) => (
                <DrawerLink key={link.href} {...link} active={pathname === link.href} />
              ))}
            </nav>
          </>
        )}

        {/* مفتاح الأصوات على الجوال: زرّ الترويسة مخفيّ دون `sm`، والجوال هو
            حيث ينفع التنبيه الصوتي أكثر — شريط مزايدة ثابت وشاشة صغيرة */}
        <div className="h-px bg-ink-600" />
        <div className="flex items-center justify-between gap-3 rounded-xl px-3 py-2">
          <span className="text-sm font-semibold text-muted">أصوات المنصّة</span>
          <SoundToggle />
        </div>

        {!signedIn && (
          <div className="mt-auto grid gap-2">
            <SheetClose asChild>
              <Button asChild size="lg">
                <Link href="/register">أنشئ حسابًا</Link>
              </Button>
            </SheetClose>
            <SheetClose asChild>
              <Button asChild size="lg" variant="secondary">
                <Link href="/login">تسجيل الدخول</Link>
              </Button>
            </SheetClose>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function DrawerLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string
  label: string
  icon: React.ElementType
  active: boolean
}) {
  return (
    <SheetClose asChild>
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors',
          active ? 'bg-ink-700 text-paper' : 'text-muted hover:bg-ink-800 hover:text-paper',
        )}
      >
        <Icon className="size-4 shrink-0" />
        {label}
      </Link>
    </SheetClose>
  )
}
