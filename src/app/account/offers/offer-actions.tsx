'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, Eye, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { OfferStatus } from '@/lib/domain/types'

export function OfferActions({
  offerId,
  status,
  side,
  listingId,
}: {
  offerId: string
  status: OfferStatus
  side: 'buyer' | 'seller'
  listingId: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  const respond = async (decision: 'accept' | 'decline') => {
    setBusy(decision)
    try {
      const response = await fetch(`/api/offers/${offerId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.error?.message ?? 'تعذّر تنفيذ الأمر')
        return
      }
      toast.success(decision === 'accept' ? 'قُبل العرض وسُجّلت الصفقة' : 'رُفض العرض')
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  const withdraw = async () => {
    setBusy('withdraw')
    try {
      const response = await fetch(`/api/offers/${offerId}`, { method: 'DELETE' })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.error?.message ?? 'تعذّر سحب العرض')
        return
      }
      toast.success('تم سحب عرضك')
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-wrap gap-2 pt-1">
      <Button asChild size="sm" variant="secondary">
        <Link href={`/market/${listingId}`}>
          <Eye className="size-4" />
          اللوحة
        </Link>
      </Button>

      {status === 'pending' && side === 'seller' && (
        <>
          <Button size="sm" variant="success" onClick={() => respond('accept')} disabled={busy !== null}>
            {busy === 'accept' ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            قبول
          </Button>
          <Button size="sm" variant="outline" onClick={() => respond('decline')} disabled={busy !== null}>
            <X className="size-4" />
            رفض
          </Button>
        </>
      )}

      {status === 'pending' && side === 'buyer' && (
        <Button size="sm" variant="outline" onClick={withdraw} disabled={busy !== null}>
          {busy === 'withdraw' ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
          سحب العرض
        </Button>
      )}
    </div>
  )
}
