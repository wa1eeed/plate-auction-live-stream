import { handleError, ok } from '@/lib/server/api'
import { requireAdminId } from '@/lib/server/require-admin'
import { isPostgresConfigured } from '@/lib/store/pg/client'
import { importSeed, isDatabaseEmpty } from '@/lib/store/pg/import'
import { getStore } from '@/lib/store'

export const dynamic = 'force-dynamic'

/**
 * ملء قاعدةٍ فارغة ببيانات العرض — **بقرارٍ لا بإقلاع**.
 *
 * المنصّة على قاعدةٍ تبدأ فارغة، وذلك صوابٌ لإطلاقٍ حقيقيّ. ومن أراد منصّةً
 * ممتلئة ليعرضها أو يجرّبها يفتح هذا الباب مرّةً.
 */
export async function GET() {
  try {
    await requireAdminId()
    if (!isPostgresConfigured()) return ok({ available: false, reason: 'لا قاعدة بيانات' })
    return ok({ available: true, empty: await isDatabaseEmpty() })
  } catch (error) {
    return handleError(error)
  }
}

export async function POST() {
  try {
    const adminId = await requireAdminId()
    if (!isPostgresConfigured()) {
      return ok({ imported: false, reason: 'لا قاعدة بيانات — المخزن في الذاكرة يبذر نفسه' })
    }

    /*
     * الحارس في الخدمة لا هنا وحده — وهو يرمي على قاعدةٍ غير فارغة.
     * والتقييد بعد النجاح: ما يملأ منصّةً يجب أن يُعرف من فعله ومتى.
     */
    const counts = await importSeed()

    await getStore().appendAudit({
      actorId: adminId,
      action: 'database.seed',
      entityType: 'database',
      entityId: 'singleton',
      beforeData: null,
      afterData: counts,
    })

    return ok({ imported: true, counts })
  } catch (error) {
    return handleError(error)
  }
}
