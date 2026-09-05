import { Receipt } from 'lucide-react'
import { formatAmount } from '@/lib/domain/money'
import type { CommissionSide, ListingDetail } from '@/lib/domain/types'

/** يصف القاعدة نصًّا: نسبةً أو مبلغًا، بحدَّيها وضريبتها. */
function describeCommissionRule(rule: CommissionSide | null, vatPercent: number): string | null {
  if (!rule?.enabled) return null
  const parts = [
    rule.mode === 'percent'
      ? `عمولة ${rule.percent}٪`
      : `عمولة ${formatAmount(rule.fixed)} ريال`,
  ]
  // «وأقصى» تتبع «بحدٍّ أدنى»؛ فإن لم يكن أدنى فهي «بحدٍّ أقصى» وحدها
  if (rule.min > 0) parts.push(`بحدٍّ أدنى ${formatAmount(rule.min)}`)
  if (rule.max > 0) parts.push(`${rule.min > 0 ? 'وأقصى' : 'بحدٍّ أقصى'} ${formatAmount(rule.max)}`)
  if (vatPercent > 0) parts.push(`+ ضريبة ${vatPercent}٪`)
  return parts.join(' ')
}

/**
 * عمولة المنصّة قبل الالتزام لا بعده.
 *
 * رسمٌ يكتشفه المشتري بعد أن رست عليه اللوحة يُفسد الثقة أكثر ممّا يجمع من
 * إيراد. ولذلك يظهر هنا محسوبًا على السعر القائم، ويتغيّر مع كل مزايدة.
 *
 * ولا يظهر شيء أصلًا إن كانت العمولة معطّلة — لا نُقلق أحدًا برسمٍ لا وجود له.
 */
export function CommissionNotice({
  detail,
  side = 'buyer',
  asRule = false,
}: {
  detail: ListingDetail
  /** أيّ طرف يقرأ: المشتري يرى ما يدفعه، والبائع ما يُقتطع من حصيلته */
  side?: 'buyer' | 'seller'
  /**
   * يقول القاعدة لا المبلغ.
   *
   * في السوم لا سعر بعدُ: المبلغ يكتبه صاحبه. وكانت الحصيلة تُحسب على أقلّ
   * عرضٍ مقبول وتُعرض رقمًا صريحًا، فيقرأ من يعرض ٤٥٬٠٠٠ أنّ عمولته ٦٩٠
   * — وهي عمولة الثلاثين ألفًا. ورقمان مختلفان على شاشةٍ واحدة يُقرآن خللًا
   * في احترام الإعدادات، وإنّما هما سؤالان مختلفان.
   */
  asRule?: boolean
}) {
  const breakdown = side === 'buyer' ? detail.commission.buyer : detail.commission.seller

  if (asRule) {
    const rule = describeCommissionRule(
      side === 'buyer' ? detail.commission.buyerRule : null,
      detail.commission.vatEnabled ? detail.commission.vatPercent : 0,
    )
    if (!rule) return null
    return (
      <p className="mb-3 flex items-start gap-2 rounded-xl border border-ink-600 bg-ink-900/60 px-3 py-2.5 text-xs text-muted">
        <Receipt className="mt-0.5 size-4 shrink-0 text-gold-500" />
        <span>
          تُضاف <b className="text-paper">{rule}</b> على مبلغ عرضك، وتُستحقّ عند قبول البائع
          — ويظهر مقدارها أسفل الحقل وأنت تكتب.
        </span>
      </p>
    )
  }

  if (breakdown.total <= 0) return null

  const label = side === 'buyer' ? 'تُضاف عليك' : 'تُقتطع من حصيلتك'

  return (
    <p className="mb-3 flex items-start gap-2 rounded-xl border border-ink-600 bg-ink-900/60 px-3 py-2.5 text-xs text-muted">
      <Receipt className="mt-0.5 size-4 shrink-0 text-gold-500" />
      <span>
        عمولة المنصّة على هذه الصفقة{' '}
        <b className="text-paper">{formatAmount(breakdown.total)} ريال</b> {label} عند اكتمالها.
        {breakdown.vat > 0 && (
          <>
            {' '}
            <span className="text-[11px]">
              ({formatAmount(breakdown.base)} عمولة + {formatAmount(breakdown.vat)} ضريبة قيمة
              مضافة {detail.commission.vatPercent}٪)
            </span>
          </>
        )}
      </span>
    </p>
  )
}
