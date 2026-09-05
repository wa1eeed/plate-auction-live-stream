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
import { LocalTime } from './local-time'

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
  /*
   * الاعتراض قائمٌ بختمه لا بحالة الصفقة.
   *
   * `openDispute` لا يُجمّد إلّا ما كان ماله محجوزًا؛ وما دونه يُسجَّل ويُرفع
   * ولا تتبدّل حالته. وكان الزرّ يُخفى بـ`status === 'disputed'` وحدها، فمن
   * اعترض على صفقةٍ لم تُسدَّد بعدُ رأى زرّه كما كان — لا أثر لما كتب ولا
   * موضعَ متابعة — فيكتبه ثانيةً فيحلّ محلّ الأوّل بلا خبر.
   */
  const disputed = order.disputedAt !== null

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
          side={side}
          label={transferLate ? 'اطلب الاسترداد' : 'استفسار أو اعتراض'}
        />
      )}

      {disputed && <StandingDispute order={order} side={side} />}
    </>
  )
}

/**
 * الاعتراض المرفوع — نصّه وختمه وأثره.
 *
 * من رفع اعتراضًا لا يجد بعده شيئًا يقرؤه: لا ما كتب ولا متى، فيظنّه ضاع.
 * والسطر هنا يقوم مقام صفحة متابعة: يقول ما قيل، ومن قاله، وما أثره في المال.
 */
function StandingDispute({ order, side }: { order: AccountOrder; side: 'buyer' | 'seller' }) {
  const mine = order.disputedBy
    ? (side === 'buyer' && order.disputedBy === order.buyerId) ||
      (side === 'seller' && order.disputedBy === order.sellerId)
    : false
  const frozen = order.status === 'disputed'

  return (
    <div className="w-full rounded-xl border border-danger/45 bg-danger/[0.07] p-3 text-start">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold text-danger">
        <ShieldAlert className="size-3.5" />
        {mine ? 'اعتراضك مرفوع إلى الإدارة' : 'رُفع اعتراض على هذه الصفقة'}
        {order.disputedAt && (
          <span className="font-semibold text-muted">
            <LocalTime iso={order.disputedAt} mode="datetime" />
          </span>
        )}
      </p>
      {order.disputeReason && (
        <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-paper">
          «{order.disputeReason}»
        </p>
      )}
      <p className="mt-2 text-[11px] leading-relaxed text-muted">
        {frozen
          ? 'لا يخرج المبلغ لأحد حتى تفصل الإدارة، وتصلك النتيجة إشعارًا.'
          : 'رُفع إلى الإدارة والصفقة تمضي في مسارها، وتصلك النتيجة إشعارًا.'}
      </p>
    </div>
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

function DisputeDialog({
  orderId,
  label,
  side,
}: {
  orderId: string
  label: string
  /** المثال يتبع صاحبه: ما يشكو منه المشتري ليس ما يشكو منه البائع */
  side: 'buyer' | 'seller'
}) {
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
              placeholder={
                side === 'buyer'
                  ? 'مثال: لم تُنقل الملكية باسمي حتى الآن'
                  : 'مثال: نقلت الملكية ولم يصلني المبلغ'
              }
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
