'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { BadgeCheck, IdCard, Loader2, PencilLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRouteRefresh } from '@/lib/hooks/use-route-refresh'
import {
  IDENTITY_ERROR_TEXT,
  validateTransferIdentity,
} from '@/lib/domain/absher-transfer'
import { BIRTH_CALENDAR_LABELS, type TransferIdentity } from '@/lib/domain/types'
import { LocalTime } from './local-time'
import { cn } from '@/lib/utils'

/**
 * **بياناتُ المشتري لنقل اللوحة — تُطلب منه في مرحلة النقل.**
 *
 * وأبشر يطلب من البائع رقمَ هوية المشتري أو إقامته وتاريخَ ميلاده. وكانت
 * المنصّةُ لا تعرفهما، فيخرج الطرفان إلى واتساب يتبادلانهما — ورقمٌ يُملى
 * في محادثةٍ يُخطئ فيه حرفٌ فيُردّ الطلبُ في أبشر بلا سببٍ مفهوم، وتقف
 * الصفقةُ وما أحدٌ يدري أين.
 *
 * **ولا تُطلب في الملفّ الشخصيّ**: هي بياناتُ هذه الصفقة بعينها، تُسأل حين
 * يُحتاج إليها — فلا تُجمع هويّاتُ الناس في ملفّاتٍ لغير حاجة، ولا يُسأل
 * عنها من جاء يتصفّح.
 *
 * **والتقويمُ معها**: تاريخُ الميلاد في سجلّ أبشر هجريٌّ للمواطن وميلاديٌّ
 * لكثيرٍ من المقيمين، ورقمٌ بلا تقويمه يُدخَل خطأً فيُردّ الطلب.
 */
