import { Skeleton, SkeletonRow } from '@/components/ui/skeleton'

/** انتظار المحفظة — البطاقة الداكنة أوّلًا، ثمّ آخر العمليات. */
export default function WalletLoading() {
  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-3.5 w-64" />
      </header>

      {/* بطاقة الرصيد — تحجز ارتفاعها فلا تقفز الصفحة عند وصولها */}
      <Skeleton className="h-[164px] rounded-2xl" />

      <div className="flex gap-2">
        <Skeleton className="h-11 flex-1 rounded-xl" />
        <Skeleton className="h-11 flex-1 rounded-xl" />
      </div>

      <div className="space-y-3">
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    </div>
  )
}
