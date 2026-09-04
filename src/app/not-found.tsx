import Link from 'next/link'
import { Compass, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageShell } from '@/components/layout/page-shell'
import { SiteHeader } from '@/components/layout/site-header'

export default function NotFound() {
  return (
    <PageShell>
      <SiteHeader />
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-ink-600 bg-ink-800 p-8 text-center">
          <p className="mb-2 text-5xl font-extrabold gold-text">404</p>
          <h1 className="mb-2 text-lg font-bold">الصفحة غير موجودة</h1>
          <p className="mb-6 text-sm text-muted">
            قد يكون الرابط غير صحيح، أو أن اللوحة حُذفت أو لم تعد معروضة في السوق.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild>
              <Link href="/market">
                <Compass className="size-4" />
                تصفّح السوق
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/">
                <Home className="size-4" />
                العودة للرئيسية
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </PageShell>
  )
}
