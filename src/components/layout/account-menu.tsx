'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Gavel,
  HandCoins,
  LayoutList,
  LogOut,
  Settings,
  ShoppingBag,
  Store,
  User as UserIcon,
  Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatAmount } from '@/lib/domain/money'

const LINKS = [
  { href: '/account', label: 'نظرة عامة', icon: UserIcon },
  { href: '/account/listings', label: 'إدارة لوحاتي', icon: LayoutList },
  { href: '/account/wallet', label: 'محفظتي', icon: Wallet },
  { href: '/account/bids', label: 'مزايداتي', icon: Gavel },
  { href: '/account/offers', label: 'العروض', icon: HandCoins },
  { href: '/account/purchases', label: 'مشترياتي', icon: ShoppingBag },
  { href: '/account/sales', label: 'مبيعاتي', icon: Store },
] as const

/**
 * قائمة الحساب في الترويسة.
 *
 * تعرض الرصيد المتاح لأنه أكثر ما يحتاجه المزايد قبل دخول مزاد بعربون —
 * وإخفاؤه خلف صفحتين يعني أن يكتشف نقصه بعد رفض مزايدته.
 */
export function AccountMenu({
  name,
  available,
  held,
}: {
  name: string
  available: number | null
  held: number
}) {
  const router = useRouter()
  const initial = name.trim().charAt(0) || 'م'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2 rounded-xl border border-ink-600 bg-ink-800 py-1.5 pe-2 ps-1.5 text-sm font-semibold transition-colors hover:border-ink-500 focus-visible:outline-none"
        aria-label="قائمة الحساب"
      >
        <span className="flex size-7 items-center justify-center rounded-lg bg-gold-500 text-sm font-extrabold text-ink-950">
          {initial}
        </span>
        <span className="hidden max-w-[7rem] truncate lg:inline">{name}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="pb-1">{name}</DropdownMenuLabel>

        {available !== null && (
          <Link
            href="/account/wallet"
            className="mx-1.5 mb-1.5 block rounded-xl border border-ink-600 bg-ink-900/60 p-3 transition-colors hover:border-gold-600/50"
          >
            <span className="text-[11px] text-muted">الرصيد المتاح</span>
            <span className="block text-lg font-extrabold tabular-nums text-gold-500">
              {formatAmount(available)}
              <span className="ms-1 text-[11px] font-normal text-muted">ريال</span>
            </span>
            {held > 0 && (
              <span className="mt-0.5 block text-[11px] text-muted">
                محجوز كعرابين {formatAmount(held)}
              </span>
            )}
          </Link>
        )}

        <DropdownMenuSeparator />

        {LINKS.map((link) => (
          <DropdownMenuItem key={link.href} asChild>
            <Link href={link.href}>
              <link.icon />
              {link.label}
            </Link>
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/account/settings">
            <Settings />
            الإعدادات
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem
          className="text-danger focus:text-danger data-[highlighted]:text-danger"
          onSelect={async () => {
            await fetch('/api/auth/logout', { method: 'POST' })
            toast.success('تم تسجيل الخروج')
            router.replace('/')
            router.refresh()
          }}
        >
          <LogOut />
          تسجيل الخروج
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
