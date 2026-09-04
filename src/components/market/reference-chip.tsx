'use client'

import { useState } from 'react'
import { Check, Hash } from 'lucide-react'
import { REFERENCE_LABELS, type ReferenceKind } from '@/lib/domain/reference'
import { cn } from '@/lib/utils'

/**
 * رقم الإعلان، قابل للنسخ بضغطة.
 *
 * الرقم موجود ليُقتبس: في رسالة إلى البائع، أو في طلب دعم، أو في محادثة بين
 * مزايدَين. ونسخُه يدويًا من شاشة جوال أشقّ من نسخ رابط، فجُعلت الضغطة تكفي.
 *
 * والنسخ قد يفشل — متصفّح قديم أو سياق غير آمن — فيبقى الرقم مقروءًا ظاهرًا
 * على أي حال، ولا يعتمد فهمه على نجاح النسخ.
 */
export function ReferenceChip({
  reference,
  kind = 'listing',
  className,
}: {
  reference: string
  kind?: ReferenceKind
  className?: string
}) {
  const label = REFERENCE_LABELS[kind]
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(reference)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      // لا شيء نفعله — الرقم ظاهر ويمكن تحديده يدويًا
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={`${label} — اضغط للنسخ`}
      aria-label={`${label} ${reference}، اضغط للنسخ`}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-ink-600 bg-ink-900/60 px-2.5 py-1 text-xs font-semibold tabular-nums text-muted transition-colors hover:text-paper',
        copied && 'border-success/50 text-success',
        className,
      )}
    >
      {copied ? <Check className="size-3.5" /> : <Hash className="size-3.5" />}
      <span dir="ltr">{reference}</span>
    </button>
  )
}
