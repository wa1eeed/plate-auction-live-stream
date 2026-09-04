import Link from 'next/link'
import { ShieldCheck, ShieldAlert, Wallet } from 'lucide-react'
import { formatAmount } from '@/lib/domain/money'
import type { ListingDetail } from '@/lib/domain/types'

/**
 * بيان العربون فوق زرّ المزايدة.
 *
 * ثلاث حالات يحتاج المزايد تمييزها قبل أن يضغط: عربونه محجوز فعلًا، أو رصيده
 * يكفي فيُحجز عند أول مزايدة، أو لا يكفي فيحتاج شحنًا. إخفاء ذلك حتى يفشل
 * الطلب تجربة سيّئة — والخادم يرفض في الحالتين على أي حال.
 */
export function DepositNotice({ detail }: { detail: ListingDetail }) {
  if (detail.depositAmount <= 0) return null

  const amount = formatAmount(detail.depositAmount)

  if (detail.myDepositStatus === 'held') {
    return (
      <p className="mb-3 flex items-center gap-2 rounded-xl border border-success/40 bg-success/[0.07] px-3 py-2.5 text-xs text-success">
        <ShieldCheck className="size-4 shrink-0" />
        عربونك <b>{amount} ريال</b> محجوز على هذا المزاد — لن يُحجز مبلغ آخر.
      </p>
    )
  }

  const enough =
    detail.myAvailableBalance !== null && detail.myAvailableBalance >= detail.depositAmount

  if (!enough) {
    return (
      <div className="mb-3 rounded-xl border border-danger/40 bg-danger/[0.06] px-3 py-2.5 text-xs">
        <p className="flex items-center gap-2 font-semibold text-danger">
          <ShieldAlert className="size-4 shrink-0" />
          يتطلّب هذا المزاد عربونًا {amount} ريال
        </p>
        <p className="mt-1 text-muted">
          رصيدك المتاح{' '}
          <b>{formatAmount(detail.myAvailableBalance ?? 0)} ريال</b> — اشحن محفظتك قبل المزايدة.
        </p>
        <Link
          href="/account/wallet"
          className="mt-1.5 inline-flex items-center gap-1 font-semibold text-gold-500 hover:underline"
        >
          <Wallet className="size-3.5" />
          محفظتي
        </Link>
      </div>
    )
  }

  return (
    <p className="mb-3 flex items-center gap-2 rounded-xl border border-gold-600/40 bg-gold-500/[0.07] px-3 py-2.5 text-xs text-muted">
      <ShieldCheck className="size-4 shrink-0 text-gold-500" />
      سيُحجز عربون <b className="text-gold-500">{amount} ريال</b> من محفظتك عند أول مزايدة، ويعود
      إليك بعد أن يُتمّ الفائز سداده — أو فورًا إن انتهى المزاد بلا بيع.
    </p>
  )
}
