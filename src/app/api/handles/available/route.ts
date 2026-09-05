import { HANDLE_PATTERN, RESERVED_HANDLES } from '@/lib/domain/types'
import { getStore } from '@/lib/store'
import { readUserSession } from '@/lib/server/session'

export const dynamic = 'force-dynamic'

/**
 * هل المعرّف متاح؟
 *
 * يُسأل والمستخدم يكتب، فيعرف قبل الإرسال لا بعد رفض النموذج. ولا يُعدّ كشفًا:
 * المعرّف يقع في رابطٍ علنيّ (`/@waleed`)، فمن أراد معرفة المأخوذ منه فتح
 * الرابط. وما يُرجع هنا نعم أو لا — لا اسمُ صاحبه ولا شيء عنه.
 */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('handle') ?? ''
  const handle = raw.trim().toLowerCase().replace(/^@+/, '')

  if (!HANDLE_PATTERN.test(handle)) {
    return Response.json({
      available: false,
      reason: 'حروف لاتينية صغيرة وأرقام وشرطة سفلية، من ٣ إلى ٣٠ خانة',
    })
  }
  if (RESERVED_HANDLES.has(handle)) {
    return Response.json({ available: false, reason: 'هذا المعرّف محجوز' })
  }

  /*
   * ومعرّفُك ليس مأخوذًا منك.
   *
   * الفحص كان يسأل «هل لهذا المعرّف صاحب؟» ولا يسأل «ومن يسأل؟» — فمن حجز
   * معرّفه ثمّ فتح إعدادات معرضه وجد حقله موسومًا «مأخوذ — جرّب غيره»،
   * يخبره أنّ ما يملكه ملكُ غيره. وحفظُ النموذج كان يمرّ (`showcase/route`
   * يستثني صاحبه)، فالخلل في الطمأنة لا في الحفظ — وهو أسوأ: يُرى ولا يُفسَّر.
   *
   * والجلسة تُقرأ ولا تُشترط: الحقل يُستعمل في التسجيل قبل أن تكون جلسة.
   */
  const [taken, session] = await Promise.all([
    getStore().findUserByHandle(handle),
    readUserSession(),
  ])
  if (taken && session && taken.id === session.userId) {
    return Response.json({ available: true, handle, reason: 'هذا معرّفك الحاليّ' })
  }
  return Response.json(
    taken ? { available: false, reason: 'مأخوذ — جرّب غيره' } : { available: true, handle },
  )
}
