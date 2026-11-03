import { profileUpdateSchema } from '@/lib/domain/schemas'
import { fail, handleError, ok, readJson } from '@/lib/server/api'
import { requireUserId } from '@/lib/server/require-user'
import { getStore } from '@/lib/store'

export const dynamic = 'force-dynamic'

/**
 * ملفُّ صاحب الطلب.
 *
 * **ولم يكن للقراءة مسارٌ أصلًا** — فالويب يقرأ المستخدمَ من الجلسة في
 * الخادم قبل أن تُرسم الصفحة، فلا يسأل شبكةً عن نفسه. والتطبيقُ عميلٌ
 * خارجيّ: كان يطلب هذا المسار فيأتيه ‎٤٠٥‎ (المسار يعرف `PATCH` وحده)،
 * وردُّ الخطأ ليس JSON فتعرض الشاشةُ «تعذّر إتمام الطلب» — وهي رسالةُ
 * ما لا يُفهَم.
 *
 * و`findUser` تُرجع `User` بلا بصمة كلمة السرّ، فلا يُصفّى هنا شيء.
 */
export async function GET() {
  try {
    const userId = await requireUserId()
    const user = await getStore().findUser(userId)
    if (!user) return fail('المستخدم غير موجود', 404, 'USER_NOT_FOUND')
    return ok({ user }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    return handleError(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = await requireUserId()
    const body = profileUpdateSchema.parse(await readJson(request))
    const user = await getStore().updateUser(userId, {
      displayName: body.displayName,
      phone: body.phone ? body.phone : null,
      city: body.city ? body.city : null,
      social: {
        tiktok: body.social?.tiktok ?? null,
        snapchat: body.social?.snapchat ?? null,
        instagram: body.social?.instagram ?? null,
      },
      // حسابٌ لم يُرسَل لا يُمحى: نموذجٌ جزئي لا يمسح آيبانًا مُدخَلًا
      ...(body.payout ? { payout: body.payout } : {}),
    })
    return ok({ user })
  } catch (error) {
    return handleError(error)
  }
}
