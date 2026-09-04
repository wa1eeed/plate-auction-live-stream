'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Banknote,
  CreditCard,
  FileText,
  HelpCircle,
  Landmark,
  LayoutDashboard,
  LayoutList,
  Receipt,
  PiggyBank,
  ScrollText,
  Settings,
  ShieldAlert,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/** ما يحتاج تصرّفًا الآن — تُحسب في الخادم وتُمرَّر إلى الشارات. */
export type AdminNavBadges = {
  orders?: number
  deposits?: number
  payments?: number
  payouts?: number
}

type NavLink = {
  href: string
  label: string
  icon: React.ElementType
  badge?: keyof AdminNavBadges
}

/**
 * أقسام مجمَّعة لا قائمة مسطّحة.
 *
 * أحد عشر رابطًا في عمود واحد تُقرأ بالبحث لا بالنظر. التجميع يجعل الوصول
 * بالموقع: «شيء ماليّ» تحت المال، و«ضبط» تحت النظام — فتقصر المسافة بين
 * السؤال والرابط.
 */
const GROUPS: { title: string | null; links: NavLink[] }[] = [
  {
    title: null,
    links: [{ href: '/admin', label: 'المؤشرات', icon: LayoutDashboard }],
  },
  {
    title: 'التشغيل',
    links: [
      { href: '/admin/users', label: 'المستخدمون', icon: Users },
      { href: '/admin/listings', label: 'الإعلانات', icon: LayoutList },
      { href: '/admin/orders', label: 'الصفقات', icon: Receipt, badge: 'orders' },
      { href: '/admin/deposits', label: 'العرابين', icon: ShieldAlert, badge: 'deposits' },
    ],
  },
  {
    title: 'المال',
    links: [
      { href: '/admin/payments', label: 'المدفوعات', icon: CreditCard, badge: 'payments' },
      { href: '/admin/transactions', label: 'الحركات المالية', icon: Banknote },
      { href: '/admin/revenue', label: 'إيرادات المنصّة', icon: PiggyBank },
    ],
  },
  {
    // ما يخرج من المنصّة وما تُقرّ به للهيئة — عمل المحاسب لا عمل المشغّل
    title: 'المحاسبة',
    links: [
      { href: '/admin/payouts', label: 'أوامر الصرف', icon: Landmark, badge: 'payouts' },
      { href: '/admin/invoices', label: 'الفواتير الضريبية', icon: FileText },
    ],
  },
  {
    title: 'النظام',
    links: [
      { href: '/admin/faq', label: 'الأسئلة الشائعة', icon: HelpCircle },
      { href: '/admin/audit', label: 'سجلّ التدقيق', icon: ScrollText },
      { href: '/admin/settings', label: 'الإعدادات', icon: Settings },
    ],
  },
]

export function AdminNav({ badges = {} }: { badges?: AdminNavBadges }) {
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)

  // التمرير على `nav` لا على `ul`: عنصر الشبكة عرضه تلقائي فيتمدّد بعرض محتواه
  // ما لم يكن هو نفسه حاوية التمرير — وإلا تجاوزت الصفحة كلّها أفقيًا
  return (
    <nav
      aria-label="أقسام الإدارة"
      className="scrollbar-none edge-fade-start -mx-4 min-w-0 overflow-x-auto px-4 pb-1 lg:sticky lg:top-20 lg:mx-0 lg:overflow-visible lg:mask-none lg:px-0 lg:pb-0"
    >
      {/*
        * بنية واحدة لشاشتين.
        *
        * كان الجوال شريطًا مسطّحًا: أحد عشر رابطًا متتابعًا بلا فاصل تُقرأ
        * بالتمرير والتخمين — أين ينتهي التشغيل ويبدأ المال؟ والعنوان الصغير
        * قبل كل عنقود يعيد التصنيف الذي تراه الشاشة العريضة بكلفة بضعة
        * بكسلات لا صفٍّ كامل.
        *
        * ونصُّ العنوان يُكتب **مرّة واحدة** ينتقل موضعه بالتنسيق: صفًّا على
        * الواسع وسطرًا جانبيًّا على الضيّق. ونسختان منه في الشجرة تعنيان
        * عنوانًا يقرؤه قارئ الشاشة مرّتين.
        */}
      <div className="flex items-center gap-1 lg:block lg:space-y-4">
        {GROUPS.map((group, index) => (
          <div key={group.title ?? index} className="flex shrink-0 items-center gap-1 lg:block">
            {group.title && (
              <p className="flex shrink-0 items-center gap-1.5 ps-1 pe-0.5 text-[10px] font-bold tracking-wide text-muted/70 lg:mb-1.5 lg:block lg:px-3 lg:text-[11px] lg:uppercase">
                {index > 0 && <span aria-hidden className="h-5 w-px bg-ink-600 lg:hidden" />}
                {group.title}
              </p>
            )}
            <ul className="flex gap-1 lg:block lg:space-y-1">
              {group.links.map((link) => (
                <li key={link.href} className="shrink-0">
                  <NavItem
                    link={link}
                    active={isActive(link.href)}
                    count={countOf(link, badges)}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  )
}

const countOf = (link: NavLink, badges: AdminNavBadges) =>
  link.badge ? (badges[link.badge] ?? 0) : 0

function NavItem({
  link,
  active,
  count,
}: {
  link: NavLink
  active: boolean
  count: number
}) {
  return (
    <Link
      href={link.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition-colors lg:w-full',
        active
          ? 'bg-ink-800 text-paper shadow-sm ring-1 ring-ink-600'
          : 'text-muted hover:bg-ink-800/70 hover:text-paper',
      )}
    >
      <link.icon className="size-4 shrink-0" />
      <span className="lg:min-w-0 lg:flex-1">{link.label}</span>
      {count > 0 && (
        /* الشارة تقول «هنا عمل ينتظرك» — وإلا وجب فتح كل قسم للتأكّد */
        <span
          aria-label={`${count} تحتاج تصرّفًا`}
          className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-danger px-1.5 py-0.5 text-[11px] font-extrabold tabular-nums text-white"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}
