'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function AdminLoginForm({
  demo,
}: {
  demo: { email: string; password: string } | null
}) {
  const router = useRouter()
  const [email, setEmail] = useState(demo?.email ?? '')
  const [password, setPassword] = useState(demo?.password ?? '')
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data?.error?.message ?? 'تعذّر تسجيل الدخول')
        return
      }
      toast.success('أهلًا بك في لوحة الإدارة')
      router.replace('/admin')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#0e1420] p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-gold-500 text-ink-950">
            <ShieldCheck className="size-6" />
          </span>
          <h1 className="text-xl font-extrabold text-white">لوحة الإدارة</h1>
          <p className="mt-1 text-sm text-white/60">
            دخول مستقلّ — لن يخرجك من حسابك في السوق.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5"
        >
          <div className="space-y-2">
            <Label htmlFor="admin-email" className="text-white/80">
              البريد الإلكتروني
            </Label>
            <Input
              id="admin-email"
              type="email"
              dir="ltr"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="border-white/15 bg-white/5 text-white placeholder:text-white/30"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-password" className="text-white/80">
              كلمة المرور
            </Label>
            <Input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="border-white/15 bg-white/5 text-white placeholder:text-white/30"
            />
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? 'جارٍ التحقّق…' : 'دخول الإدارة'}
          </Button>

          {demo && (
            <p className="rounded-lg border border-gold-600/30 bg-gold-500/10 px-3 py-2 text-center text-[11px] text-gold-400">
              وضع Demo: الحقول معبّأة بحساب الإدارة التجريبي
            </p>
          )}
        </form>

        <p className="mt-4 text-center text-xs text-white/50">
          <Link href="/market" className="hover:text-white/80 hover:underline">
            العودة إلى السوق
          </Link>
        </p>
      </div>
    </div>
  )
}
