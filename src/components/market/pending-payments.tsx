'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Building2, Check, Copy, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatAmount } from '@/lib/domain/money'
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  type Payment,
  type PublicPaymentOptions,
} from '@/lib/domain/types'
import { formatTimestamp } from '@/lib/utils'

/**
 * عمليات الدفع المعلّقة للمستخدم.
 *
 * الحوالة البنكية تحتاج من المستخدم خطوتين خارج المنصّة: أن **يدوّن** بيانات
 * الحساب والمرجع، ثم أن **يبلّغ** برقم عمليته. لذلك تُعرض البيانات مع زرّ نسخ
 * لكل حقل — نسخ الآيبان يدويًا من الشاشة مصدر أخطاء شائع.
 */
export function PendingPayments({
  payments,
  options,
}: {
  payments: Payment[]
  options: PublicPaymentOptions
}) {
  const open = payments.filter(
    (payment) => payment.status === 'awaiting_transfer' || payment.status === 'under_review',
  )
  if (open.length === 0) return null

  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-bold">عمليات دفع معلّقة</h2>
      <ul className="space-y-3">
        {open.map((payment) => (
          <PendingCard key={payment.id} payment={payment} options={options} />
        ))}
      </ul>
    </section>
  )
}

function PendingCard({
  payment,
  options,
}: {
  payment: Payment
  options: PublicPaymentOptions
}) {
  const router = useRouter()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const awaiting = payment.status === 'awaiting_transfer'

  async function send(url: string, init: RequestInit, success: string) {
    setBusy(true)
    try {
      const response = await fetch(url, init)
      const data = await response.json()
      if (!response.ok) {
        toast.error(data?.error?.message ?? 'تعذّر إتمام العملية')
        return
      }
      toast.success(success)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="rounded-2xl border border-gold-600/40 bg-gold-500/[0.05] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 font-bold">
            <Building2 className="size-4 text-gold-500" />
            {formatAmount(payment.amount)} ريال
            <span className="text-xs font-normal text-muted">
              {PAYMENT_METHOD_LABELS[payment.method]}
            </span>
          </p>
          <p className="mt-0.5 text-[11px] text-muted">
            أُنشئت {formatTimestamp(payment.createdAt)}
          </p>
        </div>
        <Badge variant={awaiting ? 'gold' : 'default'}>
          {PAYMENT_STATUS_LABELS[payment.status]}
        </Badge>
      </div>

      {awaiting && options.bank && (
        <div className="mb-3 space-y-1.5 rounded-xl border border-ink-600 bg-ink-900/60 p-3">
          <p className="mb-2 text-xs font-bold">حوّل المبلغ إلى هذا الحساب</p>
          <CopyRow label="البنك" value={options.bank.name} />
          <CopyRow label="اسم الحساب" value={options.bank.accountName} />
          <CopyRow label="الآيبان" value={options.bank.iban} mono />
          {options.bank.accountNumber && (
            <CopyRow label="رقم الحساب" value={options.bank.accountNumber} mono />
          )}
          <CopyRow label="الرقم المرجعي" value={payment.reference} mono highlight />
          <p className="pt-1 text-[11px] leading-relaxed text-muted">
            اكتب <b className="text-gold-500">{payment.reference}</b> في خانة الملاحظات عند
            التحويل — به تُطابق الإدارة حوالتك.
            {options.bank.instructions && ` ${options.bank.instructions}`}
          </p>
        </div>
      )}

      {awaiting ? (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault()
            void send(
              `/api/payments/${payment.id}`,
              {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ note }),
              },
              'أُرسل إشعار التحويل — بانتظار تحقّق الإدارة',
            )
          }}
        >
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor={`note-${payment.id}`} className="text-xs">
              رقم عملية التحويل
            </Label>
            <Input
              id={`note-${payment.id}`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="رقم العملية من إشعار البنك"
              minLength={3}
              maxLength={200}
              required
            />
          </div>
          <div className="flex gap-2 sm:items-end">
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              حوّلت المبلغ
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() =>
                void send(`/api/payments/${payment.id}`, { method: 'DELETE' }, 'أُلغيت العملية')
              }
            >
              <X className="size-4" />
            </Button>
          </div>
        </form>
      ) : (
        <p className="rounded-xl border border-ink-600 bg-ink-900/60 p-3 text-xs text-muted">
          استلمنا إشعارك{payment.transferNote ? ` برقم ${payment.transferNote}` : ''}. سيُضاف
          الرصيد فور تحقّق الإدارة من الحوالة.
        </p>
      )}
    </li>
  )
}

function CopyRow({
  label,
  value,
  mono,
  highlight,
}: {
  label: string
  value: string
  mono?: boolean
  highlight?: boolean
}) {
  const [copied, setCopied] = useState(false)
  if (!value) return null

  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="flex min-w-0 items-center gap-1.5">
        <span
          dir={mono ? 'ltr' : undefined}
          className={`truncate font-bold ${mono ? 'tabular-nums' : ''} ${highlight ? 'text-gold-500' : ''}`}
        >
          {value}
        </span>
        <button
          type="button"
          data-compact
          aria-label={`نسخ ${label}`}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value)
              setCopied(true)
              setTimeout(() => setCopied(false), 1_500)
            } catch {
              toast.error('تعذّر النسخ — انسخ يدويًا')
            }
          }}
          className="shrink-0 rounded-md p-1 text-muted transition-colors hover:bg-ink-800 hover:text-paper"
        >
          {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
        </button>
      </span>
    </div>
  )
}
