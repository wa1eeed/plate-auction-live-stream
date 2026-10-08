import { z } from 'zod'
import { MAX_ONBOARDING_SLIDES, ONBOARDING_ICONS } from '@/lib/domain/types'
import { handleError, ok, readJson } from '@/lib/server/api'
import { requireAdminId } from '@/lib/server/require-admin'
import { getStore } from '@/lib/store'

export const dynamic = 'force-dynamic'

/**
 * شرائحُ التعريف — نصٌّ وأيقونةٌ من مجموعةٍ مغلقة.
 *
 * والأيقونةُ تُفحص بـ`enum` لا بنصٍّ حرّ: هذه الشرائح تُعرض لكلّ من يفتح
 * التطبيق أوّل مرّة، واسمُ أيقونةٍ لا وجود لها يُخرج شاشةً فارغة في أوّل
 * لحظةٍ يراها.
 */
const slideSchema = z.object({
  id: z.string().trim().min(1).max(64),
  title: z.string().trim().min(1, 'العنوان مطلوب').max(60),
  body: z.string().trim().min(1, 'النصّ مطلوب').max(240),
  icon: z.enum(ONBOARDING_ICONS),
})

const patchSchema = z.object({
  enabled: z.boolean(),
  splashTagline: z.string().trim().max(80),
  slides: z.array(slideSchema).max(MAX_ONBOARDING_SLIDES),
})

export async function GET() {
  try {
    await requireAdminId()
    return ok({ settings: await getStore().getOnboardingSettings() })
  } catch (error) {
    return handleError(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const adminId = await requireAdminId()
    const patch = patchSchema.parse(await readJson(request))
    return ok({ settings: await getStore().updateOnboardingSettings(patch, adminId) })
  } catch (error) {
    return handleError(error)
  }
}
