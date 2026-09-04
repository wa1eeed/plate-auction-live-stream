import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { AdminLoginForm } from '@/components/admin/admin-login-form'
import { getCurrentAdmin } from '@/lib/server/require-admin'
import { config, DEMO_ADMIN } from '@/lib/config'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'دخول الإدارة' }

export default async function AdminLoginPage() {
  if (await getCurrentAdmin()) redirect('/admin')
  return <AdminLoginForm demo={config.demoMode ? DEMO_ADMIN : null} />
}
