import { SettingsForm } from './settings-form'
import { LogoutButton } from './logout-button'
import { requireUserId } from '@/lib/server/require-user'
import { getStore } from '@/lib/store'
import { notFound } from 'next/navigation'
import { REFERENCE_LABELS } from '@/lib/domain/reference'
import { ReferenceChip } from '@/components/market/reference-chip'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const userId = await requireUserId()
  const user = await getStore().findUser(userId)
  if (!user) notFound()

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold">الإعدادات</h1>
        <p className="mt-1 text-sm text-muted">بياناتك الظاهرة للبائعين والمشترين.</p>
      </header>

      {/* رقم الحساب في الإعدادات كذلك: هنا يبحث عنه من يريد نسخه للدعم */}
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-600 bg-ink-800 p-5">
        <div>
          <h2 className="font-bold">{REFERENCE_LABELS.user}</h2>
          <p className="mt-1 text-sm text-muted">
            رقمك الثابت في المنصّة — اذكره في أي مراسلة مع الإدارة.
          </p>
        </div>
        <ReferenceChip reference={user.reference} kind="user" />
      </section>

      <SettingsForm user={user} />

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
