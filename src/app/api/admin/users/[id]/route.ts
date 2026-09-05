import { z } from 'zod'
import { handleError, ok, readJson, fail } from '@/lib/server/api'
import { requireAdminId } from '@/lib/server/require-admin'
import { getStore } from '@/lib/store'

export const dynamic = 'force-dynamic'

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullable()
    .default(null)

/** الحساب بلا `@` وبحروف صغيرة — والعرض يعيد `@` (انظر `types.ts`). */
const handle = z
  .string()
  .trim()
  .max(40)
  .transform((value) => value.replace(/^@+/, '').toLowerCase() || null)
  .nullable()
  .default(null)

const schema = z.object({
  displayName: z.string().trim().min(2, 'الاسم مطلوب').max(80),
  email: z.string().trim().email('البريد غير صحيح').toLowerCase(),
  phone: optionalText(20),
  city: optionalText(60),
  social: z.object({ tiktok: handle, snapchat: handle, instagram: handle }),
  payout: z.object({
    bankName: z.string().trim().max(80).default(''),
    iban: z
      .string()
      .trim()
      .toUpperCase()
      .max(34)
      .refine((v) => v === '' || /^SA\d{22}$/.test(v), 'الآيبان السعودي يبدأ بـSA ويليه ٢٢ رقمًا')
      .default(''),
    accountName: z.string().trim().max(80).default(''),
  }),
})

/**
 * تعديل بيانات مستخدم من اللوحة.
 *
 * ما لا يُعدَّل هنا عمدًا: **رقم العضوية** لأنّه مكتوبٌ في فواتير وصفقات
 * صدرت، و**الرصيد** لأنّ له مساره المحاسبيّ بقيدٍ ومرجع لا بتحرير حقل. وما
 * عداهما بيانات تواصلٍ وحساب إيداع، يخطئ فيها صاحبها فيصحّحها الدعم.
 *
 * والتغيير يُقيَّد في سجلّ التدقيق بقيمتيه قبل وبعد: تعديل آيبانٍ من اللوحة
 * فعلٌ يُوجَّه إليه المال، فلا يقع بلا أثر يُراجَع.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const adminId = await requireAdminId()
    const { id } = await context.params
    const input = schema.parse(await readJson(request))
    const store = getStore()

    const before = await store.findUser(id)
    if (!before) return fail('المستخدم غير موجود', 404, 'USER_NOT_FOUND')

    // البريد مفتاح الدخول: تكراره يمنع صاحبه الأصلي من حسابه
    const clash = await store.findUserByEmail(input.email)
    if (clash && clash.id !== id) return fail('البريد مستخدم لحساب آخر', 409, 'EMAIL_TAKEN')

    const user = await store.updateUser(id, input)

    await store.appendAudit({
      actorId: adminId,
      action: 'user.update',
      entityType: 'user',
      entityId: id,
      beforeData: {
        displayName: before.displayName,
        email: before.email,
        phone: before.phone,
        city: before.city,
        iban: before.payout.iban,
      },
      afterData: {
        displayName: user.displayName,
        email: user.email,
        phone: user.phone,
        city: user.city,
        iban: user.payout.iban,
      },
    })

    return ok({ user })
  } catch (error) {
    return handleError(error)
  }
}
