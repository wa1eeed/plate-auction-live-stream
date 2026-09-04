import { Receipt } from 'lucide-react'
import { formatAmount } from '@/lib/domain/money'
import type { ListingDetail } from '@/lib/domain/types'

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
}: {
  detail: ListingDetail
  /** أيّ طرف يقرأ: المشتري يرى ما يدفعه، والبائع ما يُقتطع من حصيلته */
  side?: 'buyer' | 'seller'
}) {
  const breakdown = side === 'buyer' ? detail.commission.buyer : detail.commission.seller
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
