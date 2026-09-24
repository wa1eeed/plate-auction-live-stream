'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, Undo2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AmountField } from '@/components/market/amount-field'
import { formatAmount, halalasToRiyals } from '@/lib/domain/money'
import { isOpenOffer, OFFER_STATUS_LABELS, type AccountOffer } from '@/lib/domain/types'
import { cn, formatTimestamp } from '@/lib/utils'

/**
 * **خيطُ السوم — من قال ماذا ومتى.**
 *
 * والعرضُ كان سطرًا برقمٍ وحال، فلا يُعرف منه أسامَ البائعُ أم سكت، ولا بكم.
 * فصار فقاعتين متقابلتين كالمحادثة: عرضُ المشتري في جهة، وسومُ البائع في
 * الأخرى — يُقرأ التفاوض كما جرى لا كرقمٍ استقرّ.
 *
 * **ولا رسائل حرّة**: كلُّ فقاعةٍ عرضٌ مسجَّل مربوطٌ بالإعلان. فما يُقال هنا
 * يُلزم صاحبه، ولا يصير الخيطُ محادثةً تُساق خارج المنصّة.
 */
export function OfferThread({ offer, side }: { offer: AccountOffer; side: 'buyer' | 'seller' }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [countering, setCountering] = useState(false)
  /** بالهللة كبقيّة المبالغ في الواجهة — والتحويل إلى الريال عند الإرسال وحده. */
  const [amount, setAmount] = useState<number | null>(() => offer.listingAsk || offer.amount)

  const gap = offer.listingAsk - offer.amount

  async function send(url: string, method: 'POST' | 'PATCH' | 'DELETE', body: unknown, tag: string) {
    setBusy(tag)
    try {
      const response = await fetch(url, {
        method,
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      const data = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
      if (!response.ok) {
        toast.error(data?.error?.message ?? 'تعذّر تنفيذ الأمر')
        return
      }
      setCountering(false)
      router.refresh()
    } catch {
      toast.error('تعذّر الاتصال — تحقّق من الشبكة وأعد المحاولة')
    } finally {
      setBusy(null)
    }
  }

  const open = isOpenOffer(offer.status)

  return (
    <div className="space-y-2">
      {/* فقاعةُ المشتري */}
      <Bubble
        mine={side === 'buyer'}
        who={side === 'seller' ? offer.counterpartName : 'عرضك'}
        label="عرض المشتري"
        amount={offer.amount}
        at={offer.createdAt}
        note={offer.message}
        badge={
          offer.isHighest && open ? <Badge variant="success">الأعلى</Badge> : null
        }
        foot={
          gap > 0 ? `أقلّ من المطلوب بـ${formatAmount(gap)}` : 'يبلغ المطلوب أو يزيد'
        }
      />

      {/* فقاعةُ سوم البائع */}
      {offer.counterAmount !== null && (
        <Bubble
          mine={side === 'seller'}
          who={side === 'buyer' ? offer.counterpartName : 'سومُك'}
          label="سوم البائع"
          amount={offer.counterAmount}
          at={offer.counterAt}
          note={offer.counterMessage}
          foot={offer.status === 'countered' ? 'بانتظار ردّ المشتري' : null}
        />
      )}

      {/* ما لم يعد مفتوحًا يُقال حالُه ولا تُعرض أفعال */}
      {!open && (
        <p className="text-[11px] text-muted">
          <Badge variant={offer.status === 'accepted' ? 'success' : 'muted'}>
            {OFFER_STATUS_LABELS[offer.status]}
          </Badge>
        </p>
      )}

      {/* أفعالُ البائع على عرضٍ لم يُردّ عليه */}
      {side === 'seller' && offer.status === 'pending' && !countering && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="success"
            disabled={busy !== null}
            onClick={() => send(`/api/offers/${offer.id}`, 'POST', { decision: 'accept' }, 'accept')}
          >
            {busy === 'accept' ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            قبول
          </Button>
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => setCountering(true)}>
            <Undo2 className="size-4" />
            مقابل
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy !== null}
            onClick={() => send(`/api/offers/${offer.id}`, 'POST', { decision: 'decline' }, 'decline')}
          >
            <X className="size-4" />
          </Button>
        </div>
      )}

      {/* صندوقُ السوم */}
      {side === 'seller' && countering && (
        <div className="surface space-y-3 rounded-2xl p-3.5">
          <AmountField
            id={`counter-${offer.id}`}
            label="سومُك"
            size="md"
            value={amount}
            onChange={setAmount}
            invalid={amount !== null && amount <= offer.amount}
            placeholder={formatAmount(offer.listingAsk)}
          />
          <p className="text-[11px] text-muted">
            يجب أن يزيد على عرض المشتري{' '}
            <span dir="ltr" className="font-bold text-paper">
              {formatAmount(offer.amount)}
            </span>{' '}
            ريال
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={busy !== null || amount === null || amount <= offer.amount}
              onClick={() =>
                send(
                  `/api/offers/${offer.id}/counter`,
                  'POST',
                  { amount: halalasToRiyals(amount ?? 0), message: null },
                  'counter',
                )
              }
            >
              {busy === 'counter' ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />}
              أرسل السوم
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCountering(false)}>
              تراجع
            </Button>
          </div>
        </div>
      )}

      {/* أفعالُ المشتري على سومٍ وصله */}
      {side === 'buyer' && offer.status === 'countered' && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="success"
            disabled={busy !== null}
            onClick={() =>
              send(`/api/offers/${offer.id}/counter`, 'PATCH', { decision: 'accept' }, 'accept')
            }
          >
            {busy === 'accept' ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            أقبل {formatAmount(offer.counterAmount ?? 0)}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy !== null}
            onClick={() =>
              send(`/api/offers/${offer.id}/counter`, 'PATCH', { decision: 'decline' }, 'decline')
            }
          >
            <X className="size-4" />
            رفض
          </Button>
        </div>
      )}

      {/* سحبُ عرضٍ لم يُردّ عليه */}
      {side === 'buyer' && offer.status === 'pending' && (
        <Button
          size="sm"
          variant="outline"
          disabled={busy !== null}
          onClick={() => send(`/api/offers/${offer.id}`, 'DELETE', null, 'withdraw')}
        >
          {busy === 'withdraw' ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
          سحب العرض
        </Button>
      )}
    </div>
  )
}

function Bubble({
  mine,
  who,
  label,
  amount,
  at,
  note,
  badge,
  foot,
}: {
  mine: boolean
  who: string
  label: string
  amount: number
  at: string | null
  note?: string | null
  badge?: React.ReactNode
  foot?: string | null
}) {
  return (
    <div className={cn('flex', mine ? 'justify-start' : 'justify-end')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-3.5 py-3',
          /* المِلكُ داكنٌ والوارد فاتح — كما تفرّق المحادثاتُ بين طرفيها */
          mine ? 'bg-ink-950 text-paper' : 'surface',
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold">{who}</span>
          {badge}
          <span className="ms-auto text-[10px] text-muted">{label}</span>
        </div>
        <p className="mt-1 text-xl font-extrabold tabular-nums text-gold-500">
          {formatAmount(amount)}
          <span className="ms-1 text-[11px] font-normal text-muted">ريال</span>
        </p>
        {note && <p className="mt-1 text-[11px] leading-relaxed text-muted">«{note}»</p>}
        {foot && <p className="mt-1 text-[10px] text-muted">{foot}</p>}
        {at && <p className="mt-0.5 text-[10px] text-muted">{formatTimestamp(at)}</p>}
      </div>
    </div>
  )
}
