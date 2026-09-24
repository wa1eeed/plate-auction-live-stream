import { getCurrentAdmin } from '@/lib/server/require-admin'
import { getCurrentUser } from '@/lib/server/require-user'
import { contentTypeOf, getMedia, isPublicKey, isSafeKey, ownerOfKey } from '@/lib/server/media'

export const dynamic = 'force-dynamic'

/**
 * تقديمُ الملفّات — **بابان لا باب**.
 *
 * ما تحت `platform/` عامٌّ يُقدَّم لأيّ زائر. وما تحت `users-files/` وثيقةٌ
 * تخصّ صاحبها — إثباتُ نقل ملكيّةٍ أو ما يشبهه — فلا تُقدَّم إلّا لصاحبها
 * أو للإدارة، ولا يُعرف صاحبُها إلّا من المفتاح نفسه.
 *
 * وهذا المسار هو **الوحيد** الذي يبلغ البادئة الخاصّة: مفاتيحها لا تُكتب في
 * صفحة، ولا يُشتقّ لها رابطٌ من CDN، ولا تُذكر في حمولةٍ عامّة.
 *
 * **وكلُّ بايتٍ يمرّ بهذا المسار** — العامُّ والخاصّ. وهو ثمنُ التخزين على
 * قرص الخادم: لا CDN يقدّم عنه، فوصلةُ كلّ مشاهدٍ وصلةٌ عليه.
 */
export async function GET(_request: Request, context: { params: Promise<{ key: string[] }> }) {
  const { key: segments } = await context.params
  const key = segments.join('/')

  if (!isSafeKey(key)) return new Response('غير موجود', { status: 404 })

  if (!isPublicKey(key)) {
    const owner = ownerOfKey(key)
    if (!owner) return new Response('غير موجود', { status: 404 })

    /*
     * الإدارة أوّلًا ثمّ الصاحب — والرفض **404 لا 403**.
     *
     * و403 تقول «هذا موجودٌ ولستَ أهله»، فتُثبت وجود ملفٍّ لمن يجسّ
     * المفاتيح. و404 لا تقول شيئًا.
     */
    const admin = await getCurrentAdmin()
    if (!admin) {
      const user = await getCurrentUser()
      if (!user || user.id !== owner) return new Response('غير موجود', { status: 404 })
    }
  }

  const media = getMedia()


  const file = await media.read(key)
  if (!file) return new Response('غير موجود', { status: 404 })

  return new Response(file.bytes as unknown as BodyInit, {
    headers: {
      'content-type': file.contentType || contentTypeOf(key),
      /*
       * المفتاح فيه معرّفٌ عشوائيّ لا يُعاد، فالعامّ يُخزَّن طويلًا: تبديلُ
       * الصورة يعني مفتاحًا جديدًا. والخاصُّ لا يُخزَّن في وسيطٍ مشترك.
       */
      'cache-control': isPublicKey(key)
        ? 'public, max-age=31536000, immutable'
        : 'private, no-store',
      /* ملفٌّ رُفع لا يُفسَّر: `nosniff` مع تطابق النوع المقيس عند الرفع */
      'x-content-type-options': 'nosniff',
      'content-disposition': 'inline',
    },
  })
}
