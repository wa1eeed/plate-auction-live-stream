'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { MinusCircle, PlusCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

type Kind = 'topup' | 'withdrawal'

const COPY: Record<Kind, { title: string; verb: string; hint: string }> = {
  topup: {
    title: 'شحن رصيد',
    verb: 'شحن',
    hint: 'وثّق مبلغًا استلمته من المستخدم خارج المنصّة. سيظهر فورًا في كشف حسابه.',
  },
  withdrawal: {
    title: 'خصم رصيد',
    verb: 'خصم',
    hint: 'وثّق مبلغًا صرفته للمستخدم. لا يمكن أن يتجاوز رصيده المتاح.',
  },
}

/** شحن أو خصم رصيد محفظة مستخدم — كل حركة تترك قيدًا في كشف حسابه. */
export function WalletActions({ userId }: { userId: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <WalletDialog userId={userId} kind="topup" />
      <WalletDialog userId={userId} kind="withdrawal" />
    </div>
  )
}

function WalletDialog({ userId, kind }: { userId: string; kind: Kind }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const copy = COPY[kind]

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const value = Number(amount)
    if (!Number.isInteger(value) || value <= 0) {
      toast.error('أدخل مبلغًا صحيحًا بالريال')
      return
    }
    setBusy(true)
    try {
      const response = await fetch(`/api/admin/users/${userId}/wallet`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: kind, amount: value, note: note.trim() || undefined }),
      })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data?.error?.message ?? 'تعذّر تنفيذ الحركة')
        return
      }
      toast.success(`تم ${copy.verb} ${value.toLocaleString('en-US')} ريال`)
      setOpen(false)
      setAmount('')
      setNote('')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={kind === 'topup' ? 'default' : 'secondary'} size="sm">
          {kind === 'topup' ? <PlusCircle className="size-4" /> : <MinusCircle className="size-4" />}
          {copy.title}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.hint}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor={`amount-${kind}`}>المبلغ بالريال</Label>
              <Input
                id={`amount-${kind}`}
                inputMode="numeric"
                dir="ltr"
                placeholder="5000"
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/[^\d]/g, ''))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`note-${kind}`}>ملاحظة (اختيارية)</Label>
              <Input
                id={`note-${kind}`}
                placeholder="مرجع التحويل أو سببه"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={200}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy ? 'جارٍ التنفيذ…' : `تأكيد ${copy.verb}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
