'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Pencil, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { User } from '@/lib/domain/types'

/**
 * تصحيح بيانات مستخدم من اللوحة.
 *
 * ما ليس هنا عمدًا: **رقم العضوية** — مكتوبٌ في فواتير وصفقات صدرت فلا يُبدَّل
 * بعدها — و**الرصيد**، له مساره المحاسبيّ بقيدٍ ومرجع لا بتحرير حقل.
 */
export function UserEditDialog({ user }: { user: User }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    displayName: user.displayName,
    email: user.email,
    phone: user.phone ?? '',
    city: user.city ?? '',
    tiktok: user.social.tiktok ?? '',
    snapchat: user.social.snapchat ?? '',
    instagram: user.social.instagram ?? '',
    bankName: user.payout.bankName,
    iban: user.payout.iban,
    accountName: user.payout.accountName,
  })

  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }))

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          displayName: form.displayName,
          email: form.email,
          phone: form.phone,
          city: form.city,
          social: { tiktok: form.tiktok, snapchat: form.snapchat, instagram: form.instagram },
          payout: { bankName: form.bankName, iban: form.iban, accountName: form.accountName },
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data?.error?.message ?? 'تعذّر حفظ البيانات')
        return
      }
      toast.success('حُفظت بيانات المستخدم')
      setOpen(false)
      router.refresh()
    } catch {
      toast.error('تعذّر الاتصال — تحقّق من الشبكة وأعد المحاولة')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Pencil className="size-4" />
          تعديل البيانات
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-xl">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>بيانات {user.displayName}</DialogTitle>
            <DialogDescription>
              رقم العضوية <b className="tabular-nums">{user.reference}</b> لا يُبدَّل — مكتوبٌ في
              فواتير وصفقات صدرت. والرصيد يُعدَّل بقيدٍ من تبويب المحفظة لا من هنا.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60dvh] space-y-4 overflow-y-auto py-4">
            <Group title="الحساب">
              <Two>
                <F label="الاسم" value={form.displayName} onChange={(v) => set('displayName', v)} required />
                <F label="البريد" value={form.email} onChange={(v) => set('email', v)} dir="ltr" required />
              </Two>
              <Two>
                <F label="الجوال" value={form.phone} onChange={(v) => set('phone', v)} dir="ltr" />
                <F label="المدينة" value={form.city} onChange={(v) => set('city', v)} />
              </Two>
            </Group>

            <Group title="حسابات التواصل">
              <Two>
                <F label="تيك توك" value={form.tiktok} onChange={(v) => set('tiktok', v)} dir="ltr" />
                <F label="سناب شات" value={form.snapchat} onChange={(v) => set('snapchat', v)} dir="ltr" />
              </Two>
              <F label="إنستقرام" value={form.instagram} onChange={(v) => set('instagram', v)} dir="ltr" />
            </Group>

            <Group title="حساب الإيداع">
              <Two>
                <F label="البنك" value={form.bankName} onChange={(v) => set('bankName', v)} />
                <F label="اسم صاحب الحساب" value={form.accountName} onChange={(v) => set('accountName', v)} />
              </Two>
              <F
                label="الآيبان"
                value={form.iban}
                onChange={(v) => set('iban', v.toUpperCase())}
                dir="ltr"
                hint="يبدأ بـSA ويليه ٢٢ رقمًا — إليه تُصرف عوائد البيع"
              />
            </Group>
          </div>

          <div className="flex justify-end gap-2 border-t border-ink-600 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              تراجع
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              حفظ
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const Group = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-3 rounded-xl border border-ink-600 bg-ink-900/40 p-4">
    <h3 className="text-xs font-extrabold text-gold-500">{title}</h3>
    {children}
  </section>
)

const Two = ({ children }: { children: React.ReactNode }) => (
  <div className="grid gap-3 sm:grid-cols-2">{children}</div>
)

function F({
  label,
  value,
  onChange,
  dir,
  required,
  hint,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  dir?: 'ltr'
  required?: boolean
  hint?: string
}) {
  const id = `u-${label.replace(/\s/g, '-')}`
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        dir={dir}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint && <p className="text-[11px] text-muted">{hint}</p>}
    </div>
  )
}
