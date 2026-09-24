'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

/** يعيد تفعيل حسابٍ عطّله صاحبُه أو الإدارة — والقرارُ للإدارة في الحالين. */
export function ReactivateUser({ userId }: { userId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  return (
    <Button
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        try {
          const response = await fetch(`/api/admin/users/${userId}/reactivate`, { method: 'POST' })
          const data = (await response.json()) as { error?: { message?: string } }
          if (!response.ok) {
            toast.error(data?.error?.message ?? 'تعذّرت إعادة التفعيل')
            return
          }
          toast.success('أُعيد تفعيل الحساب')
          router.refresh()
        } catch {
          toast.error('تعذّر الاتصال — تحقّق من الشبكة وأعد المحاولة')
        } finally {
          setBusy(false)
        }
      }}
    >
      <UserCheck className="size-4" />
      {busy ? 'جارٍ…' : 'إعادة التفعيل'}
    </Button>
  )
}
