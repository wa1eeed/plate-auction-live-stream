'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, ShieldCheck, TriangleAlert, Undo2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AmountField } from '@/components/market/amount-field'
import { formatAmount, halalasToRiyals } from '@/lib/domain/money'
import { isOpenOffer, OFFER_STATUS_LABELS, type AccountOffer } from '@/lib/domain/types'
import { arabicCount, cn, formatRelative } from '@/lib/utils'

/**
 * **خيطُ السوم — من قال ماذا ومتى.**
 *
 * والعرضُ كان سطرًا برقمٍ وحال، فلا يُعرف منه أسامَ البائعُ أم سكت، ولا بكم.
 * فصار فقاعتين متقابلتين كالمحادثة: عرضُ المشتري في جهة، وسومُ البائع في
 * الأخرى — يُقرأ التفاوض كما جرى لا كرقمٍ استقرّ.
 *
 * **ولا رسائل حرّة**: كلُّ فقاعةٍ عرضٌ مسجَّل مربوطٌ بالإعلان — وهو مكتوبٌ
 * في أسفل الخيط لا في تعليقٍ هنا: مَن لا يقرأ الكود يحتاج أن يعرف أنّ ما
 * يكتبه محفوظٌ وملزِم، وأنّ المساومة لا تُساق خارج المنصّة.
 */
