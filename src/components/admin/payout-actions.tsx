'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Landmark, Loader2, X } from 'lucide-react'
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
import { formatIban } from '@/lib/domain/types'

/**
 * قرارا المحاسب في أمر صرف قائم: يُقفله بحوالة، أو يُلغيه.
 *
 * والإقفال لا يقع بلا **مرجع حوالة**: أمرٌ مُعلَّم «صُرف» بلا مرجع لا يُطابَق
 * بكشف البنك، فيبقى مالٌ لا يُعرف أين ذهب.
 */
export function PayoutActions({
  id,
  reference,
  beneficiaryName,
  amount,
  iban,
  payable,
}: {
  id: string
  reference: string
  beneficiaryName: string
  /** منسّقًا للعرض */
  amount: string
  iban: string | null
  /** ناقص البيانات البنكية لا يُصرف — والزرّ يقول ذلك بدل أن يفشل بعد الضغط */
  payable: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <PayDialog
        id={id}
        reference={reference}
        beneficiaryName={beneficiaryName}
        amount={amount}
        iban={iban}
        payable={payable}
      />
      <CancelDialog id={id} reference={reference} beneficiaryName={beneficiaryName} />
    </div>
  )
}

function PayDialog({
  id,
  reference,
  beneficiaryName,
  amount,
  iban,
  payable,
}: {
  id: string
  reference: string
  beneficiaryName: string
  amount: string
  iban: string | null
  payable: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [paymentReference, setPaymentReference] = useState('')
  const [busy, setBusy] = useState(false)

  if (!payable) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-ink-600 bg-ink-900/60 px-2.5 py-1.5 text-xs text-muted">
        موقوف حتى يُدخل المستفيد حسابه
      </span>
    )
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      const response = await fetch(`/api/admin/payouts/${id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'pay', paymentReference: paymentReference.trim() }),
      })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data?.error?.message ?? 'تعذّر إقفال أمر الصرف')
        return
      }
      toast.success('أُقفل أمر الصرف وخُصم من محفظة المستفيد')
      setOpen(false)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="success">
          <Landmark className="size-3.5" />
          سجّل الصرف
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>إقفال أمر الصرف {reference}</DialogTitle>
            <DialogDescription>
              حوّل <b className="text-paper">{amount} ريال</b> إلى {beneficiaryName} على الآيبان{' '}
              <span dir="ltr" className="font-mono">
                {iban ? formatIban(iban) : ''}
              </span>
              ، ثم سجّل مرجع الحوالة هنا. ويُخصم المبلغ من محفظته عند الإقفال — فلا يبقى رصيدٌ صُرف
              نظيره.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-4">
            <Label htmlFor={`payout-ref-${id}`}>مرجع الحوالة البنكية</Label>
            <Input
              id={`payout-ref-${id}`}
              value={paymentReference}
              onChange={(event) => setPaymentReference(event.target.value)}
              placeholder="كما ورد في كشف البنك"
              dir="ltr"
              minLength={3}
              maxLength={80}
              required
            />
          </div>

          <DialogFooter>
            <Button type="submit" variant="success" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              تأكيد الصرف
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CancelDialog({
  id,
  reference,
  beneficiaryName,
}: {
  id: string
  reference: string
  beneficiaryName: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      const response = await fetch(`/api/admin/payouts/${id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', reason: reason.trim() }),
      })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data?.error?.message ?? 'تعذّر إلغاء أمر الصرف')
        return
      }
      toast.success('أُلغي أمر الصرف — ورصيد المستفيد باقٍ في محفظته')
      setOpen(false)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <X className="size-3.5" />
          ألغِ الأمر
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>إلغاء أمر الصرف {reference}؟</DialogTitle>
            <DialogDescription>
              يسقط أمر الحوالة ولا يسقط الاستحقاق: يبقى رصيد {beneficiaryName} في محفظته كما هو —
              مَن آثر ترك ماله في المنصّة لا يُنقص منه شيء.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-4">
            <Label htmlFor={`payout-cancel-${id}`}>سبب الإلغاء</Label>
            <Input
              id={`payout-cancel-${id}`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="يظهر في سجلّ التدقيق"
              minLength={3}
              maxLength={300}
              required
            />
          </div>

          <DialogFooter>
            <Button type="submit" variant="danger" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              تأكيد الإلغاء
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
