import Link from 'next/link'
import { Gavel, PlusCircle, ShoppingBag, Wallet } from 'lucide-react'

/**
 * **مداخلُ العمل — لا تعريفٌ بالمنصّة.**
 *
 * من فتح التطبيق يعرف المنصّة وقد ثبّتها، وإنّما جاء ليفعل شيئًا: يتابع
 * مزايدةً، أو يرى ما باع، أو يعرض لوحة. وتقديمُ ذلك على بطلٍ تعريفيّ هو ما
 * يفرّق صفحةَ تطبيقٍ من صفحةِ هبوط.
 *
 * وأربعةٌ لا أكثر: صفٌّ واحد يُمسح بنظرة، وما زاد صار قائمةً تُقرأ.
 */
const ACTIONS = [
  { href: '/account/bids', label: 'مزايداتي', Icon: Gavel },
  { href: '/account/purchases', label: 'مشترياتي', Icon: ShoppingBag },
  { href: '/account/wallet', label: 'المحفظة', Icon: Wallet },
  { href: '/account/listings/new', label: 'أضف لوحة', Icon: PlusCircle },
] as const

export function QuickActions() {
  return (
    <nav aria-label="مداخل سريعة" className="px-4">
      <ul className="grid grid-cols-4 gap-2">
        {ACTIONS.map(({ href, label, Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="surface flex h-full flex-col items-center gap-1.5 rounded-2xl px-1.5 py-3 text-center transition-colors hover:border-gold-600/50 active:bg-ink-700"
            >
              <Icon className="size-5 text-gold-500" />
              {/*
                * النصّ لا يُقصّ ولا يُلفّ: أربعةُ أعمدة على عرض ٣٦٠ تعطي نحو
                * ثمانين بكسلًا، و«مشترياتي» تسعها بهذا المقاس وحده.
                */}
              <span className="text-[11px] font-bold leading-tight text-paper">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/**
 * وللزائر سطرٌ واحد — **لا بطلٌ ولا قسمُ ثقة**.
 *
 * فمن لم يسجّل بعدُ يحتاج أن يعرف ما هذا وأن يجد المدخل، ويكفيه سطرٌ وزرّ.
 * وما دونه يراه في اللوحات نفسها وهي تحته مباشرةً.
 */
export function GuestPrompt({ tagline }: { tagline: string }) {
  return (
    <div className="mx-4 flex items-center justify-between gap-3 rounded-2xl border border-gold-600/30 bg-gold-500/[0.06] px-4 py-3">
      <p className="text-xs leading-relaxed text-muted">{tagline}</p>
      <Link
        href="/login"
        className="shrink-0 rounded-xl bg-gold-500 px-3.5 py-2 text-xs font-bold text-ink-950 transition-colors hover:bg-gold-400"
      >
        دخول
      </Link>
    </div>
  )
}
