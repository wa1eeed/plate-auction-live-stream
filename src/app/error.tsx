'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, Compass, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageShell } from '@/components/layout/page-shell'

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    // الرسالة وحدها — لا نسجّل أي أثر داخلي أو بيانات حسّاسة
    console.error('[boundary]', error.message)
  }, [error])

  return (
    <PageShell>
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-danger/40 bg-ink-800 p-8 text-center">
          <AlertTriangle className="mx-auto mb-4 size-10 text-danger" />
          <h1 className="mb-2 text-xl font-bold">حدث خطأ غير متوقع</h1>
          <p className="mb-6 text-sm text-muted">
            تعذّر عرض هذه الصفحة. أعد المحاولة — بياناتك ومزايداتك محفوظة على الخادم ولم
            يتأثّر شيء منها.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={reset}>
              <RotateCcw className="size-4" />
              إعادة المحاولة
            </Button>
            <Button asChild variant="secondary">
              <Link href="/market">
                <Compass className="size-4" />
                تصفّح السوق
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </PageShell>
  )
}
