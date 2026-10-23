'use client'

import { useState } from 'react'
import { Check, Copy, IdCard, TriangleAlert } from 'lucide-react'
import { BIRTH_CALENDAR_LABELS, type TransferIdentity } from '@/lib/domain/types'
import { cn } from '@/lib/utils'

/**
 * **بياناتُ المشتري أمام البائع — حيث ينقل، لا في محادثة.**
 *
 * وأبشر يطلب منه رقمَ الهوية وتاريخَ الميلاد. وكانا يُتبادلان خارج المنصّة،
 * فيُملى الرقمُ في محادثةٍ ويُخطئ فيه حرفٌ فيُردّ الطلبُ هناك بلا سببٍ
 * مفهوم — ولا سجلَّ عندنا لما أُرسل حين يُختلف فيه.
 *
 * **ويُنسخ بضغطة**: رقمُ هويةٍ من عشر خاناتٍ يُنسخ باليد فيُسقط منه رقم.
 * وهذا أكثرُ ما يُخطئ فيه الناس حين ينقلون أرقامًا بين شاشتين.
 */
export function BuyerIdentityPanel({
  identity,
  className,
}: {
  identity: TransferIdentity | null
  className?: string
}) {
  if (!identity) {
    return (
      <div
        className={cn(
          'rounded-xl border border-danger/35 bg-danger/[0.06] p-3 text-xs leading-relaxed',
          className,
        )}
      >
        <p className="flex items-start gap-2 font-bold text-danger">
          <TriangleAlert className="mt-px size-3.5 shrink-0" />
          لم يؤكّد المشتري بياناته بعد
        </p>
        <p className="mt-1 text-[11px] text-muted">
          أبشر يطلب رقم هويته وتاريخ ميلاده لإتمام النقل. طُلبت منه في صفحة صفقته، ويصلك
          إشعارٌ فور وصولها — ولا يُقبل رفع إثبات النقل قبلها.
        </p>
      </div>
    )
  }

  return (
    <div className={cn('rounded-xl border border-ink-600 bg-ink-900/50 p-3', className)}>
      <p className="flex items-center gap-1.5 text-xs font-bold">
        <IdCard className="size-3.5 shrink-0 text-gold-500" />
        بيانات المشتري — أدخِلها في أبشر كما هي
      </p>
      <dl className="mt-2 space-y-1.5">
        <CopyRow label="رقم الهوية أو الإقامة" value={identity.nationalId} />
        <CopyRow
          label="تاريخ الميلاد"
          value={identity.birthDate}
          suffix={BIRTH_CALENDAR_LABELS[identity.birthCalendar]}
        />
      </dl>
    </div>
  )
}

function CopyRow({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* متصفّحٌ يمنع الحافظة — والقيمة ظاهرةٌ تُحدَّد باليد */
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2">
        <span dir="ltr" className="truncate font-bold tabular-nums text-paper">
          {value}
          {suffix && <span className="ms-1 text-[10px] font-normal text-muted">({suffix})</span>}
        </span>
        <button
          type="button"
          onClick={() => void copy()}
          aria-label={`انسخ ${label}`}
          className="shrink-0 rounded-lg border border-ink-600 p-1.5 text-muted transition-colors hover:border-gold-600/50 hover:text-paper"
        >
          {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
        </button>
      </dd>
    </div>
  )
}
