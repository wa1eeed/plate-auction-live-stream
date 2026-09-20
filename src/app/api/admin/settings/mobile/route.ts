import { z } from 'zod'
import { PUSH_TEMPLATE_VARIABLES } from '@/lib/domain/types'
import { handleError, ok, readJson } from '@/lib/server/api'
import { requireAdminId } from '@/lib/server/require-admin'
import { getStore } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await requireAdminId()
    return ok({ settings: await getStore().getMobileSettings() })
  } catch (error) {
    return handleError(error)
  }
}

/*
 * ما يُقبل في القالب: نصٌّ ومتغيّراتٌ معروفة — ولا شيء غيرهما.
 *
 * القالب يُملأ باستبدال نصٍّ بنصّ ولا يُنفَّذ منه شيء، فلا باب لحقنٍ برمجيّ.
 * لكنّه يُعرض على شاشةٍ مقفلة ويمرّ بطرفٍ ثالث، فمتغيّرٌ غير معروف يُترك
 * حرفيًّا في النصّ (`{{amount}}` تُقرأ كما هي) — ورفضُه عند الحفظ خيرٌ من أن
 * يُكتشف في إشعارٍ وصل ألفَ جهاز.
 */
const ALLOWED = new Set<string>(PUSH_TEMPLATE_VARIABLES)

const templateText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine(
      (value) => (value.match(/\{\{\w+\}\}/g) ?? []).every((token) => ALLOWED.has(token)),
      { message: `المتغيّرات المسموحة: ${PUSH_TEMPLATE_VARIABLES.join('، ')}` },
    )

const schema = z.object({
  pushTypes: z.record(
    z.string().max(60),
    z.object({
      enabled: z.boolean(),
      // العنوان يُقصّ على الشاشة المقفلة، والنصّ سطران — فالحدّ وصفٌ لا تحكّم
      title: templateText(60),
      body: templateText(160),
    }),
  ),
  /** رقم نسخةٍ بصيغة `1.2.3` أو فارغ — ولا يُلزِم أحدًا اليوم */
  minVersion: z
    .string()
    .trim()
    .regex(/^\d+\.\d+\.\d+$/)
    .nullish()
    .or(z.literal('').transform(() => null)),
  recommendedVersion: z
    .string()
    .trim()
    .regex(/^\d+\.\d+\.\d+$/)
    .nullish()
    .or(z.literal('').transform(() => null)),
})

export async function PATCH(request: Request) {
  try {
    const adminId = await requireAdminId()
    const input = schema.parse(await readJson(request))
    const store = getStore()
    const before = await store.getMobileSettings()

    const settings = await store.updateMobileSettings(
      {
        pushTypes: input.pushTypes,
        minVersion: input.minVersion ?? null,
        recommendedVersion: input.recommendedVersion ?? null,
      },
      adminId,
    )

    await store.appendAudit({
      actorId: adminId,
      action: 'mobile.settings',
      entityType: 'mobile_settings',
      entityId: 'singleton',
      beforeData: {
        disabled: Object.entries(before.pushTypes)
          .filter(([, value]) => !value.enabled)
          .map(([key]) => key),
        minVersion: before.minVersion,
      },
      afterData: {
        disabled: Object.entries(settings.pushTypes)
          .filter(([, value]) => !value.enabled)
          .map(([key]) => key),
        minVersion: settings.minVersion,
      },
    })

    return ok({ settings })
  } catch (error) {
    return handleError(error)
  }
}
