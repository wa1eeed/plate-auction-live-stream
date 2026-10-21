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
  Share2,
  Store,
  Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * **الأقسامُ في عائلاتٍ ذاتِ ألوان — لا صفٌّ رماديٌّ متساوٍ.**
 *
 * وعشرةُ أقسامٍ بلونٍ واحدٍ تُقرأ قائمةً تُمسح حرفًا حرفًا. واللونُ يُقسّمها
 * قبل أن تُقرأ: ما يخصّ لوحاتي ذهبيٌّ، وما يخصّ تداولي سماويّ، وما يخصّ
 * المال والصفقات أخضر. فيُعرف موضعُ «فواتيري» من لونه قبل اسمه.
 *
 * والترتيبُ يتبع العائلات لا الأهواء، فالمتجاورُ في اللون متجاورٌ في الصفّ.
 */
type Family = 'account' | 'plates' | 'trade' | 'money'

const FAMILY_CHIP: Record<Family, string> = {
  account: 'bg-ink-700 text-muted',
  plates: 'bg-gold-500/15 text-gold-400',
  trade: 'bg-sky-500/15 text-sky-500',
  money: 'bg-success/15 text-success',
}

const GROUPS: { key: Family; title: string; links: { href: string; label: string; icon: typeof Home }[] }[] = [
  {
    key: 'account',
    title: 'حسابي',
    links: [{ href: '/account', label: 'نظرة عامة', icon: Home }],
  },
  {
    key: 'plates',
    title: 'لوحاتي',
    links: [
      { href: '/account/listings', label: 'إدارة لوحاتي', icon: LayoutList },
      { href: '/account/showcase', label: 'معرض لوحاتي', icon: Share2 },
    ],
  },
  {
    key: 'trade',
    title: 'تداولي',
    links: [
      { href: '/account/bids', label: 'مزايداتي', icon: Gavel },
      { href: '/account/offers', label: 'العروض والسومات', icon: HandCoins },
    ],
  },
  {
    key: 'money',
    title: 'مالي وصفقاتي',
    links: [
      { href: '/account/wallet', label: 'محفظتي', icon: Wallet },
      { href: '/account/purchases', label: 'مشترياتي', icon: ShoppingBag },
      { href: '/account/sales', label: 'مبيعاتي', icon: Store },
      { href: '/account/invoices', label: 'فواتيري', icon: FileText },
    ],
  },
  {
    key: 'account',
    title: 'الضبط',
    links: [{ href: '/account/settings', label: 'الإعدادات', icon: Settings }],
  },
]

const LINKS = GROUPS.flatMap((group) =>
  group.links.map((link) => ({ ...link, family: group.key })),
)

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
export function AccountNav({ pendingOffers = 0 }: { pendingOffers?: number }) {
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
        {/*
          * **صفٌّ واحدٌ على الجوال، وعائلاتٌ معنونةٌ على الحاسوب.**
          *
          * فالعمودُ الجانبيّ يتّسع لعناوينَ تفصل المجموعات، فيُقرأ تصنيفًا
          * لا قائمةً من عشرة. والصفُّ الأفقيّ لا يتّسع لها، فيحمل اللونَ
          * وحده: كلُّ عائلةٍ بلونِ شارتها.
          */}
        <ul className="flex gap-1.5 py-1 lg:flex-col lg:gap-0 lg:py-0">
          {LINKS.map((link, index) => {
            const active =
              link.href === '/account' ? pathname === '/account' : pathname.startsWith(link.href)
            const group = GROUPS.find((g) => g.links.some((l) => l.href === link.href))!
            const firstOfGroup = group.links[0].href === link.href
            return (
              <li key={link.href} className={cn('shrink-0', index > 0 && 'lg:mt-0.5')}>
                {firstOfGroup && (
                  <p className="hidden px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wide text-muted/70 lg:block">
                    {group.title}
                  </p>
                )}
                <Link
                  ref={active ? activeRef : undefined}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'group/link inline-flex w-full items-center gap-2 whitespace-nowrap rounded-full py-1.5 pe-3.5 ps-1.5 text-sm font-semibold transition-all',
                    'lg:rounded-xl lg:py-1.5 lg:pe-3',
                    active
                      ? /* الحاضرُ لوحٌ ذهبيٌّ مصمَت — يُرى قبل أن يُقرأ */
                        'bg-gold-500 text-ink-950 shadow-sm shadow-gold-600/30 lg:bg-ink-700 lg:text-paper lg:shadow-none'
                      : 'bg-ink-800/60 text-muted hover:bg-ink-800 hover:text-paper lg:bg-transparent',
                  )}
                >
                  {/*
                    * الأيقونةُ في شارةٍ بلون عائلتها — وفي الحاضرِ تُقلب
                    * إلى شفّافيةٍ على الذهب فلا تُزاحم لونَه.
                    */}
                  <span
                    className={cn(
                      'grid size-7 shrink-0 place-items-center rounded-full transition-colors',
                      active ? 'bg-ink-950/15 text-ink-950 lg:bg-ink-900 lg:text-paper' : FAMILY_CHIP[link.family],
                    )}
                  >
                    <link.icon className="size-3.5" />
                  </span>
                  {link.label}
                  {/*
                    * عدّادٌ على «العروض والسومات» وحده.
                    *
                    * السوم الوارد ينتظر ردًّا، ولا شيء في المنصّة يقول إنّه
                    * ينتظر إلّا أن يُفتح القسم. والرقم على الاسم يُقرأ في كل
                    * صفحةٍ من صفحات الحساب — فلا يُنسى عرضٌ لأنّ صاحبه لم
                    * يمرّ على قسمه.
                    */}
                  {link.href === '/account/offers' && pendingOffers > 0 && (
                    <span
                      aria-label={`${pendingOffers} بانتظار ردّك`}
                      className="ms-auto inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums text-white"
                    >
                      {pendingOffers}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
