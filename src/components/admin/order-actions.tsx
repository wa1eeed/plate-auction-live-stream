'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { formatAmount } from '@/lib/domain/money'

/**
 * إغلاق صفقة إداريًّا — بقرارٍ يُسأل عنه لا بضغطة.
 *
 * كان الزرّان يُنفَّذان فورًا: «إتمام» يخصم عربون المشتري ويُقيّد إيرادًا،
 * و«إلغاء» يُغلق الصفقة نهائيًّا — كلاهما على مال طرفين، وكلاهما لا رجعة فيه.
 * وكل فعل مدمّر آخر في اللوحة محروس بحوار يذكر أثره، فلا يكون أخطرها أسهلها.
 */
export function OrderActions({
  orderId,
  plateLabel,
  reference,
  amount,
  depositAmount,
}: {
  orderId: string
  plateLabel: string
  reference: string
  amount: number
  /** العربون المحجوز على الصفقة — يتحرّك بالقرار */
  depositAmount: number
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function setStatus(status: 'completed' | 'cancelled') {
    setBusy(true)
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data?.error?.message ?? 'تعذّر تحديث الصفقة')
        return
      }
      toast.success(status === 'completed' ? 'أُتمّت الصفقة' : 'أُلغيت الصفقة')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const subject = `«${plateLabel}» — ${reference} بقيمة ${formatAmount(amount)} ريال`

  return (
    <div className="flex gap-1.5">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="sm" variant="success" disabled={busy}>
            <CheckCircle2 className="size-3.5" />
            إتمام
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>إتمام الصفقة؟</AlertDialogTitle>
          <AlertDialogDescription>
            {subject}.
            {depositAmount > 0
              ? ` يُخصم عربون المشتري (${formatAmount(depositAmount)} ريال) من قيمتها، وتُفكّ عرابين بقيّة المزايدين، وتُقتطع عمولة المنصّة.`
              : ' تُفكّ عرابين بقيّة المزايدين وتُقتطع عمولة المنصّة.'}{' '}
            <b className="text-paper">ولا رجعة في ذلك.</b>
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction onClick={() => setStatus('completed')}>
              نعم، أتمّها
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="sm" variant="ghost" disabled={busy}>
            <XCircle className="size-3.5" />
            إلغاء
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>إلغاء الصفقة؟</AlertDialogTitle>
          <AlertDialogDescription>
            {subject}. تُغلق نهائيًّا وتعود اللوحة إلى بائعها
            {depositAmount > 0 ? ' ويعود عربون المشتري إلى رصيده' : ''}.{' '}
            <b className="text-paper">ولا رجعة في ذلك.</b>
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction onClick={() => setStatus('cancelled')}>
              نعم، ألغِها
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
