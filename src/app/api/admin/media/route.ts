import { z } from 'zod'
import { fail, handleError, ok } from '@/lib/server/api'
import { requireAdminId } from '@/lib/server/require-admin'
import { uploadMedia } from '@/lib/server/home-media-service'
import { isAllowedMime } from '@/lib/server/media'
import { UPLOAD_LIMITS } from '@/lib/domain/upload-limits'

export const dynamic = 'force-dynamic'

const purposeSchema = z.enum(['banner', 'story', 'poster', 'user-file'])

/** أكبرُ حدٍّ في الجدول — سقفٌ يُردّ عنده قبل قراءة الجسم أصلًا. */
const MAX_BYTES = Math.max(...Object.values(UPLOAD_LIMITS))

/**
 * رفعُ ملفٍّ من لوحة الإدارة.
 *
 * والحدُّ يُفحص **مرّتين**: على `content-length` قبل القراءة لردٍّ سريع بلا
 * استهلاك ذاكرة، ثمّ على البايتات المقروءة فعلًا في `uploadMedia`. والأولى
 * وحدها لا تكفي — الترويسة يكتبها العميل — والثانية وحدها تعني أن نقرأ
 * جيجابايتًا إلى الذاكرة قبل أن نردّه.
 */
export async function POST(request: Request) {
  try {
    await requireAdminId()

    const declared = Number(request.headers.get('content-length') ?? 0)
    if (declared > MAX_BYTES + 64 * 1024) {
      return fail('الملفّ أكبر من الحدّ المسموح', 413, 'MEDIA_TOO_LARGE')
    }

    const form = await request.formData().catch(() => null)
    const file = form?.get('file')
    if (!form || !(file instanceof File)) {
      return fail('لم يصل ملفّ', 400, 'MEDIA_MISSING')
    }

    const purpose = purposeSchema.parse(form.get('purpose') ?? 'banner')
    const ownerId = typeof form.get('ownerId') === 'string' ? String(form.get('ownerId')) : undefined

    /*
     * النوع من `File.type` لا من اسم الملفّ — ثمّ يُطابَق بالبايتات.
     *
     * والاسم لا يُقرأ إطلاقًا: لا يدخل المفتاح، ولا يُبنى منه امتداد. فاسمٌ
     * فيه `../` أو محرفٌ خبيث لا يبلغ نظام الملفّات ولا الحاوية.
     */
    const mime = file.type.trim().toLowerCase()
    if (!isAllowedMime(mime)) return fail('صيغة غير مدعومة', 415, 'MEDIA_TYPE')

    const bytes = new Uint8Array(await file.arrayBuffer())
    const uploaded = await uploadMedia({ purpose, declaredMime: mime, bytes, ownerId })

    return ok(uploaded)
  } catch (error) {
    return handleError(error)
  }
}
