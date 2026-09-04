'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { HandCoins, Loader2, Undo2 } from 'lucide-react'
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
 * قرار الإدارة في مال محجوز: تحويله للبائع أو إعادته للمشتري.
 *
 * يظهر في موضعين: **بعد رفع إثبات النقل** حيث الإفراج قرارها لا تأكيد المشتري،
 * و**عند اعتراض** حيث تفصل بين الطرفين. مخرجان لا ثالث لهما، وكلٌّ يذكر أثره
 * المالي قبل التنفيذ — القرار يحرّك مالًا ولا رجعة فيه بضغطة.
 */
export function DisputeActions({
  orderId,
  buyerName,
  sellerName,
  amount,
  proofNote,
  sellerFee,
}: {
  orderId: string
  buyerName: string
  sellerName: string
  amount: string
  /** بيان النقل الذي رفعه البائع — يُقرأ قبل التحويل لا بعده */
  proofNote?: string | null
  /*
   * هل على البائع عمولة بالقاعدة السارية؟
   *
   * نصُّ التأكيد يصف قيدًا ماليًّا على وشك الوقوع، فلا يذكر خصمًا معطَّلًا:
   * أدمنٌ يقرأ «بعد خصم العمولة» ثمّ يرى العائد كاملًا يظنّ أنّ القيد اختلّ.
   */
  sellerFee: boolean
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Decision
        orderId={orderId}
        decision="release"
        label="حوّل للبائع"
        title={`تحويل المبلغ إلى ${sellerName}؟`}
        body={`${
          proofNote ? `إثبات النقل: «${proofNote}». ` : ''
        }يُقيَّد لـ${sellerName} عائد ${amount} ريال ${
          sellerFee ? 'بعد خصم عمولة المنصّة وضريبتها' : 'كاملًا بلا عمولة'
        }، وتكتمل الصفقة.`}
      />
      <Decision
        orderId={orderId}
        decision="refund"
        label="أعد للمشتري"
        title={`إعادة المبلغ إلى ${buyerName}؟`}
        body={`يعود إلى ${buyerName} ${amount} ريال${
          sellerFee ? ' مع عمولته وضريبتها' : ''
        }، وتُوسَم قيود إيرادها مُبطَلة.`}
      />
    </div>
  )
}

function Decision({
  orderId,
  decision,
  label,
  title,
  body,
}: {
  orderId: string
  decision: 'release' | 'refund'
  label: string
  title: string
  body: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const releasing = decision === 'release'

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/dispute`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision, reason: reason.trim() }),
      })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data?.error?.message ?? 'تعذّر تنفيذ القرار')
        return
      }
      toast.success(releasing ? 'وصل المبلغ إلى البائع' : 'عاد المبلغ إلى المشتري')
      setOpen(false)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={releasing ? 'success' : 'outline'}>
          {releasing ? <HandCoins className="size-3.5" /> : <Undo2 className="size-3.5" />}
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{body}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-4">
            <Label htmlFor={`dispute-reason-${orderId}-${decision}`}>سبب القرار</Label>
            <Input
              id={`dispute-reason-${orderId}-${decision}`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="يظهر للطرفين في إشعارهما وسجلّ التدقيق"
              minLength={3}
              maxLength={300}
              required
            />
          </div>

          <DialogFooter>
            <Button type="submit" variant={releasing ? 'success' : 'danger'} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {releasing ? 'تأكيد التحويل' : 'تأكيد الإعادة'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
