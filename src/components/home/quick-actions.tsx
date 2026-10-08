import Link from 'next/link'

/**
 * **نداءُ الزائر — لمن لم يدخل بعد.**
 *
 * وكان معه صفُّ مداخلَ سريعة لمن دخل، فرُفع: أربعةُ روابطَ تكرّر ما في
 * الملاحة السفلية بضغطةٍ واحدة، تأخذ من الشاشة ولا تُعطي، وتُبعد ما تُفتح
 * الصفحةُ لأجله — اللوحات.
 *
 * وهذا يبقى: من لم يدخل لا ملاحةَ له ولا حساب.
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
