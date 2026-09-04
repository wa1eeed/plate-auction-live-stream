import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { SiteHeader } from '@/components/layout/site-header'
import { PageShell } from '@/components/layout/page-shell'
import { config, DEMO_PRIMARY_USER } from '@/lib/config'
import { getCurrentUser } from '@/lib/server/require-user'
import { AuthForm } from '@/components/market/auth-form'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'تسجيل الدخول', robots: { index: false, follow: true } }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  if (await getCurrentUser()) redirect('/account')
  const { next } = await searchParams

  return (
    <PageShell>
      <SiteHeader />
      <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <div className="mb-7 text-center">
          <h1 className="text-2xl font-extrabold">تسجيل الدخول</h1>
          <p className="mt-2 text-sm text-muted">حساب واحد يبيع ويشتري في السوق.</p>
        </div>

        <AuthForm
          mode="login"
          nextUrl={next ?? '/account'}
          demo={config.demoHints ? { email: DEMO_PRIMARY_USER.email, password: DEMO_PRIMARY_USER.password } : null}
        />

        <p className="mt-5 text-center text-sm text-muted">
          ليس لديك حساب؟{' '}
          <Link href="/register" className="font-semibold text-gold-500 hover:underline">
            أنشئ حسابًا
          </Link>
        </p>
      </main>
    </PageShell>
  )
}
