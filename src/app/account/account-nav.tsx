'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef } from 'react'
import {
  FileText,
  Gavel,
  HandCoins,
  Home,
  LayoutList,
  Settings,
  ShoppingBag,
  Store,
  Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/account', label: 'نظرة عامة', icon: Home },
  { href: '/account/listings', label: 'إدارة لوحاتي', icon: LayoutList },
  { href: '/account/wallet', label: 'محفظتي', icon: Wallet },
  { href: '/account/bids', label: 'مزايداتي', icon: Gavel },
  { href: '/account/offers', label: 'العروض', icon: HandCoins },
  { href: '/account/purchases', label: 'مشترياتي', icon: ShoppingBag },
  { href: '/account/sales', label: 'مبيعاتي', icon: Store },
  { href: '/account/invoices', label: 'فواتيري', icon: FileText },
  { href: '/account/settings', label: 'الإعدادات', icon: Settings },
]

const FADE = '2.25rem'

/**
 * تنقّل الحساب: كاروسيل على الجوال، وعمود جانبيّ على الشاشة الكبيرة.
 *
 * الأقسام تسعة وأسماؤها لا تُختصر إلى رسومٍ تُخمَّن، فلا تدخل عرض الجوال في
 * سطر. والحلّ ما تفعله التطبيقات: صفٌّ يُمرَّر، لا شريطٌ يُقصّ. وشرطاه اللذان
 * كانا ناقصين:
 *
 * - **القسم الجاري يُساق إلى العين** عند فتح الصفحة، فلا يفتح «فواتيري» على
 *   شريطٍ يبدأ من «نظرة عامة» ويُخفي موضع صاحبه خلف ٦٠٠ بكسل من التمرير.
 * - **والتلاشي يتبع الموضع**: يتلاشى الطرف الذي وراءه مخبوء وحده، فيُقرأ
 *   التلاشي دعوةً إلى التمرير لا زخرفةً ثابتة تقصّ طرفًا لا شيء بعده.
 */
export function AccountNav() {
  const pathname = usePathname()
  const scrollerRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLAnchorElement>(null)

  /** يفتح التلاشي حيث يوجد مخبوء فقط — والاتجاه يُقرأ من الحساب لا يُفترض. */
  const syncFade = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    /*
     * `Math.abs` لأن `scrollLeft` في RTL يعدّ بالسالب في المتصفّحات المعاصرة.
     * وأخذ القيمة المطلقة يجعل الحساب واحدًا في الاتجاهين.
     */
    const pos = Math.abs(el.scrollLeft)
    const max = el.scrollWidth - el.clientWidth
    const atStart = pos <= 1
    const atEnd = pos >= max - 1
    const rtl = getComputedStyle(el).direction === 'rtl'
    el.style.setProperty('--fade-left', (rtl ? !atEnd : !atStart) ? FADE : '0px')
    el.style.setProperty('--fade-right', (rtl ? !atStart : !atEnd) ? FADE : '0px')
  }, [])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return

    /*
     * الفرق بين مركزَي الشريط والقسم، مضافًا إلى `scrollLeft` مباشرة.
     *
     * و`scrollIntoView` كان يمرّ بلا أثر هنا — يُنادى قبل أن يستقرّ التخطيط
     * فيقيس على عرضٍ لم يصر بعد. والقياس من `getBoundingClientRect` يقع بعد
     * الرسم في `rAF`، وفرقه بالبكسل الفيزيائيّ فيصحّ في الاتجاهين معًا رغم أن
     * `scrollLeft` يعدّ بالسالب في RTL.
     */
    const frame = requestAnimationFrame(() => {
      const active = activeRef.current
      if (active) {
        const box = el.getBoundingClientRect()
        const target = active.getBoundingClientRect()
        el.scrollLeft += target.left + target.width / 2 - (box.left + box.width / 2)
      }
      syncFade()
    })

    // والعرض يتغيّر بالدوران وبفتح لوحة المفاتيح، فيتبدّل ما يُخبأ
    const observer = new ResizeObserver(syncFade)
    observer.observe(el)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [pathname, syncFade])

  return (
    <nav aria-label="أقسام الحساب">
      <div
        ref={scrollerRef}
        onScroll={syncFade}
        className={cn(
          // الجوال: كاروسيل يمتدّ إلى حافّتي الشاشة فيُقرأ صفًّا يُمرَّر
          'scrollbar-none carousel-fade -mx-4 overflow-x-auto overscroll-x-contain px-4',
          // الشاشة الكبيرة: عمود ثابت بلا تمرير ولا تلاشٍ
          'lg:mx-0 lg:overflow-visible lg:mask-none lg:px-0',
        )}
      >
        {/*
          * بلا `w-max`: العرض يبقى عرض الحاوية والعناصر تفيض عنها بـ`shrink-0`.
          *
          * ولو أُعطيت القائمة عرض محتواها لصار عمود الشبكة في التخطيط بمقاسها
          * — العمود يُقاس بأعرض ما فيه — فتُمرَّر الصفحة كلّها يمينًا ويسارًا
          * بدل أن يُمرَّر الشريط وحده.
          */}
        <ul className="flex gap-1.5 py-1 lg:flex-col lg:gap-1.5 lg:py-0">
          {LINKS.map((link) => {
            const active =
              link.href === '/account' ? pathname === '/account' : pathname.startsWith(link.href)
            return (
              <li key={link.href} className="shrink-0">
                <Link
                  ref={active ? activeRef : undefined}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'inline-flex w-full items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-2.5 text-sm font-semibold transition-colors',
                    'lg:rounded-xl lg:px-3',
                    active
                      ? 'bg-gold-500/15 text-gold-400 ring-1 ring-gold-600/40 lg:bg-ink-700 lg:text-paper lg:ring-0'
                      : 'bg-ink-800/60 text-muted hover:bg-ink-800 hover:text-paper lg:bg-transparent',
                  )}
                >
                  <link.icon className="size-4 shrink-0" />
                  {link.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
