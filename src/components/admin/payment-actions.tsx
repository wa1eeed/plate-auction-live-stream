'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
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

/**
 * تأكيد حوالة بنكية أو رفضها.
 *
 * التأكيد يضيف الرصيد فورًا وينعكس على حالة العملية عند المستخدم — ولذلك
 * يُطلب تأكيد صريح بعد مطابقة الحوالة، لا ضغطة واحدة في الجدول.
 */
export function PaymentActions({
  paymentId,
  amount,
  userName,
  reference,
  forOrder = false,
}: {
  paymentId: string
  amount: string
  userName: string
  reference: string
  /** عملية سداد صفقة لا شحن محفظة — يختلف أثر التأكيد جوهريًا */
  forOrder?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <DecisionDialog
        paymentId={paymentId}
        decision="confirm"
        amount={amount}
        userName={userName}
        reference={reference}
        forOrder={forOrder}
      />
      <DecisionDialog
        paymentId={paymentId}
        decision="reject"
        amount={amount}
        userName={userName}
        reference={reference}
        forOrder={forOrder}
      />
    </div>
  )
}

function DecisionDialog({
  paymentId,
  decision,
  amount,
  userName,
  reference,
  forOrder,
}: {
  paymentId: string
  decision: 'confirm' | 'reject'
  amount: string
  userName: string
  reference: string
  forOrder: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState(decision === 'reject' ? 'لم يُعثر على الحوالة' : '')
  const [busy, setBusy] = useState(false)
  const confirming = decision === 'confirm'

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      const response = await fetch(`/api/admin/payments/${paymentId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision, reason: reason.trim() || undefined }),
      })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data?.error?.message ?? 'تعذّر تنفيذ القرار')
        return
      }
      toast.success(confirming ? 'أُضيف الرصيد للمستخدم' : 'رُفضت العملية')
      setOpen(false)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={confirming ? 'success' : 'ghost'}>
          {confirming ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
          {confirming ? 'تأكيد' : 'رفض'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{confirming ? 'تأكيد استلام الحوالة' : 'رفض العملية'}</DialogTitle>
            <DialogDescription>
              {confirming ? (
                <>
                  تأكّد من وصول <b>{amount} ريال</b> بالمرجع <b>{reference}</b> إلى حساب المنصّة
                  قبل التأكيد.{' '}
                    {forOrder
                      ? 'تكتمل الصفقة: يُخصم العربون، وتُفكّ عرابين بقيّة المزايدين، ويُقيَّد إيراد المنصّة — ولا يُضاف رصيد للمحفظة.'
                      : `سيُضاف المبلغ فورًا إلى رصيد ${userName}.`}
                </>
              ) : (
                <>
                  لن يُضاف أي رصيد إلى {userName}، وسيظهر له سبب الرفض في سجلّ عمليات الدفع.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-4">
            <Label htmlFor={`reason-${paymentId}-${decision}`}>
              {confirming ? 'ملاحظة (اختيارية)' : 'سبب الرفض'}
            </Label>
            <Input
              id={`reason-${paymentId}-${decision}`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={confirming ? 'رقم الحوالة أو تاريخها' : 'يظهر للمستخدم'}
              maxLength={200}
              required={!confirming}
            />
          </div>

          <DialogFooter>
            <Button type="submit" variant={confirming ? 'success' : 'danger'} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {confirming ? (forOrder ? 'تأكيد وإتمام الصفقة' : 'تأكيد وإضافة الرصيد') : 'تأكيد الرفض'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
