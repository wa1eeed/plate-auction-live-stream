'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Gavel, Home, LayoutGrid, Plus, User, Wallet } from 'lucide-react'
import { isNativeShell } from '@/lib/device'
import { cn } from '@/lib/utils'

/**
 * ملاحةٌ سفلية — **للغلاف الأصيل وحده**.
 *
 * والدُرج الجانبيّ يقتضي فتحًا ثمّ اختيارًا ثمّ إغلاقًا: ثلاث حركاتٍ لما
 * تفعله التطبيقات بواحدة. وأصابعُ اليد الواحدة تبلغ أسفل الشاشة ولا تبلغ
 * أعلاها — فالتنقّل حيث الإبهام لا حيث العين.
 *
 * **ولا يُعرض في الويب**: المتصفّح له شريط عنوانه وأزرارُه، وشريطٌ ثابتٌ
 * أسفل الصفحة يزاحمها. والدُرج يبقى هناك كما هو.
 */

type TabDef = { href: string; label: string; icon: typeof Home; exact?: boolean }

const TABS: readonly TabDef[] = [
  { href: '/', label: 'الرئيسية', icon: Home, exact: true },
  { href: '/market', label: 'السوق', icon: LayoutGrid },
  /* الزرّ الأوسط يُرسم على حدة */
  { href: '/account/listings', label: 'لوحاتي', icon: Gavel },
  { href: '/account', label: 'ملفّي', icon: User, exact: true },
]

export function BottomNav({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname()
  /*
   * يُرسم بعد الترطيب: المخرَج مشتركٌ بين الويب والتطبيق، فرسمُه على الخادم
   * يُظهره في المتصفّح أو يُسقط الترطيب لاختلاف ما رُسم عمّا رُطِّب.
   */
  const [native, setNative] = useState(false)
  useEffect(() => setNative(isNativeShell()), [])

  if (!native) return null

  /*
   * **لا ملاحةَ في صفحة اللوحة.**
   *
   * فيها شريط مزايدةٍ ثابتٌ أسفل الشاشة — وهو الفعل المقصود في تلك الصفحة.
   * وشريطان أحدهما فوق الآخر يزاحمان الإبهام على المبلغ والزرّ في الثواني
   * الأخيرة من المزاد، وهي أسوأ لحظةٍ لمزاحمة.
   *
   * والخروج من الصفحة له زرُّ رجوعٍ في الهيدر وزرُّ الجهاز في أندرويد.
   */
  if (/^\/market\/[^/]+$/.test(pathname)) return null

  const active = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  /* غير المسجَّل: المحفظة لا معنى لها، فيحلّ محلّها الدخول */
  const tabs: readonly TabDef[] = signedIn
    ? TABS
    : [
        TABS[0],
        TABS[1],
        { href: '/login', label: 'دخول', icon: User, exact: true },
        { href: '/faq', label: 'الأسئلة', icon: Wallet, exact: true },
      ]

  /*
   * ولا فاصلَ هنا: الشريط خارج حاوية التمرير، فلا يُضيف إليها ارتفاعًا.
   * والمساحة تُضاف حشوةً **داخلها** في `globals.css` — وهو الموضع الذي
   * يُبعد آخر سطرٍ عن الشريط فعلًا.
   */
  return (
    <nav
      aria-label="التنقّل"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-600/70 bg-ink-950"
      style={{ paddingBottom: 'var(--safe-bottom)' }}
    >
      <div className="relative mx-auto flex h-16 max-w-lg items-stretch justify-around px-2">
        {tabs.slice(0, 2).map((tab) => (
          <Tab key={tab.href} {...tab} active={active(tab.href, tab.exact)} />
        ))}

        {/*
          * الزرّ الأوسط مرفوعٌ فوق الشريط — وهو فعلُ المنصّة الأوّل.
          *
          * ورفعُه ليس زينة: الإبهام يبلغ وسط الشريط أسهل من طرفيه، والفعل
          * الذي يُقصد إليه يُوضع حيث لا يُخطَأ.
          */}
        <Link
          href={signedIn ? '/account/listings/new' : '/login'}
          aria-label="أضف لوحة"
          className="relative -top-5 mx-1 flex size-14 shrink-0 items-center justify-center self-start rounded-2xl bg-gold-500 text-ink-950 shadow-lg shadow-gold-500/25 transition-transform active:scale-95"
        >
          <Plus className="size-7" strokeWidth={2.5} />
        </Link>

        {tabs.slice(2).map((tab) => (
          <Tab key={tab.href} {...tab} active={active(tab.href, tab.exact)} />
        ))}
      </div>
    </nav>
  )
}

function Tab({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string
  label: string
  icon: typeof Home
  active: boolean
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold transition-colors',
        active ? 'text-gold-400' : 'text-muted',
      )}
    >
      <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
      <span>{label}</span>
    </Link>
  )
}
