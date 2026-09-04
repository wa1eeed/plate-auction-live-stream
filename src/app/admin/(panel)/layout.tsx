import { redirect } from 'next/navigation'
import { AdminShell } from '@/components/admin/admin-shell'
import { getCurrentAdmin } from '@/lib/server/require-admin'
import { getNavBadges } from '@/lib/server/admin-service'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'لوحة الإدارة' }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getCurrentAdmin()
  if (!admin) redirect('/admin/login')
  const badges = await getNavBadges()
  return (
    <AdminShell adminName={admin.displayName} badges={badges}>
      {children}
    </AdminShell>
  )
}