export function OfferThread({ offer, side }: { offer: AccountOffer; side: 'buyer' | 'seller' }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [countering, setCountering] = useState(false)
  /** بالهللة كبقيّة المبالغ في الواجهة — والتحويل إلى الريال عند الإرسال وحده. */
  const [amount, setAmount] = useState<number | null>(() => offer.listingAsk || offer.amount)

  const open = isOpenOffer(offer.status)
  const standing = offer.counterAmount ?? offer.amount
  const gap = offer.listingAsk - standing

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

  const threaded = offer.counterAmount !== null

  return (
    <div
      className={cn(
        'space-y-2',
        !open && 'opacity-60',
        /* جولةٌ من ردّين تُقرأ واحدةً — وبغير السكّة تبدو عرضين لا جولة */
        threaded && 'rounded-2xl border-s-2 border-gold-600/40 ps-2.5',
      )}
    >
      {/* فقاعةُ المشتري */}
      <Bubble
        mine={side === 'buyer'}
        who={side === 'seller' ? offer.counterpartName : 'أنت'}
        label={side === 'buyer' ? 'عرضك' : 'عرض المشتري'}
        amount={offer.amount}
        at={offer.createdAt}
        note={offer.message}
        record={side === 'seller' ? offer.counterpartRecord : null}
        badge={offer.isHighest && open ? <Badge variant="gold">الأعلى</Badge> : null}
        /* الفرقُ مقروءًا بلا حساب — وهو ما يُقرّر به البائع */
        gap={offer.counterAmount === null ? gap : null}
        gapKind={offer.listingAskKind}
      />

      {/* فقاعةُ سوم البائع */}
      {offer.counterAmount !== null && (
        <Bubble
          mine={side === 'seller'}
          who={side === 'buyer' ? offer.counterpartName : 'أنت'}
          label={side === 'seller' ? 'سومُك' : 'سوم البائع'}
          amount={offer.counterAmount}
          at={offer.counterAt}
          note={offer.counterMessage}
          gap={gap}
          gapKind={offer.listingAskKind}
          foot={offer.status === 'countered' ? 'بانتظار ردّ المشتري' : null}
        />
      )}

      {/* ما لم يعد مفتوحًا يُقال حالُه ولا تُعرض أفعال */}
      {!open && (
        <p>
          <Badge variant={offer.status === 'accepted' ? 'success' : 'muted'}>
            {OFFER_STATUS_LABELS[offer.status]}
          </Badge>
        </p>
      )}

      {/* أفعالُ البائع على عرضٍ لم يُردّ عليه */}
      {side === 'seller' && offer.status === 'pending' && !countering && (
        <div className="flex items-center gap-2">
          <Button
            variant="success"
            className="flex-1"
            disabled={busy !== null}
            onClick={() => send(`/api/offers/${offer.id}`, 'POST', { decision: 'accept' }, 'accept')}
          >
            {busy === 'accept' ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            قبول
          </Button>
          <Button variant="outline" disabled={busy !== null} onClick={() => setCountering(true)}>
            <Undo2 className="size-4" />
            مقابل
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="رفض العرض"
            disabled={busy !== null}
            onClick={() => send(`/api/offers/${offer.id}`, 'POST', { decision: 'decline' }, 'decline')}
          >
            <X className="size-4" />
          </Button>
        </div>
      )}

      {/* صندوقُ السوم */}
      {side === 'seller' && countering && (
        <div className="space-y-3 rounded-2xl border border-gold-600/40 bg-ink-900 p-3.5">
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
            ر.س
          </p>
          <div className="flex gap-2">
            <Button
              className="flex-1"
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
            <Button variant="ghost" onClick={() => setCountering(false)}>
              تراجع
            </Button>
          </div>
        </div>
      )}

      {/* أفعالُ المشتري على سومٍ وصله */}
      {side === 'buyer' && offer.status === 'countered' && (
        <div className="flex items-center gap-2">
          <Button
            variant="success"
            className="flex-1"
            disabled={busy !== null}
            onClick={() =>
              send(`/api/offers/${offer.id}/counter`, 'PATCH', { decision: 'accept' }, 'accept')
            }
          >
            {busy === 'accept' ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            أقبل {formatAmount(offer.counterAmount ?? 0)}
          </Button>
          <Button
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
  gap,
  gapKind = 'ask',
  foot,
  record,
}: {
  mine: boolean
  who: string
  label: string
  amount: number
  at: string | null
  note?: string | null
  badge?: React.ReactNode
  /** كم يبعد هذا الرقم عن المطلوب — موجبًا دونه وسالبًا فوقه */
  gap?: number | null
  gapKind?: 'ask' | 'floor'
  foot?: string | null
  record?: { settled: number; defaulted: number } | null
}) {
  /* حرفُ الاسم لصاحبه وحده — و«سومُك» ليس اسمًا، فحرفُه يُقرأ اسمًا مبتورًا */
  const initial = mine ? null : who.trim().charAt(0)

  return (
    <div className={cn('flex', mine ? 'justify-start' : 'justify-end')}>
      <div
        className={cn(
          /* دون العرض الكامل: التقابلُ يمينًا ويسارًا هو ما يجعله خيطًا لا قائمة */
          'w-[88%] max-w-[22rem] rounded-2xl px-3.5 py-3',
          /* المِلكُ داكنٌ والوارد فاتح — كما تفرّق المحادثاتُ بين طرفيها */
          mine ? 'bg-ink-950 text-paper' : 'border border-ink-600 bg-ink-800',
        )}
      >
        <div className="flex items-center gap-2">
          {initial ? (
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink-700 text-[11px] font-bold text-muted">
              {initial}
            </span>
          ) : (
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-gold-600/20 text-gold-500">
              <Undo2 className="size-3.5" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-xs font-bold">
              <span className="truncate">{who}</span>
              {badge}
            </p>
            {record && <BuyerRecord record={record} />}
          </div>
          <span className="shrink-0 text-[10px] text-muted">{formatRelative(at)}</span>
        </div>

        <div className="mt-2 flex items-end justify-between gap-3 rounded-xl bg-ink-900/60 px-3 py-2">
          <div>
            <p className="text-[10px] text-muted">{label}</p>
            <p className="text-xl font-extrabold tabular-nums text-gold-500">
              {formatAmount(amount)}
              <span className="ms-1 text-[11px] font-normal text-muted">ر.س</span>
            </p>
          </div>
          {gap !== null && gap !== undefined && (
            <div className="text-end">
              <p className="text-[10px] text-muted">
                {gapKind === 'floor' ? 'فوق الحدّ الأدنى' : 'فرق المطلوب'}
              </p>
              <p
                dir="ltr"
                className={cn(
                  'text-sm font-bold tabular-nums',
                  gap > 0 ? 'text-danger' : 'text-success',
                )}
              >
                {gap > 0 ? '−' : '+'}
                {formatAmount(Math.abs(gap))}
              </p>
            </div>
          )}
        </div>

        {note && <p className="mt-2 text-[11px] leading-relaxed text-muted">«{note}»</p>}
        {foot && <p className="mt-1.5 text-[10px] text-muted">{foot}</p>}
      </div>
    </div>
  )
}

/** سجلُّ المشتري في سطرٍ — ما أتمّه وما سقط عنه. */
function BuyerRecord({ record }: { record: { settled: number; defaulted: number } }) {
  if (record.settled === 0 && record.defaulted === 0) {
    return <p className="text-[10px] text-muted">لا صفقات سابقة</p>
  }
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted">
      {record.settled > 0 && (
        <span className="inline-flex items-center gap-1 text-success">
          <ShieldCheck className="size-3" />
          {arabicCount(record.settled, {
            one: 'صفقة مكتملة',
            two: 'صفقتان مكتملتان',
            few: 'صفقات مكتملة',
            many: 'صفقة مكتملة',
          })}
        </span>
      )}
      {/* الإخلالُ يُقال ولا يُطوى: البائع يقرّر على أساسه */}
      {record.defaulted > 0 && (
        <span className="inline-flex items-center gap-1 text-danger">
          <TriangleAlert className="size-3" />
          {arabicCount(record.defaulted, {
            one: 'صفقة لم يسدّدها',
            two: 'صفقتان لم يسدّدهما',
            few: 'صفقات لم يسدّدها',
            many: 'صفقة لم يسدّدها',
          })}
        </span>
      )}
    </p>
  )
}
