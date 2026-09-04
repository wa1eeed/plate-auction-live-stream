import { FlaskConical } from 'lucide-react'
import { config } from '@/lib/config'

/**
 * شارةٌ تقول إنّ هذه ليست المنصّة الحقيقية.
 *
 * لا تُصيَّر أصلًا ما لم يُطلب `DEMO_HINTS=true`: تُرجع `null` قبل أي عنصر، فلا
 * تترك في نسخ العملاء عقدةً في الشجرة ولا سطرًا في الحُزمة.
 */
export function StagingBanner() {
  if (!config.demoHints) return null

  return (
    <p
      dir="rtl"
      className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 bg-gold-500/15 px-4 py-1.5 text-center text-[11px] font-semibold leading-relaxed text-gold-400"
    >
      <FlaskConical aria-hidden className="size-3.5 shrink-0" />
      نسخة تجريبية — البيانات والأرصدة والمزادات كلّها وهمية،
      <span className="text-muted">ولا تُجرى فيها مدفوعات حقيقية.</span>
    </p>
  )
}
