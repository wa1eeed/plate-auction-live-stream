'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { isNativeShell } from '@/lib/device'

/**
 * زرّ رجوعٍ **في الغلاف وحده**، وفي الصفحات الداخلية وحدها.
 *
 * وiOS بلا زرٍّ عتاديّ: من فتح صفحة مزادٍ من إشعارٍ لا مخرج له إلّا إيماءةُ
 * حافّةٍ لا يعرفها كلّ مستخدم — فيُغلق التطبيق ويعيد فتحه. وأندرويد له زرُّه
 * (مربوطٌ في `native-shell`)، ويزيده هذا وضوحًا.
 *
 * **ولا يُعرض في الويب** — ولا حرفًا منه: المتصفّح له زرُّ رجوعه.
 */

/** جذورٌ لا رجوع منها — فزرٌّ يخرج من التطبيق أسوأ من لا زرّ. */
const ROOTS = ['/', '/market', '/account', '/login', '/register']

export function AppBackButton() {
  const router = useRouter()
  const pathname = usePathname()
  /*
   * يُرسَم بعد الترطيب لا في تصيير الخادم.
   *
   * فالخادم لا يعرف أنّ الصفحة داخل غلافٍ أصيل — والمخرَج مشتركٌ بين الويب
   * والتطبيق (`server.url`). فلو رُسم على الخادم لظهر في المتصفّح أيضًا،
   * أو لاختلف ما رُسم عمّا يُرطَّب فسقط الترطيب.
   */
  const [native, setNative] = useState(false)
  useEffect(() => setNative(isNativeShell()), [])

  if (!native) return null
  if (ROOTS.includes(pathname)) return null

  return (
    <button
      type="button"
      aria-label="رجوع"
      onClick={() => {
        /*
         * التاريخ أوّلًا، وإلّا **مسارٌ منطقيّ** لا خروجٌ من التطبيق.
         *
         * ومن فتح الصفحة من رابطٍ عميق أو إشعارٍ لا تاريخَ له: `router.back()`
         * لا يجد ما يرجع إليه فيبقى واقفًا — أو يُغلق التطبيق على بعض
         * الأجهزة. والسوق هو الأب المنطقيّ لصفحات الإعلانات.
         */
        if (window.history.length > 1) router.back()
        else router.push(pathname.startsWith('/market') ? '/market' : '/')
      }}
      className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-ink-600 bg-ink-900 text-paper transition-colors hover:border-gold-600/50"
    >
      <ChevronRight className="size-5" />
    </button>
  )
}
