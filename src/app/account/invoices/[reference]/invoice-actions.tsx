'use client'

import Link from 'next/link'
import { ArrowRight, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** شريط فوق الورقة — لا يُطبع معها. */
export function InvoiceActions({ reference }: { reference: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
      <div>
        <p className="text-sm font-bold">
          الفاتورة{' '}
          <span dir="ltr" className="font-mono text-gold-500">
            {reference}
          </span>
        </p>
        <p className="text-xs text-muted">احفظها أو اطبعها — نسختك منها لا تتغيّر.</p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" asChild>
          <Link href="/account/purchases">
            <ArrowRight className="size-4" />
            رجوع
          </Link>
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="size-4" />
          طباعة
        </Button>
      </div>
    </div>
  )
}
