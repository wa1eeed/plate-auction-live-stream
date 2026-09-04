import { Skeleton } from '@/components/ui/skeleton'

/** انتظار صفحة إدارية — على مستوى الصفحة لا القسم (هيكل القسم يُعلّق التنقّل). */
export default function AdminPageLoading() {
  return (
    <>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-3.5 w-72" />
      </div>
      <Skeleton className="h-11 w-full rounded-2xl" />
      <div className="mt-4 space-y-2 rounded-2xl border border-ink-600 bg-ink-800 p-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-9 w-full" />
        ))}
      </div>
    </>
  )
}
