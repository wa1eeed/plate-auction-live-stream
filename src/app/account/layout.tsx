import { redirect } from 'next/navigation'
import { SiteHeader } from '@/components/layout/site-header'
import { PageShell } from '@/components/layout/page-shell'
import { getCurrentUser } from '@/lib/server/require-user'
import { AccountNav } from './account-nav'

export const dynamic = 'force-dynamic'

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  // نتحقّق من وجود المستخدم لا من صحّة توقيع الجلسة وحدها: الكوكي قد يبقى
  // صالح التوقيع بعد حذف الحساب، فتظهر صفحة حساب فارغة بلا اسم ولا بيانات.
  if (!(await getCurrentUser())) redirect('/login?next=/account')

  return (
    <PageShell>
      <SiteHeader active="account" />
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {/* `min-w-0` على العمود: بدونه يُقاس بمحتواه فيفيض شريط الأقسام بالصفحة */}
        <div className="grid min-w-0 gap-6 lg:grid-cols-[220px_1fr] lg:items-start">
          <div className="min-w-0">
            <AccountNav />
          </div>
          <main id="main" className="min-w-0">
            {children}
          </main>
        </div>
      </div>
    </PageShell>
  )
}
