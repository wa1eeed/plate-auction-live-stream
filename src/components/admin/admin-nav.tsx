'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
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
  Menu,
  Users,
} from 'lucide-react'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
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

/**
 * أقسام الإدارة — عمودٌ ثابت على الواسع، ودُرجٌ جانبيّ على الجوال.
 *
 * كان شريطًا أفقيًّا يُمرَّر: أربعة عشر رابطًا في شاشة ٣٧٥، أكثرها خلف الحافّة،
 * وعناوين العناقيد تمرّ في الصفّ نفسه فلا تفصل شيئًا. ولوحة الإدارة تُفتح على
 * قسمٍ بعينه لا تُتصفَّح، فالوصول إلى قسمٍ مخبوء كان تمريرًا وتخمينًا.
 *
 * والدُرج يُظهرها كلّها مرّة واحدة بعناوينها، ولا يأخذ من الشاشة شيئًا وهو
 * مغلق — والزرّ يحمل مجموع ما ينتظر تصرّفًا فلا يُفتح ليُسأل عنه.
 */
export function AdminNav({ badges = {} }: { badges?: AdminNavBadges }) {
  return (
    <nav aria-label="أقسام الإدارة" className="hidden lg:sticky lg:top-20 lg:block lg:min-w-0">
      <NavGroups badges={badges} />
    </nav>
  )
}

/** زرّ الدُرج — يسكن ترويسة اللوحة ويختفي فوق `lg`. */
export function AdminNavDrawer({ badges = {} }: { badges?: AdminNavBadges }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // بلا هذا يبقى الدُرج مفتوحًا فوق الصفحة الجديدة بعد الانتقال
  useEffect(() => setOpen(false), [pathname])

  const waiting = Object.values(badges).reduce<number>((sum, n) => sum + (n ?? 0), 0)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="أقسام الإدارة"
        className="relative inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
      >
        <Menu className="size-5" />
        {waiting > 0 && (
          /* نقطةٌ لا رقم: الرقم على زرٍّ بحجم الإبهام يُقرأ لطخة */
          <span
            aria-label={`${waiting} تحتاج تصرّفًا`}
            className="absolute end-1.5 top-1.5 size-2 rounded-full bg-danger ring-2 ring-[#0e1420]"
          />
        )}
      </SheetTrigger>

      <SheetContent side="start" className="w-[17rem]">
        <SheetTitle>أقسام الإدارة</SheetTitle>
        <NavGroups badges={badges} inDrawer />
      </SheetContent>
    </Sheet>
  )
}

/** العناقيد نفسها في الموضعين — نصٌّ واحد لا نسختان يقرؤهما قارئ الشاشة. */
function NavGroups({ badges, inDrawer = false }: { badges: AdminNavBadges; inDrawer?: boolean }) {
  const pathname = usePathname()
  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)

  return (
    <div className="space-y-4">
      {GROUPS.map((group, index) => (
        <div key={group.title ?? index}>
          {group.title && (
            <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-wide text-muted/70">
              {group.title}
            </p>
          )}
          <ul className="space-y-1">
            {group.links.map((link) => {
              const item = (
                <NavItem link={link} active={isActive(link.href)} count={countOf(link, badges)} />
              )
              return (
                <li key={link.href}>
                  {/* داخل الدُرج: النقر يُغلقه ولو كان الرابط لنفس الصفحة */}
                  {inDrawer ? <SheetClose asChild>{item}</SheetClose> : item}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
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
        'group flex w-full items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition-colors',
        active
          ? 'bg-ink-800 text-paper shadow-sm ring-1 ring-ink-600'
          : 'text-muted hover:bg-ink-800/70 hover:text-paper',
      )}
    >
      <link.icon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">{link.label}</span>
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
