import Link from 'next/link'
import { Gavel, Gem, HandCoins, ShieldCheck, Tag } from 'lucide-react'
import { SaudiLicensePlate } from '@/components/plate/SaudiLicensePlate'

const COLUMNS = [
  {
    title: 'السوق',
    links: [
      { href: '/market', label: 'كل اللوحات' },
      { href: '/market?sale=auction', label: 'المزادات', icon: Gavel },
      { href: '/market?sale=fixed', label: 'بيع مباشر', icon: Tag },
      { href: '/market?sale=offers', label: 'استقبال عروض', icon: HandCoins },
    ],
  },
  {
    title: 'حسابي',
    links: [
      { href: '/account/listings', label: 'لوحاتي' },
      { href: '/account/wallet', label: 'محفظتي' },
      { href: '/account/bids', label: 'مزايداتي' },
      { href: '/account/purchases', label: 'مشترياتي' },
    ],
  },
  {
    title: 'المنصّة',
    links: [
      { href: '/how-it-works', label: 'كيف يعمل' },
      { href: '/faq', label: 'الأسئلة الشائعة' },
      { href: '/register', label: 'أنشئ حسابًا' },
      { href: '/login', label: 'تسجيل الدخول' },
    ],
  },
] as const

/**
 * تذييل المنصّة.
 *
 * فقرتا التنويه القانوني حُذفتا: كانتا تُكرّران على كل صفحة ما تشرحه
 * «كيف يعمل» و«الأسئلة الشائعة» بتفصيل أوفى، وتُثقلان آخر ما يقرؤه الزائر.
 * مكانهما ضمانات المنصّة الثلاث — وهي ما يهمّ من وصل إلى هنا.
 */
export function SiteFooter() {
  return (
    <footer className="relative mt-auto overflow-hidden border-t border-ink-600/70 bg-ink-900/40">
      <div
        aria-hidden
        className="dot-grid pointer-events-none absolute inset-0 opacity-25 [mask-image:radial-gradient(80%_60%_at_50%_0%,black,transparent)]"
      />
      <div className="relative mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Link href="/" className="flex items-center gap-2.5 font-extrabold">
              <span className="flex size-9 items-center justify-center rounded-xl bg-gold-500 text-ink-950">
                <Gavel className="size-4.5" />
              </span>
              سوق اللوحات
            </Link>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
              سوق ويب لتداول لوحات المركبات السعودية — بيع مباشر أو مزاد أو استقبال عروض،
              بحساب واحد يبيع ويشتري.
            </p>

            <div className="mt-5 w-[220px] opacity-80">
              <SaudiLicensePlate
                plateType="private"
                arabicLetters="سوق"
                latinLetters="SUG"
                plateNumbers="1"
                emblem="palm-swords-black"
                size="thumbnail"
                className="w-full"
              />
            </div>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="mb-3 text-sm font-bold">{column.title}</h2>
              <ul className="space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted transition-colors hover:text-paper"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 grid gap-3 border-t border-ink-600/70 pt-6 sm:grid-cols-3">
          <Assurance icon={ShieldCheck} title="سعر احتياطي محمي">
            لا يغادر خوادمنا — يراه البائع وحده
          </Assurance>
          <Assurance icon={Gem} title="عربون يضمن الجدّية">
            لا يزايد إلا من يملك المبلغ فعلًا
          </Assurance>
          <Assurance icon={Gavel} title="كشف مزايدات شفّاف">
            كل مزايدة بوقتها، والملغاة موسومة لا محذوفة
          </Assurance>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-ink-600/70 pt-6 text-xs text-muted">
          <p>© {new Date().getFullYear()} سوق تداول لوحات المركبات</p>
          <nav aria-label="روابط عامة" className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link href="/faq" className="transition-colors hover:text-paper">
              الأسئلة الشائعة
            </Link>
            <Link href="/how-it-works" className="transition-colors hover:text-paper">
              كيف يعمل
            </Link>
            <Link href="/market" className="transition-colors hover:text-paper">
              السوق
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}

function Assurance({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-gold-600/40 bg-gold-500/10 text-gold-500">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold">{title}</span>
        <span className="block text-xs text-muted">{children}</span>
      </span>
    </div>
  )
}
