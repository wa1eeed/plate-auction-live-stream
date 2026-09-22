import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, IdCard } from 'lucide-react'
import { LogoutButton } from './logout-button'
import { AppSettingsCard } from '@/components/layout/app-settings-card'
import { getCurrentUser } from '@/lib/server/require-user'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'الإعدادات' }

/**
 * الإعدادات — **بابٌ واحد لما لا باب له غيره**.
 *
 * وفي الغلاف الأصيل أُخفي التذييل والدُرج وقائمة العضوية: كلُّها مكرَّرٌ في
 * الملاحة السفلية أو لا موضع له فوق شريط الإيماءات. فما كان فيها من روابط
 * جُمع هنا، ويُقصد إليها بزرٍّ في الهيدر.
 *
 * **وبياناتُ الحساب خلف سطرٍ لا في الصفحة**: حقولٌ مملوءة تدعو إلى التعديل
 * من لا يريده، وتُطيل القائمة على من جاء لمفتاحٍ واحد.
 */
export default async function SettingsPage() {
  const user = await getCurrentUser()
  if (!user) notFound()

  return (
    <div className="space-y-5" data-settings-page>
      <header>
        <h1 className="text-2xl font-extrabold">الإعدادات</h1>
        <p className="mt-1 text-sm text-muted">حسابك وتنبيهاتك وروابط المنصّة.</p>
      </header>

      <section className="surface overflow-hidden rounded-2xl">
        <Link
          href="/account/settings/profile"
          className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-ink-700/40"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-ink-600 bg-ink-900 text-muted">
            <IdCard className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">بيانات حسابي</span>
            <span className="mt-0.5 block truncate text-[12px] text-muted">
              {user.displayName} · {user.reference}
            </span>
          </span>
          <ChevronLeft className="size-4 shrink-0 text-muted" />
        </Link>
      </section>

      <AppSettingsCard />

      <section className="rounded-2xl border border-ink-600 bg-ink-800 p-5">
        <h2 className="font-bold">الجلسة</h2>
        <p className="mt-1 text-sm text-muted">تسجيل الخروج من هذا الجهاز.</p>
        <div className="mt-4">
          <LogoutButton />
        </div>
      </section>
    </div>
  )
}
