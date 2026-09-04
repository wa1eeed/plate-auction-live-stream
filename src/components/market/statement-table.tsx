import { LEDGER_ENTRY_LABELS } from '@/lib/domain/types'
import type { Statement } from '@/lib/domain/wallet'
import { formatAmount } from '@/lib/domain/money'
import { cn, formatTimestamp } from '@/lib/utils'

/**
 * كشف حساب مدين/دائن.
 *
 * قيود الحجز وفكّه تظهر بلا مبلغ في العمودين لأنها لا تغيّر الرصيد الكلي —
 * تنقل جزءًا منه إلى المحجوز فقط. وإخفاؤها كان سيترك المستخدم بلا تفسير
 * لانخفاض رصيده المتاح، فتبقى ظاهرة موسومة «محجوز».
 */
export function StatementTable({ statement }: { statement: Statement }) {
  if (statement.lines.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-600 bg-ink-800/50 p-8 text-center text-sm text-muted">
        لا توجد حركات على هذا الحساب بعد.
      </div>
    )
  }

  return (
    /*
     * الكشف يفرض 720px داخل تمرير أفقي: على 360px يظهر عمودان من ستّة،
     * والمبلغ والرصيد — وهما المقصودان — خلف الحافّة. فيُصيَّر بالقواعد نفسها
     * التي تُصيّر جداول الإدارة: بطاقةٌ لكل قيد تحت `sm`، واسم العمود بجانب
     * قيمته من `--col-N`.
     */
    <div
      style={
        {
          '--col-1': '"رقم الحركة"',
          '--col-2': '"التاريخ"',
          '--col-3': '"البيان"',
          '--col-4': '"مدين"',
          '--col-5': '"دائن"',
          '--col-6': '"الرصيد"',
        } as React.CSSProperties
      }
      className="admin-table overflow-hidden rounded-2xl border border-ink-600 bg-ink-800"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-ink-600 bg-ink-900/60">
              <th className="px-3 py-2.5 text-end text-xs font-bold text-muted">رقم الحركة</th>
              <th className="px-3 py-2.5 text-start text-xs font-bold text-muted">التاريخ</th>
              <th className="px-3 py-2.5 text-start text-xs font-bold text-muted">البيان</th>
              <th className="px-3 py-2.5 text-end text-xs font-bold text-muted">مدين</th>
              <th className="px-3 py-2.5 text-end text-xs font-bold text-muted">دائن</th>
              <th className="px-3 py-2.5 text-end text-xs font-bold text-muted">الرصيد</th>
            </tr>
          </thead>
          <tbody>
            {statement.lines.map((line) => (
              <tr key={line.id} className="border-b border-ink-600/60 last:border-0">
                {/* رقم الحركة أولًا: هو ما يُقتبَس في سؤال عن قيد بعينه */}
                <td
                  dir="ltr"
                  className="whitespace-nowrap px-3 py-2.5 text-end text-[11px] font-semibold tabular-nums text-muted"
                >
                  {line.reference}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted">
                  {formatTimestamp(line.createdAt)}
                </td>
                <td className="px-3 py-2.5">
                  <span className="font-semibold">{LEDGER_ENTRY_LABELS[line.type]}</span>
                  {line.direction === 'neutral' && (
                    <span className="ms-2 rounded-full border border-gold-600/40 px-1.5 py-0.5 text-[10px] text-gold-500">
                      محجوز
                    </span>
                  )}
                  {line.note && <span className="block text-[11px] text-muted">{line.note}</span>}
                </td>
                <td className="px-3 py-2.5 text-end tabular-nums text-danger">
                  {line.debit ? formatAmount(line.debit) : '—'}
                </td>
                <td className="px-3 py-2.5 text-end tabular-nums text-success">
                  {line.credit ? formatAmount(line.credit) : '—'}
                </td>
                <td className="px-3 py-2.5 text-end font-bold tabular-nums">
                  {formatAmount(line.balanceAfter)}
                  {line.heldAfter > 0 && (
                    <span className="block text-[10px] font-normal text-gold-500">
                      محجوز {formatAmount(line.heldAfter)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-ink-600 bg-ink-900/60 font-bold">
              <td className="px-3 py-2.5 text-xs text-muted" colSpan={3}>
                الإجمالي
              </td>
              <Total value={statement.totalDebit} className="text-danger" />
              <Total value={statement.totalCredit} className="text-success" />
              <Total value={statement.closingBalance} />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-ink-600 bg-ink-900/40 px-3 py-2.5 text-xs">
        <span className="text-muted">
          الرصيد الختامي <b className="text-paper">{formatAmount(statement.closingBalance)}</b>
        </span>
        <span className="text-muted">
          المحجوز <b className="text-gold-500">{formatAmount(statement.held)}</b>
        </span>
        <span className="text-muted">
          المتاح <b className="text-success">{formatAmount(statement.available)}</b>
        </span>
      </div>
    </div>
  )
}

function Total({ value, className }: { value: number; className?: string }) {
  return (
    <td className={cn('px-3 py-2.5 text-end tabular-nums', className)}>{formatAmount(value)}</td>
  )
}