export function TransferIdentityCard({
  orderId,
  identity,
  /** بعد رفع الإثبات لا يُعدَّل ما بُني عليه نقلٌ وقع */
  editable,
}: {
  orderId: string
  identity: TransferIdentity | null
  editable: boolean
}) {
  const { refresh } = useRouteRefresh()
  const [open, setOpen] = useState(identity === null)
  const [nationalId, setNationalId] = useState(identity?.nationalId ?? '')
  const [birthDate, setBirthDate] = useState(identity?.birthDate ?? '')
  const [calendar, setCalendar] = useState<TransferIdentity['birthCalendar']>(
    identity?.birthCalendar ?? 'hijri',
  )
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    /*
     * والتحقّقُ بالقاعدة نفسِها التي يحرس بها الخادم — دالّةٌ خالصةٌ
     * يستعملها الاثنان، فلا تَعِد الشاشةُ بما يردّه الخادم ولا تردّ ما يقبله.
     */
    const failure = validateTransferIdentity({ nationalId, birthDate, birthCalendar: calendar })
    if (failure) {
      toast.error(IDENTITY_ERROR_TEXT[failure])
      return
    }
    setBusy(true)
    try {
      const response = await fetch(`/api/orders/${orderId}/identity`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nationalId, birthDate, birthCalendar: calendar }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.error?.message ?? 'تعذّر حفظ البيانات')
        return
      }
      toast.success('وصلت بياناتك إلى البائع')
      setOpen(false)
      await refresh()
    } catch {
      toast.error('تعذّر الاتصال — تحقّق من الشبكة وأعد المحاولة')
    } finally {
      setBusy(false)
    }
  }

  const confirmed = identity !== null

  return (
    <section
      className={cn(
        'rounded-2xl border p-4',
        confirmed ? 'border-ink-600 bg-ink-800' : 'border-gold-600/50 bg-gold-500/[0.06]',
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <IdCard className={cn('size-4 shrink-0', confirmed ? 'text-success' : 'text-gold-500')} />
          بياناتك لنقل اللوحة
        </h2>
        {confirmed && (
          <span className="inline-flex items-center gap-1 rounded-full border border-success/45 bg-success/12 px-2.5 py-0.5 text-[11px] font-bold text-success">
            <BadgeCheck className="size-3.5" />
            وصلت البائع
          </span>
        )}
      </header>

      <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
        يحتاجها البائع ليُرسل لك اللوحة في أبشر — وهي البيانات نفسُها التي تطلبها الخدمة
        هناك. راجِعها قبل الإرسال؛ حرفٌ واحدٌ خاطئ يُردّ الطلب.
      </p>

      {confirmed && !open ? (
        <>
          <dl className="mt-3 space-y-1.5 rounded-xl border border-ink-600 bg-ink-900/50 p-3 text-xs">
            <Row label="رقم الهوية أو الإقامة" value={identity.nationalId} />
            <Row
              label="تاريخ الميلاد"
              value={`${identity.birthDate} (${BIRTH_CALENDAR_LABELS[identity.birthCalendar]})`}
            />
            <div className="flex items-baseline justify-between gap-3 border-t border-ink-600 pt-1.5 text-[11px] text-muted">
              <dt>أُكّدت</dt>
              <dd className="tabular-nums">
                <LocalTime iso={identity.confirmedAt} mode="datetime" />
              </dd>
            </div>
          </dl>
          {editable && (
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setOpen(true)}>
              <PencilLine className="size-4" />
              تعديل البيانات
            </Button>
          )}
        </>
      ) : (
        <form onSubmit={submit} className="mt-3 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`nid-${orderId}`}>رقم الهوية الوطنية أو الإقامة</Label>
            <Input
              id={`nid-${orderId}`}
              value={nationalId}
              onChange={(event) => setNationalId(event.target.value.replace(/\D/g, '').slice(0, 10))}
              inputMode="numeric"
              autoComplete="off"
              dir="ltr"
              placeholder="1xxxxxxxxx"
              className="text-center tabular-nums"
              disabled={busy}
            />
            <p className="text-[11px] text-muted">عشر خانات تبدأ بـ1 للمواطن أو 2 للمقيم.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`dob-${orderId}`}>تاريخ الميلاد</Label>
            <Input
              id={`dob-${orderId}`}
              value={birthDate}
              onChange={(event) => setBirthDate(event.target.value)}
              type="date"
              dir="ltr"
              disabled={busy}
            />
            {/*
              * والتقويمُ اختيارٌ ظاهرٌ لا افتراضٌ مخفيّ: سجلُّ أبشر هجريٌّ
              * للمواطن وميلاديٌّ لكثيرٍ من المقيمين، ومن أدخل تاريخًا
              * بتقويمٍ غير تقويمه رُدَّ طلبُه ولم يُقَل له لماذا.
              */}
            {/*
              * واسمُ المجموعة «تقويم الميلاد» لا «تقويم تاريخ الميلاد»:
              * الثاني يحوي اسمَ الحقل فوقه، فيلتبسان على قارئ الشاشة وعلى
              * كلّ منتقٍ يبحث بالاسم.
              */}
            <div className="flex gap-2 pt-0.5" role="radiogroup" aria-label="تقويم الميلاد">
              {(['hijri', 'gregorian'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={calendar === value}
                  onClick={() => setCalendar(value)}
                  className={cn(
                    'flex-1 rounded-xl border px-3 py-2 text-xs font-bold transition-colors',
                    calendar === value
                      ? 'border-gold-600 bg-gold-500/15 text-gold-400'
                      : 'border-ink-600 bg-ink-900/50 text-muted hover:text-paper',
                  )}
                >
                  {BIRTH_CALENDAR_LABELS[value]}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted">كما هو في سجلّك لدى أبشر.</p>
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="size-5 animate-spin" /> : <BadgeCheck className="size-5" />}
            {confirmed ? 'احفظ التعديل' : 'أكّد وأرسل للبائع'}
          </Button>
          {confirmed && (
            <Button type="button" variant="ghost" className="w-full" onClick={() => setOpen(false)}>
              تراجع
            </Button>
          )}
        </form>
      )}
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd dir="ltr" className="font-bold tabular-nums text-paper">
        {value}
      </dd>
    </div>
  )
}
