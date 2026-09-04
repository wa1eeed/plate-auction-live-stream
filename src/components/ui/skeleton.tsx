import { cn } from '@/lib/utils'

/**
 * هيكل انتظار.
 *
 * صفحات الحساب والإدارة كلّها `force-dynamic`، فالانتقال بينها يترك الشاشة
 * على الصفحة السابقة حتى يردّ الخادم — فيبدو الضغط بلا أثر ويُعاد. والهيكل
 * يقول «وصلَك الطلب ويُبنى» في اللحظة نفسها، ويحجز مواضع المحتوى فلا تقفز
 * الصفحة عند وصوله.
 *
 * ويُرسَل من الخادم بشفافية كاملة لا صفر: لمعانه `background-position` لا
 * `opacity`، فلو تعطّل السكربت بقي مرئيًّا.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('skeleton rounded-lg', className)} />
}

/** سطر نصّ — عرضه نسبة من السطر ليبدو كنصّ لا كشريط. */
export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number
  className?: string
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className="h-3"
          // آخر سطر أقصر: النصّ الحقيقي لا ينتهي عند الحافّة
        />
      ))}
    </div>
  )
}

/** بطاقة لوحة في الشبكة — بنسبها نفسها فلا يقفز التخطيط عند الوصول. */
export function SkeletonPlateCard() {
  return (
    <div className="surface space-y-3 rounded-2xl p-4">
      <Skeleton className="aspect-[2.6/1] w-full rounded-xl" />
      <Skeleton className="h-3.5 w-2/3" />
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  )
}

/** صفّ في قائمة أو جدول. */
export function SkeletonRow() {
  return (
    <div className="surface flex items-center gap-4 rounded-2xl p-4">
      <Skeleton className="h-14 w-32 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-3 w-56" />
      </div>
      <Skeleton className="h-6 w-20 shrink-0" />
    </div>
  )
}
