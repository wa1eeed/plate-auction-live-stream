'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { RotateCcw, ShieldX, Undo2 } from 'lucide-react'
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

type Decision = 'forfeit' | 'refund' | 'undo_forfeit'

/**
 * مصادرة عربون أو ردّه.
 *
 * السبب إلزامي في الحالتين: القرار يمسّ مال المستخدم، ويظهر له في كشف حسابه،
 * ويُقيَّد في سجلّ التدقيق باسم من نفّذه.
 */
export function DepositActions({
  depositId,
  userName,
  amount,
  canForfeit,
  canRefund = true,
  canUndo = false,
}: {
  depositId: string
  userName: string
  amount: string
  /** المصادرة لا تُتاح إلا بعد انقضاء مهلة السداد */
  canForfeit: boolean
  /** الردّ لا يُتاح ومزايدة صاحبه قائمة في مزاد جارٍ */
  canRefund?: boolean
  /** التراجع متاح على عربون مُصادَر ما دامت مهلته قائمة */
  canUndo?: boolean
}) {
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {canForfeit && (
        <DecisionDialog
          depositId={depositId}
          decision="forfeit"
          userName={userName}
          amount={amount}
        />
      )}
      {canRefund && (
        <DecisionDialog
          depositId={depositId}
          decision="refund"
          userName={userName}
          amount={amount}
        />
      )}
      {canUndo && (
        <DecisionDialog
          depositId={depositId}
          decision="undo_forfeit"
          userName={userName}
          amount={amount}
        />
      )}
    </div>
  )
}

const COPY: Record<
  Decision,
  { button: string; title: string; confirm: string; success: string; defaultReason: string }
> = {
  forfeit: {
    button: 'مصادرة',
    title: 'مصادرة العربون',
    confirm: 'تأكيد المصادرة',
    success: 'تمّت مصادرة العربون',
    defaultReason: 'تخلّف عن السداد خلال المهلة المحدّدة',
  },
  refund: {
    button: 'ردّ',
    title: 'ردّ العربون',
    confirm: 'تأكيد الردّ',
    success: 'عاد العربون إلى الرصيد المتاح',
    defaultReason: '',
  },
  undo_forfeit: {
    button: 'تراجع',
    title: 'التراجع عن المصادرة',
    confirm: 'تأكيد التراجع',
    success: 'أُلغيت المصادرة وعاد المبلغ',
    defaultReason: '',
  },
}

function DecisionDialog({
  depositId,
  decision,
  userName,
  amount,
}: {
  depositId: string
  decision: Decision
  userName: string
  amount: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const copy = COPY[decision]
  const [reason, setReason] = useState(copy.defaultReason)
  const [busy, setBusy] = useState(false)

  const isForfeit = decision === 'forfeit'

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      const response = await fetch(`/api/admin/deposits/${depositId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision, reason: reason.trim() }),
      })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data?.error?.message ?? 'تعذّر تنفيذ القرار')
        return
      }
      toast.success(copy.success)
      setOpen(false)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant={isForfeit ? 'danger' : 'secondary'}
          className={isForfeit ? undefined : 'text-xs'}
        >
          {decision === 'forfeit' ? (
            <ShieldX className="size-3.5" />
          ) : decision === 'refund' ? (
            <RotateCcw className="size-3.5" />
          ) : (
            <Undo2 className="size-3.5" />
          )}
          {copy.button}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>
              {decision === 'forfeit' ? (
                <>
                  سيُخصم من رصيد {userName} ما تحدّده نسبة المصادرة في قواعد المزاد من{' '}
                  <b>{amount} ريال</b>، ويعود الباقي إلى رصيده المتاح، وتُعلَّم صفقته «متخلّفة عن
                  السداد».
                </>
              ) : decision === 'refund' ? (
                <>
                  سيعود <b>{amount} ريال</b> إلى الرصيد المتاح لـ {userName} دون خصم.
                </>
              ) : (
                <>
                  سيعود المبلغ المُصادَر إلى رصيد {userName}، ويُبطَل قيد الإيراد، وتعود صفقته إلى
                  «بانتظار السداد». القيود لا تُمحى — يُضاف قيد عكسي موثّق.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-4">
            <Label htmlFor={`reason-${depositId}-${decision}`}>السبب</Label>
            <Input
              id={`reason-${depositId}-${decision}`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="سبب موجز يظهر للمستخدم في كشف حسابه"
              minLength={3}
              maxLength={200}
              required
            />
          </div>

          <DialogFooter>
            <Button type="submit" variant={isForfeit ? 'danger' : 'default'} disabled={busy}>
              {busy ? 'جارٍ التنفيذ…' : copy.confirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
