import { z } from 'zod'
import { handleError, ok, readJson } from '@/lib/server/api'
import { requireAdminId } from '@/lib/server/require-admin'
import { cancelDisbursement, payDisbursement } from '@/lib/server/disbursement-service'

export const dynamic = 'force-dynamic'

const bodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('pay'),
    paymentReference: z
      .string()
      .trim()
      .min(3, 'اكتب مرجع الحوالة كما ورد من البنك')
      .max(80, 'المرجع طويل جدًا'),
    note: z.string().trim().max(300, 'الملاحظة طويلة جدًا').optional(),
  }),
  z.object({
    action: z.literal('cancel'),
    reason: z.string().trim().min(3, 'اذكر سبب الإلغاء').max(300, 'السبب طويل جدًا'),
  }),
])

/** إقفال أمر صرف بحوالة، أو إلغاؤه قبل تنفيذه. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const adminId = await requireAdminId()
    const { id } = await context.params
    const body = bodySchema.parse(await readJson(request))

    const disbursement =
      body.action === 'pay'
        ? await payDisbursement({
            id,
            paymentReference: body.paymentReference,
            note: body.note ?? null,
            adminId,
          })
        : await cancelDisbursement({ id, reason: body.reason, adminId })

    return ok({ disbursement })
  } catch (error) {
    return handleError(error)
  }
}
