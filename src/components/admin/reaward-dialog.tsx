'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { AlertTriangle, Loader2, RefreshCcw, ShieldX } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { formatAmount } from '@/lib/domain/money'

type Candidate = {
  userId: string
  userName: string
  amount: number
  depositHeld: boolean
}

type Context = {
  plateLabel: string
  currentWinnerName: string
  currentDepositAmount: number
  currentDepositHeld: boolean
  overdue: boolean
  candidates: Candidate[]
}

/**
 * إعادة إرساء المزاد على المزايد التالي.
 *
 * إجراء واحد يجمع ما يقع فعلًا عند تخلّف الفائز: إعلان تخلّفه، ومصادرة عربونه،
 * وإرساء اللوحة على من يليه بمهلة سداد جديدة. تفريقها إلى خطوات يترك المزاد
 * في حالة نصفية إن نُسيت خطوة.
 */
export function ReawardDialog({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [context, setContext] = useState<Context | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [forfeit, setForfeit] = useState(true)
  const [reason, setReason] = useState('تخلّف الفائز عن السداد خلال المهلة المحدّدة')
  const [busy, setBusy] = useState(false)

  async function load() {
    setContext(null)
    const response = await fetch(`/api/admin/orders/${orderId}/reaward`)
    const data = await response.json()
    if (!response.ok) {
      toast.error(data?.error?.message ?? 'تعذّر جلب المزايدين')
      return
    }
    setContext(data)
    setSelected(data.candidates[0]?.userId ?? null)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!selected) return
    setBusy(true)
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/reaward`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nextBidderId: selected,
          forfeitCurrentDeposit: forfeit,
          reason: reason.trim(),
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data?.error?.message ?? 'تعذّرت إعادة الإرساء')
        return
      }
      // نقول ما وقع بالمال لا «تمّ» فحسب — المصادرة قرار يجب أن يُؤكَّد أثره
      toast.success(
        data.forfeited
          ? `انتقلت اللوحة للمزايد التالي وصودر عربون ${context?.currentWinnerName ?? 'المتخلّف'}`
          : 'أُعيد الإرساء — بلا مصادرة، وعاد العربون إلى صاحبه',
      )
      setOpen(false)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) void load()
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <RefreshCcw className="size-3.5" />
          إعادة الإرساء
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>إعادة إرساء المزاد</DialogTitle>
            <DialogDescription>
              {context
                ? `تخلّف ${context.currentWinnerName} عن سداد «${context.plateLabel}». اختر المزايد التالي.`
                : 'جارٍ جلب المزايدين…'}
            </DialogDescription>
          </DialogHeader>

          {!context ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-5 animate-spin text-muted" />
            </div>
          ) : context.candidates.length === 0 ? (
            <p className="my-4 flex items-start gap-2 rounded-xl border border-ink-600 bg-ink-900/60 p-3 text-sm text-muted">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-gold-500" />
              لا يوجد مزايد آخر على هذه اللوحة. ألغِ الصفقة وأعد عرض اللوحة من صفحة الإعلانات.
            </p>
          ) : (
            <div className="space-y-4 py-4">
              {!context.overdue && (
                <p className="flex items-start gap-2 rounded-xl border border-gold-600/40 bg-gold-500/[0.07] p-3 text-xs text-gold-600">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  لم تنقضِ مهلة السداد بعد. إعادة الإرساء قبل انقضائها إجراء استثنائي.
                </p>
              )}

              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-semibold">المزايد التالي</legend>
                {context.candidates.map((candidate) => (
                  <button
                    key={candidate.userId}
                    type="button"
                    onClick={() => setSelected(candidate.userId)}
                    aria-pressed={selected === candidate.userId}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-start transition-colors',
                      selected === candidate.userId
                        ? 'border-gold-600 bg-gold-500/[0.07]'
                        : 'border-ink-600 hover:border-ink-500',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block font-bold">{candidate.userName}</span>
                      <span className="mt-0.5 block text-xs text-muted">
                        أعلى مزايدة {formatAmount(candidate.amount)} ريال
                      </span>
                    </span>
                    <Badge variant={candidate.depositHeld ? 'success' : 'danger'}>
                      {candidate.depositHeld ? 'عربونه محجوز' : 'بلا عربون'}
                    </Badge>
                  </button>
                ))}
              </fieldset>

              {context.currentDepositHeld && (
                /*
                 * `div` لا `label`.
                 *
                 * كان المفتاح داخل `label`، فالضغط على النصّ الوصفي يُمرَّر إلى
                 * المفتاح ويقلبه — فيُطفأ قرار مصادرة مالٍ بضغطةٍ على شرحه، بلا
                 * أن يشعر المنفّذ. القرار المالي لا يُقلب إلا بمسّ مفتاحه.
                 */
                <div className="flex items-start justify-between gap-4 rounded-xl border border-danger/40 bg-danger/[0.06] p-3">
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-sm font-bold text-danger">
                      <ShieldX className="size-4" />
                      مصادرة عربون المتخلّف
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {forfeit ? (
                        <>
                          يُخصم {formatAmount(context.currentDepositAmount)} ريال نهائيًا من رصيد{' '}
                          {context.currentWinnerName}.
                        </>
                      ) : (
                        <>
                          <b className="text-paper">لن يُصادَر</b> — يعود عربون{' '}
                          {context.currentWinnerName} ({formatAmount(context.currentDepositAmount)}{' '}
                          ريال) إلى رصيده.
                        </>
                      )}
                    </span>
                  </span>
                  <Switch
                    checked={forfeit}
                    onCheckedChange={setForfeit}
                    aria-label="مصادرة عربون المتخلّف"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor={`reaward-reason-${orderId}`}>السبب</Label>
                <Input
                  id={`reaward-reason-${orderId}`}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  minLength={3}
                  maxLength={200}
                  required
                />
                <p className="text-[11px] text-muted">يظهر للطرفين في إشعاراتهما وكشف الحساب.</p>
              </div>
            </div>
          )}

          {context && context.candidates.length > 0 && (
            <DialogFooter>
              <Button type="submit" disabled={busy || !selected}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                تأكيد إعادة الإرساء
              </Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}
