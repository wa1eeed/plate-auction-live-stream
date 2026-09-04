import { paymentSettingsSchema } from '@/lib/domain/schemas'
import { handleError, ok, readJson } from '@/lib/server/api'
import { requireAdminId } from '@/lib/server/require-admin'
import {
  getPaymentSettings,
  tapConfiguration,
  updatePaymentSettings,
} from '@/lib/server/payment-service'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await requireAdminId()
    // حالة تهيئة المفاتيح دون كشف قيمتها إطلاقًا
    return ok({ settings: await getPaymentSettings(), tap: tapConfiguration() })
  } catch (error) {
    return handleError(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const adminId = await requireAdminId()
    const input = paymentSettingsSchema.parse(await readJson(request))
    return ok({ settings: await updatePaymentSettings(input, adminId) })
  } catch (error) {
    return handleError(error)
  }
}
