import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { SettingsForm } from '../settings-form'
import { ReferenceChip } from '@/components/market/reference-chip'
import { REFERENCE_LABELS } from '@/lib/domain/reference'
import { getCurrentUser } from '@/lib/server/require-user'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'بيانات حسابي' }

/**
 * بيانات الحساب — **صفحةٌ داخلية لا حقولٌ في الإعدادات**.
 *
 * وصفحةُ إعداداتٍ تفتح على حقولٍ مملوءةٍ تدعو إلى التعديل من لا يريده، وتُطيل
 * القائمة على من جاء لمفتاحٍ واحد. والتطبيقات تضع البيانات خلف سطرٍ يُضغط:
 * من أرادها دخل إليها، ومن لم يُردها لم يرها.
 */
export default async function ProfileSettingsPage() {
  const user = await getCurrentUser()
  if (!user) notFound()

  return (
    <div className="space-y-5" data-settings-page>
      <header>
        <Link
          href="/account/settings"
          className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted transition-colors hover:text-paper"
        >
          <ChevronRight className="size-4" />
          الإعدادات
        </Link>
        <h1 className="text-2xl font-extrabold">بيانات حسابي</h1>
        <p className="mt-1 text-sm text-muted">بياناتك الظاهرة للبائعين والمشترين.</p>
      </header>

      {/* رقم الحساب هنا: يبحث عنه من يريد نسخه للدعم */}
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
    </div>
  )
}
