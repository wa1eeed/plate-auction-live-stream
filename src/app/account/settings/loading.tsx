import { Skeleton } from '@/components/ui/skeleton'

/**
 * انتظار الإعدادات.
 *
 * و`account/loading.tsx` لا تُغطّيها في كلّ انتقال: حدُّ الانتظار يُثار عند
 * الجزء الذي تبدّل، والانتقال من `/account/wallet` إلى هنا لا يُبدّل جزء
 * `account` — فيبقى المستخدم على الصفحة السابقة بلا إشارة. قِيس ذلك بخادمٍ
 * أُبطئ عمدًا: انتقالٌ ثانٍ مرّ **بلا هيكلٍ واحد**.
 */
export default function SettingsLoading() {
  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-3.5 w-52" />
      </header>

      {/* بطاقة بيانات الحساب */}
      <Skeleton className="h-[72px] rounded-2xl" />

      {/* الإعدادات: مفتاح الصوت وثلاثة صفوف */}
      <div className="space-y-2 rounded-2xl border border-ink-600 bg-ink-800 p-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-[60px] rounded-xl" />
        <Skeleton className="h-[52px] rounded-xl" />
        <Skeleton className="h-[52px] rounded-xl" />
      </div>

      <Skeleton className="h-[120px] rounded-2xl" />
    </div>
  )
}
