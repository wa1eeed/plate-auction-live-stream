import { z } from 'zod'
import { fail, handleError, ok, readJson } from '@/lib/server/api'
import { requireAdminId } from '@/lib/server/require-admin'
import { getStore } from '@/lib/store'
import { BRAND_ASSET_LIMITS, type BrandAsset } from '@/lib/domain/types'

export const dynamic = 'force-dynamic'

/**
 * أيقونةُ التطبيق وشاشةُ إقلاعه — مسارٌ خاصٌّ بها.
 *
 * ومخطَّطُ الهويّة ليس جزئيًّا: يشترط الاسمَ واللونَ ونصَّ الواجهة معًا،
 * فحفظُ أيقونةٍ وحدها عبره يعني إرسالَ الهويّة كلِّها من شاشةٍ لا تعرضها —
 * فيُكتب ما لم يُحرَّر. وهذه خانةٌ في صفحةٍ أخرى، فلها بابُها.
 */
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']

const bodySchema = z.object({
  appIcon: z
    .object({
      data: z.string().min(1),
      mime: z.string().refine((value) => IMAGE_TYPES.includes(value), 'صيغة صورة غير مدعومة'),
      fileName: z.string().max(200).default('أيقونة'),
    })
    .nullable(),
})

export async function PATCH(request: Request) {
  try {
    await requireAdminId()
    const { appIcon } = bodySchema.parse(await readJson(request))

    let asset: BrandAsset | null = null
    if (appIcon) {
      const bytes = Buffer.from(appIcon.data, 'base64').byteLength
      if (bytes > BRAND_ASSET_LIMITS.appIcon) {
        return fail('الصورة أكبر من الحدّ المسموح', 413, 'ASSET_TOO_LARGE')
      }
      asset = { ...appIcon, bytes, updatedAt: new Date().toISOString() }
    }

    const settings = await getStore().updateBrandSettings({ appIcon: asset })
    return ok({ appIcon: settings.appIcon })
  } catch (error) {
    return handleError(error)
  }
}
