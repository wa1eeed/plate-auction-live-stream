'use client'

import Link from 'next/link'
import { ChevronLeft, HelpCircle, Route, Wallet } from 'lucide-react'
import { PushToggle } from './push-toggle'
import { SoundToggle } from './sound-toggle'

/**
 * إعدادات التطبيق وروابطه — **ما كان في الدُرج**.
 *
 * والدُرج يُخفى في الغلاف الأصيل لأنّ الملاحة السفلية تقوم مقامه. وكان يحمل
 * شيئين لا يوجدان في غيره: **مفتاح إشعارات الجهاز** ومفتاح الصوت. فإخفاؤه
 * بلا نقلهما يقطع الطريق إلى الإشعارات بالكلّية — ولا يُدرى أين ذهبت.
 *
 * فنُقلا إلى صفحة الملفّ: هي الموضع الذي يقصده من يبحث عن إعداد.
 */
export function AppSettingsCard() {
  return (
    <section className="surface overflow-hidden rounded-2xl">
      <h2 className="border-b border-ink-600/70 px-4 py-3 text-sm font-bold">الإعدادات</h2>

      <div className="divide-y divide-ink-600/70">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="text-sm font-semibold">أصوات المنصّة</span>
          <SoundToggle />
        </div>

        <div className="px-1 py-1">
          <PushToggle />
        </div>

        <NavRow href="/account/wallet" label="محفظتي" icon={Wallet} />
        <NavRow href="/how-it-works" label="كيف يعمل السوق" icon={Route} />
        <NavRow href="/faq" label="الأسئلة الشائعة" icon={HelpCircle} />
      </div>
    </section>
  )
}

function NavRow({
  href,
  label,
  icon: Icon,
}: {
  href: string
  label: string
  icon: React.ElementType
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-ink-700/40"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-ink-600 bg-ink-900 text-muted">
        <Icon className="size-4" />
      </span>
      <span className="flex-1 text-sm font-semibold">{label}</span>
      <ChevronLeft className="size-4 shrink-0 text-muted" />
    </Link>
  )
}
