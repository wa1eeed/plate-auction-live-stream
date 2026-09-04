/**
 * تخطّي التنقّل إلى المحتوى.
 *
 * أوّل ما يلقاه من يتصفّح بلوحة المفاتيح في كل صفحة هو الشعار وروابط التنقّل
 * كلّها، فلا يبلغ المحتوى إلا بعد عشرات الضغطات. هذا الرابط أوّل عنصر قابل
 * للتركيز، ولا يظهر إلا عند التركيز عليه فلا يُثقل التصميم.
 */
export function SkipLink({ href = '#main' }: { href?: string }) {
  return (
    <a
      href={href}
      className="sr-only z-[100] rounded-xl bg-gold-500 px-4 py-2 text-sm font-bold text-ink-950 shadow-lifted focus:not-sr-only focus:absolute focus:start-4 focus:top-4"
    >
      تخطّي إلى المحتوى
    </a>
  )
}
