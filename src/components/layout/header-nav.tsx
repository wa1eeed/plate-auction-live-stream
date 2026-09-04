'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export const NAV_LINKS = [
  { href: '/market', label: 'السوق' },
  { href: '/how-it-works', label: 'كيف يعمل' },
  { href: '/faq', label: 'الأسئلة الشائعة' },
] as const

/**
 * روابط الترويسة مع مؤشّر متحرّك.
 *
 * المؤشّر عنصر واحد ينتقل بين الروابط بـ `layoutId` بدل إظهار وإخفاء خلفيات
 * منفصلة — فينزلق بين الأقسام بدل أن يقفز، وهي الحركة التي تميّز الواجهات
 * المتقنة عن غيرها.
 */
export function HeaderNav({ active }: { active?: 'market' | 'account' }) {
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === '/market' ? active === 'market' || pathname.startsWith('/market') : pathname === href

  return (
    <nav className="hidden items-center gap-0.5 md:flex" aria-label="التنقّل الرئيسي">
      {NAV_LINKS.map((link) => {
        const current = isActive(link.href)
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={current ? 'page' : undefined}
            className={cn(
              'relative rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors',
              current ? 'text-paper' : 'text-muted hover:text-paper',
            )}
          >
            {current && (
              <motion.span
                layoutId="nav-indicator"
                className="absolute inset-0 -z-10 rounded-xl bg-ink-800"
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              />
            )}
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
