'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Loader2, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

/** تحصيل عمولة مستحقّة بعد أن صار في محفظة المستخدم ما يكفيها. */
export function SettleEntryButton({ entryId }: { entryId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function settle() {
    setBusy(true)
    try {
      const response = await fetch(`/api/admin/platform-entries/${entryId}`, { method: 'POST' })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data?.error?.message ?? 'تعذّر التحصيل')
        return
      }
      toast.success('حُصّلت العمولة')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button size="sm" variant="secondary" onClick={settle} disabled={busy}>
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Wallet className="size-3.5" />}
      تحصيل
    </Button>
  )
}
