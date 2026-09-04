import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { SiteHeader } from '@/components/layout/site-header'
import { PageShell } from '@/components/layout/page-shell'
import { getCurrentUser } from '@/lib/server/require-user'
import { AuthForm } from '@/components/market/auth-form'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'حساب جديد', robots: { index: false, follow: true } }

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect('/account')

  return (
    <PageShell>
      <SiteHeader />
      <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <div className="mb-7 text-center">
          <h1 className="text-2xl font-extrabold">حساب جديد</h1>
          <p className="mt-2 text-sm text-muted">
            اعرض لوحاتك للبيع وزايد على لوحات الآخرين — بحساب واحد.
          </p>
        </div>

        <AuthForm mode="register" nextUrl="/account" demo={null} />

        <p className="mt-5 text-center text-sm text-muted">
          لديك حساب؟{' '}
          <Link href="/login" className="font-semibold text-gold-500 hover:underline">
            سجّل الدخول
          </Link>
        </p>
      </main>
    </PageShell>
  )
}
