import { NextResponse } from 'next/server'

/*
 * نبضُ حياةٍ للحاوية وللوكيل العكسي.
 *
 * الصفحة الرئيسة لا تصلح فحصًا: تُصيَّر ويُقرأ فيها المخزن وتُشغَّل مسوحه، فيصير
 * الفحص كل عشر ثوانٍ عملًا لا قياسًا. وهذا المسار يقول «العملية تستقبل» ولا
 * يمسّ شيئًا — ولا يكشف نسخةً ولا بيئةً لمن يستطلع من الخارج.
 */
export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json({ ok: true }, { headers: { 'cache-control': 'no-store' } })
}
