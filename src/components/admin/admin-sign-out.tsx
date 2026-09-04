'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { toast } from 'sonner'

export function AdminSignOut() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        await fetch('/api/admin/auth/logout', { method: 'POST' })
        // جلسة المستخدم العادي لا تتأثّر — الكوكيان منفصلان
        toast.success('تم الخروج من لوحة الإدارة')
        router.replace('/admin/login')
        router.refresh()
      }}
      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
    >
      <LogOut className="size-3.5" />
      خروج
    </button>
  )
}
