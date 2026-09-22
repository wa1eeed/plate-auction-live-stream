import Link from 'next/link'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Lock,
  Receipt,
  RotateCcw,
  ShoppingCart,
  type LucideIcon,
} from 'lucide-react'
import { LEDGER_ENTRY_LABELS, type LedgerEntryType } from '@/lib/domain/types'
import { formatAmount } from '@/lib/domain/money'
import type { StatementLine } from '@/lib/domain/wallet'
import { cn, formatTimestamp } from '@/lib/utils'

/**
 * آخر العمليات — **لمحةٌ تُقرأ بنظرة**، والكشف الكامل تحتها.
 *
 * وكشف الحساب جدولٌ بمدينٍ ودائنٍ ورصيدٍ بعد كلّ قيد، وهو ما يُحتاج إليه حين
 * يُراجَع حساب. لكنّ أكثر من يفتح المحفظة يسأل سؤالًا واحدًا: **ماذا جرى
 * أخيرًا؟** فيُجاب عنه في خمسة أسطر، ومن أراد التفصيل نزل إليه — ولا يُحذف.
 *
 * ولكلّ نوعٍ أيقونتُه ولونُه: القيد يُعرف قبل أن يُقرأ نصُّه، وهو ما يفرّق
 * بين «حُجز عربون» و«عاد عربون» في لمحةٍ واحدة.
 */

type Tone = 'in' | 'out' | 'hold' | 'neutral'

const VISUALS: Partial<Record<LedgerEntryType, { icon: LucideIcon; tone: Tone }>> = {
  topup: { icon: ArrowDownLeft, tone: 'in' },
  withdrawal: { icon: ArrowUpRight, tone: 'out' },
  deposit_hold: { icon: Lock, tone: 'hold' },
  deposit_release: { icon: RotateCcw, tone: 'in' },
  deposit_forfeit: { icon: Lock, tone: 'out' },
  deposit_applied: { icon: Lock, tone: 'neutral' },
  sale_proceeds: { icon: ArrowDownLeft, tone: 'in' },
  purchase_payment: { icon: ShoppingCart, tone: 'out' },
  purchase_refund: { icon: RotateCcw, tone: 'in' },
  commission: { icon: Receipt, tone: 'out' },
  vat: { icon: Receipt, tone: 'out' },
  adjustment: { icon: Receipt, tone: 'neutral' },
}

const TONE: Record<Tone, string> = {
  in: 'bg-success/12 text-success',
  out: 'bg-danger/12 text-danger',
  hold: 'bg-gold-500/15 text-gold-500',
  neutral: 'bg-ink-700 text-muted',
}

export function RecentActivity({ lines, limit = 5 }: { lines: StatementLine[]; limit?: number }) {
  if (lines.length === 0) return null

  /* الأحدث أوّلًا — والقيود تُبنى تصاعديًّا لأنّ الرصيد يتراكم */
  const recent = [...lines].reverse().slice(0, limit)

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-bold">آخر العمليات</h2>
        {lines.length > limit && (
          <Link href="#statement" className="text-[12px] font-semibold text-gold-500 hover:underline">
            عرض الكل
          </Link>
        )}
      </div>

      <ul className="surface divide-y divide-ink-600/70 overflow-hidden rounded-2xl">
        {recent.map((line) => {
          const visual = VISUALS[line.type] ?? { icon: Receipt, tone: 'neutral' as Tone }
          const Icon = visual.icon
          /*
           * قيود الحجز وفكّه بلا مبلغٍ في العمودين: لا تغيّر الرصيد الكلي بل
           * تنقل جزءًا منه. فيُعرض مبلغُ القيد نفسه بلا إشارةٍ بدل صفرٍ لا
           * يقول شيئًا — والأيقونة تقول إنّه حجزٌ لا صرف.
           */
          const moved = line.credit || line.debit || line.amount
          const sign = line.credit ? '+' : line.debit ? '−' : ''

          return (
            <li key={line.id} className="flex items-center gap-3 px-4 py-3">
              <span
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-full',
                  TONE[visual.tone],
                )}
              >
                <Icon className="size-4" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold">
                  {LEDGER_ENTRY_LABELS[line.type] ?? 'حركة'}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-muted">
                  {line.plateLabel ? `${line.plateLabel} · ` : ''}
                  {formatTimestamp(line.createdAt)}
                </p>
              </div>

              <span
                className={cn(
                  'shrink-0 text-[13px] font-extrabold tabular-nums',
                  line.credit ? 'text-success' : line.debit ? 'text-danger' : 'text-gold-500',
                )}
              >
                {sign}
                {formatAmount(moved)}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
