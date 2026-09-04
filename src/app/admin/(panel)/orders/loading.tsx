import { Skeleton } from '@/components/ui/skeleton'

/**
 * انتظار صفحة الصفقات.
 *
 * على مستوى **الصفحة** لا القسم: هيكلٌ عند `(panel)` يلفّ التخطيط نفسه
 * فيُعلّق التنقّل داخل اللوحة — قِيس ستّين ثانية ثم أُزيل. وحدُّه هنا صفحةٌ
 * واحدة، فالتخطيط والتنقّل يبقيان مصيَّرين.
 */
export default function AdminOrdersLoading() {
  return (
    <>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-3.5 w-80" />
      </div>
      <Skeleton className="h-11 w-full rounded-2xl" />
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-9 w-32 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 w-full rounded-2xl" />
        ))}
      </div>
    </>
  )
}
