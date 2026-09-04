import { NextResponse } from 'next/server'
import { config } from '@/lib/config'

/*
 * نبضُ حياةٍ للحاوية وللوكيل العكسي — ومرآةٌ لما وصل الخادم من إعدادات.
 *
 * الصفحة الرئيسة لا تصلح فحصًا: تُصيَّر ويُقرأ فيها المخزن وتُشغَّل مسوحه، فيصير
 * الفحص كل عشر ثوانٍ عملًا لا قياسًا.
 *
 * والراية معه عمدًا: أن يعتقد الناشر أنه أطفأ تلميحات الديمو والخادم يقرأها
 * مشتغلة هو أسوأ حالات النشر — كلمة مرور الإدارة معروضة للعالم بلا أن يعلم.
 * وسطرٌ واحد يقطع الشكّ:  curl https://<النطاق>/api/health
 *
 * ولا يُكشف بها سرّ: هي مقروءة من الواجهة نفسها — حقولٌ معبّأة على صفحة
 * الدخول، وشارةٌ فوق كل صفحة.
 */
export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json(
    { ok: true, demoHints: config.demoHints },
    { headers: { 'cache-control': 'no-store' } },
  )
}
