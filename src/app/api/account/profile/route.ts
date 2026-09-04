import { profileUpdateSchema } from '@/lib/domain/schemas'
import { handleError, ok, readJson } from '@/lib/server/api'
import { requireUserId } from '@/lib/server/require-user'
import { getStore } from '@/lib/store'

export const dynamic = 'force-dynamic'

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
