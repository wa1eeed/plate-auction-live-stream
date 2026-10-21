'use client'

import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

/**
 * **شريطُ أقسام الحساب — يُخفى بالمسار لا بعلامةٍ في جسم الصفحة.**
 *
 * وكان الإخفاءُ بـ`body:has([data-settings-page])`: العلامةُ داخل محتوى
 * الصفحة، والتخطيطُ فوقها. فالترتيبُ عند الانتقال:
 *
 *   يُصيَّر التخطيطُ وهيكلُ الانتظار (`loading.tsx`) ← **لا علامةَ بعد،
 *   فالشريطُ ظاهر** ← يصل محتوى الصفحة بعلامته ← يختفي الشريط.
 *
 * فيومض الشريطُ لحظةً في كلّ دخولٍ إلى الإعدادات ونموذج اللوحة — وهو ما
 * شكاه صاحبُ المنصّة: «يظهر لي لوهلة ثمّ تختفي».
 *
 * و`usePathname` تعرف الوجهةَ **لحظةَ بدء الانتقال** لا بعد وصول بياناته،
 * فيُحسم الأمرُ قبل أن يُرسم شيء. ولا `:has()` ولا علاماتٍ تُنثر في
 * الصفحات تُنسى في كلّ صفحةٍ جديدة.
 */

/**
 * صفحاتُ فعلٍ لا تصفّح: من دخلها يريد مفتاحًا أو يملأ نموذجًا، وشريطٌ يعرض
 * «مشترياتي» و«مبيعاتي» فوقه يدعوه إلى الخروج قبل أن يبلغ ما جاء له.
 */
const HIDDEN = [/^\/account\/settings(\/|$)/]

/**
 * ونموذجُ اللوحة يُخفيه **على الضيّق وحده**: الشريطُ على الحاسوب عمودٌ
 * جانبيّ لا يزاحم النموذج، وعلى الجوال كاروسيلٌ يعتلي الشاشة الأولى.
 */
const NARROW_ONLY = [/^\/account\/listings\/(new|[^/]+)$/]

export function SectionRail({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const hidden = HIDDEN.some((pattern) => pattern.test(pathname))
  const narrowOnly = !hidden && NARROW_ONLY.some((pattern) => pattern.test(pathname))

  if (hidden) return null

  return <div className={cn('min-w-0', narrowOnly && 'hidden lg:block')}>{children}</div>
}
