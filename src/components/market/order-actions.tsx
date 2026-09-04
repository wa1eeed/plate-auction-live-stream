'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Loader2, ShieldAlert, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
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
import { isFinalOrderStatus, type AccountOrder } from '@/lib/domain/types'

async function post(url: string, body?: Record<string, unknown>) {
  const response = await fetch(url, {
    method: 'POST',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.error?.message ?? 'تعذّر تنفيذ الأمر')
  return data
}

/**
 * أفعال الضمان — فعلُ الدور، وبابٌ للسؤال لا يُغلق.
 *
 * لا نعرض زرًّا يرفضه الخادم: الواجهة تعكس حالة الصفقة لا تسبقها. وما عدا
 * زرّ الدور، يبقى **الاستفسار** متاحًا لكلا الطرفين في كل مرحلة حتى يقع
 * الإفراج — فمن لا يُطالَب بفعل قد يكون لديه ما يقوله.
 */
export function OrderEscrowActions({
  order,
  side,
}: {
  order: AccountOrder
  side: 'buyer' | 'seller'
}) {
  const settled = isFinalOrderStatus(order.status)
  const disputed = order.status === 'disputed'

  // مهلة النقل انقضت ولم يرفع البائع إثباتًا: للمشتري أن يطلب الاسترداد صراحةً
  const transferLate =
    side === 'buyer' &&
    order.status === 'escrow_held' &&
    order.transferDueAt !== null &&
    Date.parse(order.transferDueAt) <= Date.now()

  return (
    <>
      {side === 'seller' && order.status === 'escrow_held' && (
        <TransferProofDialog orderId={order.id} />
      )}

      {!settled && !disputed && (
        <DisputeDialog
          orderId={order.id}
          label={transferLate ? 'اطلب الاسترداد' : 'استفسار أو اعتراض'}
        />
      )}
    </>
  )
}

function TransferProofDialog({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      await post(`/api/orders/${orderId}/transfer`, { note: note.trim() })
      toast.success('وصل إثباتك — بانتظار تحقّق الإدارة')
      setOpen(false)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذّر الرفع')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Truck className="size-4" />
          أكّد نقل الملكية
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>إثبات نقل الملكية</DialogTitle>
            <DialogDescription>
              انقل الملكية عبر أبشر أولًا، ثم اذكر ما يُثبت النقل — رقم العملية أو المرجع.
              تتحقّق الإدارة منه، وعندها يصلك المبلغ في محفظتك.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-4">
            <Label htmlFor={`proof-${orderId}`}>بيان النقل</Label>
            <Textarea
              id={`proof-${orderId}`}
              rows={3}
              value={note}
              onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setNote(event.target.value)}
              placeholder="مثال: نُقلت الملكية في أبشر بتاريخ 04/09/2026، رقم العملية 123456"
              minLength={5}
              maxLength={500}
              required
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Truck className="size-4" />}
              رفع الإثبات
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DisputeDialog({ orderId, label }: { orderId: string; label: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      await post(`/api/orders/${orderId}/dispute`, { reason: reason.trim() })
      toast.success('سُجّل اعتراضك — توقّف تحويل المبلغ حتى تفصل الإدارة')
      setOpen(false)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذّر تسجيل الاعتراض')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <ShieldAlert className="size-4 text-danger" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription>
              {/*
                * النصّ يقول ما يقع بالمال لا ما يقع بالنموذج.
                *
                * والأثر يختلف بموضع المال: قبل السداد يُرفع السؤال إلى الإدارة
                * والصفقة تمضي، وبعده يُجمَّد الإفراج حتى تفصل — ومن يسأل قبل
                * أن يدفع لا يُعاقَب بتجميد يمنعه من الدفع.
                */}
              يصل استفسارك إلى الإدارة. وإن كان مبلغك محجوزًا فلن يخرج لأحد حتى تفصل
              فيه. اذكر ما حدث بدقّة — عليه يُبنى القرار.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-4">
            <Label htmlFor={`dispute-${orderId}`}>ما الذي تريد قوله؟</Label>
            <Input
              id={`dispute-${orderId}`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="مثال: لم تُنقل الملكية باسمي حتى الآن"
              minLength={5}
              maxLength={500}
              required
            />
          </div>

          <DialogFooter>
            <Button type="submit" variant="danger" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldAlert className="size-4" />}
              تسجيل الاعتراض
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
