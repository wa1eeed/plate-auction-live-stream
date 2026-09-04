import { fail, handleError, ok } from '@/lib/server/api'
import { finalizeDueAuctions } from '@/lib/server/market-service'
import { getStore } from '@/lib/store'

export const dynamic = 'force-dynamic'

const SECRET = process.env.SESSION_SECRET ?? 'development-only-insecure-secret'

/**
 * مسح داخلي يستدعيه الخادم المخصّص كل بضع ثوانٍ لإنهاء المزادات المستحقة.
 * بهذا ينتهي المزاد في وقته حتى لو لم يفتح أحد أي صفحة، ولا يعود الإنهاء
 * معتمدًا على وصول زائر.
 */
export async function POST(request: Request) {
  try {
    if (request.headers.get('x-internal-sweep') !== SECRET) {
      return fail('غير مصرّح', 403, 'FORBIDDEN')
    }
    const finalized = await finalizeDueAuctions(getStore())
    return ok({ finalized })
  } catch (error) {
    return handleError(error)
  }
}
