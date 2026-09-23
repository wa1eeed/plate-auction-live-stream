import { Skeleton } from '@/components/ui/skeleton'

/** انتظار «إدارة لوحاتي» — بطاقاتٌ بلوحاتها. */
export default function ListingsLoading() {
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-3.5 w-20" />
        </div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-[188px] rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
