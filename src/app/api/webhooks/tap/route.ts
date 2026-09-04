import { NextResponse } from 'next/server'
import { handleTapWebhook, getPaymentSettings } from '@/lib/server/payment-service'
import { verifyWebhookSignature } from '@/lib/server/tap-client'

export const dynamic = 'force-dynamic'

/**
 * ويبهوك Tap — إشعار خادم إلى خادم بنتيجة الدفع.
 *
 * **التوقيع إلزامي.** بلا التحقّق منه يستطيع أي طرف إرسال «تم الدفع» إلى هذا
 * المسار فيشحن رصيده مجانًا. نحسب HMAC-SHA256 بالمفتاح السرّي على الحقول
 * بالترتيب الذي يحدّده Tap، ونقارنه بترويسة `hashstring` مقارنة ثابتة الزمن.
 *
 * ولا نصدّق حالة الحمولة نفسها: بعد التحقّق نقرأ العملية من البوابة مباشرة،
 * فالحمولة قد تكون قديمة أو ناقصة.
 */
export async function POST(request: Request) {
  let payload: Record<string, unknown>
  try {
    payload = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ received: true }, { status: 400 })
  }

  const settings = await getPaymentSettings()
  const hashString =
    request.headers.get('hashstring') ?? request.headers.get('hashString') ?? null

  if (!verifyWebhookSignature(settings.tapMode, payload, hashString)) {
    // 401 لا 200: نريد أن يظهر الرفض في سجلّات Tap لا أن يُبتلع بصمت
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  const chargeId = typeof payload.id === 'string' ? payload.id : null
  if (chargeId) try {
      await handleTapWebhook(chargeId)
    } catch {
      /* نُعيد 200 دائمًا: الرمي يُنتج 500 فتُعيد Tap المحاولة بلا فائدة.
         المزامنة تُصحَّح عند عودة المستخدم أو بقرار الأدمن. */
    }

  // 200 دائمًا بعد التحقّق: خطأ داخلي عندنا يجعل Tap يعيد المحاولة بلا داعٍ،
  // والمزامنة تُصحّح نفسها عند عودة المستخدم على أي حال.
  return NextResponse.json({ received: true })
}
