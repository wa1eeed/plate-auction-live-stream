'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Banknote, CreditCard, Loader2, Lock, ShieldCheck, Wallet } from 'lucide-react'
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
      toast.error('تعذّر الاتصال — تحقّق من الشبكة وأعد المحاولة')
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

      {/*
        * **طمأنةُ الضمان قبل الزرّ لا بعده.**
        *
        * ومن يدفع عشرات الآلاف لمن لم يلقَه يسأل: «إلى أين يذهب مالي الآن؟».
        * فيُجاب قبل أن يضغط — وجوابٌ بعد الضغط طمأنةٌ فات أوانُها.
        */}
      <p className="flex items-start gap-2 rounded-xl border border-success/40 bg-success-soft p-3.5 text-[11px] leading-relaxed">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
        <span>
          يبقى المبلغ <b className="text-success">محجوزًا لدى المنصّة</b> حتى تنقل الملكية
          وتتحقّق الإدارة منها، ثمّ يُحوَّل إلى البائع. ولا تُخصم أي مبالغ قبل تأكيدك.
        </span>
      </p>

      {/*
        * الفعلُ لاصقٌ أسفل الشاشة على الجوّال — ومعه المستحقّ.
        *
        * فصفحةُ السداد تُمرَّر: طريقةُ الدفع وبياناتُ الحساب وعاقبةُ التأخير.
        * وزرُّ الدفع في قاعها يعني تمريرًا في كلّ مرّة يُراجع فيها شيئًا.
        * والمبلغُ معه لأنّه ما يُقرّ عليه، فلا يُضغط الزرُّ على رقمٍ غاب.
        */}
      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-40 border-t border-ink-600 bg-ink-800/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md',
          'lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none',
        )}
      >
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <span className="shrink-0 lg:hidden">
            <span className="block text-[10px] text-muted">المستحقّ</span>
            <b className="block text-lg font-extrabold tabular-nums text-gold-500">
              {formatAmount(due)}
            </b>
          </span>
          <Button type="submit" size="lg" className="flex-1" disabled={busy || !selected}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
            {selected === 'wallet' ? 'ادفع من رصيدي' : 'ادفع عبر الضمان'}
          </Button>
        </div>
      </div>

      <p className="hidden text-[11px] leading-relaxed text-muted lg:block">
        والدفع من المحفظة يُتمّ الصفقة فورًا، وغيره يُعتمد بعد تحقّق الإدارة أو ردّ البوابة.
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
