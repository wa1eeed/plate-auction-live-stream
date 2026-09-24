import { z } from 'zod'
import { handleError, ok, readJson } from '@/lib/server/api'
import { requireAdminId } from '@/lib/server/require-admin'
import { confirmUpload } from '@/lib/server/home-media-service'

export const dynamic = 'force-dynamic'

const schema = z.object({
  purpose: z.enum(['banner', 'story', 'poster', 'user-file']),
  key: z.string().min(1).max(512),
})

/**
 * يُصدّق ما رفعه المتصفّح إلى الحجر، ثمّ ينقله إلى موضعه.
 *
 * وهنا تقع الحراسةُ كلُّها: الحجمُ كما يراه المخزن، والنوعُ بالبايتات،
 * ونسبةُ البنر — بقراءة رأس الملفّ لا بتحميله. وما سقط يُمحى من الحجر.
 *
 * ولا يُقبل إلّا مفتاحُ حجْر: فلا يُستعمل هذا المسار لِيُدَّعى تصديقُ مفتاحٍ
 * قائمٍ في `platform/`، ولا لِيُقرأ ما تحت `users-files/`.
 */
export async function POST(request: Request) {
  try {
    await requireAdminId()
    const { purpose, key } = schema.parse(await readJson(request))
    return ok(await confirmUpload({ purpose, key }))
  } catch (error) {
    return handleError(error)
  }
}
