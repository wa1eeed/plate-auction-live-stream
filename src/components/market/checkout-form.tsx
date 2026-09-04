'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Banknote, CreditCard, Loader2, Lock, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { formatAmount, type Halalas } from '@/lib/domain/money'
import type { PaymentMethod, PublicPaymentOptions } from '@/lib/domain/types'
import type { CheckoutMethod } from '@/lib/server/checkout-service'
import { cn } from '@/lib/utils'

const ICONS: Record<PaymentMethod, React.ElementType> = {
  wallet: Wallet,
  tap: CreditCard,
  bank_transfer: Banknote,
}

/**
 * اختيار وسيلة السداد.
 *
 * الوسائل المعطّلة تُعرض **ولا تُخفى**، ومعها سبب تعطيلها: من لا يجد وسيلته
 * يظنّها غير مدعومة، ومن يراها معطّلة بسبب مذكور يعرف ما يفعل — يشحن رصيده،
 * أو ينتظر تفعيل البوابة.
 */
export function CheckoutForm({
  orderId,
  methods,
  due,
  bank,
}: {
  orderId: string
  methods: CheckoutMethod[]
  due: Halalas
  bank: PublicPaymentOptions['bank']
}) {
  const router = useRouter()
  const first = methods.find((row) => row.available)?.method ?? null
  const [selected, setSelected] = useState<PaymentMethod | null>(first)
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!selected) return
    setBusy(true)
    try {
      const response = await fetch(`/api/checkout/${orderId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ method: selected }),
      })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data?.error?.message ?? 'تعذّر بدء السداد')
        return
      }
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl as string
        return
      }
      router.push(`/checkout/${orderId}/thanks?ref=${encodeURIComponent(data.paymentReference)}`)
    } catch {
      toast.error('تعذّر الاتصال بالخادم')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-ink-600 bg-ink-800 p-5">
      <div>
        <h2 className="font-bold">وسيلة السداد</h2>
        <p className="mt-1 text-xs text-muted">
          المطلوب <b className="text-gold-500">{formatAmount(due)} ريال</b> شاملًا عمولة المنصّة
          وضريبتها.
        </p>
      </div>

      <ul className="space-y-2">
        {methods.map((row) => {
          const Icon = ICONS[row.method]
          const active = selected === row.method
          return (
            <li key={row.method}>
              <button
                type="button"
                disabled={!row.available}
                aria-pressed={active}
                onClick={() => setSelected(row.method)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-xl border p-3.5 text-start transition-colors',
                  active
                    ? 'border-gold-500 bg-gold-500/10'
                    : 'border-ink-600 bg-ink-900/50 hover:border-ink-500',
                  !row.available && 'cursor-not-allowed opacity-55',
                )}
              >
                <Icon
                  className={cn('mt-0.5 size-5 shrink-0', active ? 'text-gold-500' : 'text-muted')}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-bold">{row.label}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                    {row.hint}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {selected === 'bank_transfer' && bank && (
        <dl className="rounded-xl border border-ink-600 bg-ink-900/60 p-3.5 text-xs">
          <p className="mb-2 font-bold">بيانات الحساب للتحويل</p>
          <Row label="البنك" value={bank.name} />
          <Row label="اسم الحساب" value={bank.accountName} />
          <Row label="الآيبان" value={bank.iban} ltr />
          {bank.accountNumber && <Row label="رقم الحساب" value={bank.accountNumber} ltr />}
          {bank.instructions && (
            <p className="mt-2 leading-relaxed text-muted">{bank.instructions}</p>
          )}
        </dl>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={busy || !selected}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
        {selected === 'wallet' ? 'ادفع من رصيدي' : 'متابعة السداد'}
      </Button>

      <p className="text-[11px] leading-relaxed text-muted">
        لا تُخصم أي مبالغ قبل تأكيدك. والدفع من المحفظة يُتمّ الصفقة فورًا، وغيره يُعتمد بعد
        تحقّق الإدارة أو ردّ البوابة.
      </p>
    </form>
  )
}

function Row({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <dt className="text-muted">{label}</dt>
      <dd className={cn('font-semibold', ltr && 'tabular-nums')} dir={ltr ? 'ltr' : undefined}>
        {value}
      </dd>
    </div>
  )
}
