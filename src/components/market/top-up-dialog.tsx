'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Building2, CreditCard, Loader2, Plus, TriangleAlert } from 'lucide-react'
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
import { cn } from '@/lib/utils'
import type { PaymentMethod, PublicPaymentOptions } from '@/lib/domain/types'

const QUICK_AMOUNTS = [500, 1_000, 5_000, 10_000]

/**
 * شحن رصيد المحفظة.
 *
 * لا يُعرض إلا ما هو مفعّل ومهيّأ فعلًا: زرّ دفع يفشل حتمًا أسوأ من غيابه.
 */
export function TopUpDialog({ options }: { options: PublicPaymentOptions }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('1000')
  const [method, setMethod] = useState<PaymentMethod | null>(
    options.tapEnabled ? 'tap' : options.bankTransferEnabled ? 'bank_transfer' : null,
  )
  const [busy, setBusy] = useState(false)

  const noMethods = !options.tapEnabled && !options.bankTransferEnabled

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!method) return
    const value = Number(amount)
    if (!Number.isInteger(value) || value < 50) {
      toast.error('أقل مبلغ شحن 50 ريالًا')
      return
    }

    setBusy(true)
    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ amount: value, method }),
      })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data?.error?.message ?? 'تعذّر بدء عملية الدفع')
        return
      }

      if (data.redirectUrl) {
        // نغادر إلى صفحة Tap المستضافة — لا تمرّ بيانات البطاقة بخوادمنا
        window.location.href = data.redirectUrl
        return
      }
      toast.success('أُنشئت عملية التحويل — حوّل المبلغ ثم أرفق رقم العملية')
      setOpen(false)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={noMethods}>
          <Plus className="size-4" />
          شحن الرصيد
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>شحن رصيد المحفظة</DialogTitle>
            <DialogDescription>
              الرصيد يُستعمل لحجز عرابين المزادات. اختر طريقة الدفع والمبلغ.
            </DialogDescription>
          </DialogHeader>

          {noMethods ? (
            <p className="my-4 flex items-start gap-2 rounded-xl border border-ink-600 bg-ink-900/60 p-3 text-sm text-muted">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-gold-500" />
              لا توجد طريقة دفع مفعّلة حاليًا. تواصل مع الإدارة لشحن رصيدك.
            </p>
          ) : (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="topup-amount">المبلغ بالريال</Label>
                <Input
                  id="topup-amount"
                  inputMode="numeric"
                  dir="ltr"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value.replace(/[^\d]/g, ''))}
                  required
                />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {QUICK_AMOUNTS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      data-compact
                      onClick={() => setAmount(String(value))}
                      className={cn(
                        'rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors',
                        amount === String(value)
                          ? 'border-gold-600 bg-gold-500/12 text-gold-500'
                          : 'border-ink-600 text-muted hover:text-paper',
                      )}
                    >
                      {value.toLocaleString('en-US')}
                    </button>
                  ))}
                </div>
              </div>

              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-semibold">طريقة الدفع</legend>

                {options.tapEnabled && (
                  <MethodOption
                    selected={method === 'tap'}
                    onSelect={() => setMethod('tap')}
                    icon={CreditCard}
                    title="بطاقة مدى أو ائتمانية"
                    hint="دفع فوري عبر بوابة Tap — يُضاف الرصيد مباشرة"
                    badge={options.tapMode === 'test' ? 'وضع تجريبي' : null}
                  />
                )}

                {options.bankTransferEnabled && (
                  <MethodOption
                    selected={method === 'bank_transfer'}
                    onSelect={() => setMethod('bank_transfer')}
                    icon={Building2}
                    title="حوالة بنكية"
                    hint="تظهر لك بيانات الحساب، ويُضاف الرصيد بعد تحقّق الإدارة"
                  />
                )}
              </fieldset>
            </div>
          )}

          {!noMethods && (
            <DialogFooter>
              <Button type="submit" disabled={busy || !method}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                {method === 'tap' ? 'المتابعة إلى الدفع' : 'إنشاء طلب التحويل'}
              </Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}

function MethodOption({
  selected,
  onSelect,
  icon: Icon,
  title,
  hint,
  badge,
}: {
  selected: boolean
  onSelect: () => void
  icon: React.ElementType
  title: string
  hint: string
  badge?: string | null
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex w-full items-start gap-3 rounded-xl border p-3 text-start transition-colors',
        selected ? 'border-gold-600 bg-gold-500/[0.07]' : 'border-ink-600 hover:border-ink-500',
      )}
    >
      <Icon className={cn('mt-0.5 size-5 shrink-0', selected ? 'text-gold-500' : 'text-muted')} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2 font-bold">
          {title}
          {badge && (
            <span className="rounded-full border border-gold-600/50 bg-gold-500/12 px-2 py-0.5 text-[10px] text-gold-500">
              {badge}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-xs text-muted">{hint}</span>
      </span>
    </button>
  )
}
