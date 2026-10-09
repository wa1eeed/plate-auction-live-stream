import { z } from 'zod'
import { handleError, ok, readJson } from '@/lib/server/api'
import { patchChannel } from '@/lib/server/app-release-service'
import { requireAdminId } from '@/lib/server/require-admin'
import { getStore } from '@/lib/store'

export const dynamic = 'force-dynamic'

/**
 * **إثباتُ ما نُشر بيدٍ — لما لا يُسأل عنه متجرُه.**
 *
 * فجوجل لا واجهةَ علنيّةَ لها تُقرأ منها نسخةُ الإنتاج، ورفعُ المسار من
 * «اختبارٍ داخليّ» إلى «إنتاج» يقع في لوحة Play لا في سيرِ بنائنا — فلا
 * يعلمه السيرُ ليبلّغ به. فمن رفع المسارَ يُثبته هنا، بضغطةٍ تنسخ ما رُفع
 * إلى قناة الإنتاج.
 *
 * ويُوسَم المثبَتُ يدويًّا بمصدره في العرض، فلا يُقرأ كأنّه من المتجر.
 */
const bodySchema = z.object({
  platform: z.enum(['ios', 'android']),
  channel: z.enum(['testing', 'production']),
  /* `null` يمحو السجلّ — لمن أثبت خطأً */
  release: z
    .object({
      version: z
        .string()
        .trim()
        .regex(/^\d+(\.\d+){0,3}([.+-][0-9A-Za-z.-]+)?$/, 'رقمُ نسخةٍ غير مقروء'),
      build: z.string().trim().max(40).nullable().default(null),
      /* تاريخُ النشر كما في اللوحة — وبلاه لحظةُ الإثبات */
      at: z.string().datetime().nullable().default(null),
    })
    .nullable(),
})

export async function PATCH(request: Request) {
  try {
    const adminId = await requireAdminId()
    const body = bodySchema.parse(await readJson(request))

    const store = getStore()
    const current = await store.getAppReleases()
    const next = await store.updateAppReleases(
      patchChannel(
        current,
        body.platform,
        body.channel,
        body.release
          ? {
              version: body.release.version,
              build: body.release.build,
              at: body.release.at ?? new Date().toISOString(),
              commit: null,
            }
          : null,
      ),
      adminId,
    )
    return ok({ releases: next })
  } catch (error) {
    return handleError(error)
  }
}
