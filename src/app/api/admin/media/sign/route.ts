import { z } from 'zod'
import { handleError, ok, readJson } from '@/lib/server/api'
import { requireAdminId } from '@/lib/server/require-admin'
import { signUpload } from '@/lib/server/home-media-service'

export const dynamic = 'force-dynamic'

const schema = z.object({
  purpose: z.enum(['banner', 'story', 'poster', 'user-file']),
  mime: z.string().min(1).max(100),
  size: z.number().int().positive(),
})

/**
 * يوقّع رابطًا يرفع إليه المتصفّح **مباشرةً إلى المخزن**.
 *
 * ولا يمرّ بايتٌ بالخادم — لا هنا ولا في `confirm`. وما يُوقَّع له مفتاحٌ في
 * بادئة الحجر وحدها: حاويةٌ لا نطاقَ لها، فما يهبط فيها لا يُقدَّم لأحد حتى
 * يُصدَّق ويُنقل.
 *
 * و`null` جوابٌ مشروع: محرّك القرص لا يوقّع، فيرجع العميل إلى الرفع عبر
 * الخادم. فالتطوير والفحص يعملان بلا حاويةٍ ولا سرّ.
 */
export async function POST(request: Request) {
  try {
    await requireAdminId()
    const { purpose, mime, size } = schema.parse(await readJson(request))

    const signed = await signUpload({
      purpose,
      declaredMime: mime.trim().toLowerCase(),
      declaredSize: size,
    })

    return ok(signed ?? { unsupported: true })
  } catch (error) {
    return handleError(error)
  }
}
