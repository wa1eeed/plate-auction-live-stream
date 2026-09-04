import { NextResponse } from 'next/server'
import { config } from '@/lib/config'

/*
 * نبضُ حياةٍ للحاوية وللوكيل العكسي — ومرآةٌ لما وصل الخادم من إعدادات.
 *
 * الصفحة الرئيسة لا تصلح فحصًا: تُصيَّر ويُقرأ فيها المخزن وتُشغَّل مسوحه، فيصير
 * الفحص كل عشر ثوانٍ عملًا لا قياسًا.
 *
 * والرايتان معه عمدًا: أن يعتقد الناشر أنه أطفأ وضع Demo والخادم يقرأه مشتغلًا
 * هو أسوأ حالات النشر — بيانات دخول معروضة للعالم بلا أن يعلم. وسطرٌ واحد
 * يقطع الشكّ:  curl https://<النطاق>/api/health
 *
 * ولا يُكشف بهما سرّ: كلاهما مقروء من الواجهة نفسها — حقولٌ معبّأة على صفحة
 * الدخول، وشارةٌ فوق كل صفحة.
 */
export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json(
    { ok: true, demoMode: config.demoMode, staging: config.isStaging },
    { headers: { 'cache-control': 'no-store' } },
  )
}
