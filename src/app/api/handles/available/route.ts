import { HANDLE_PATTERN, RESERVED_HANDLES } from '@/lib/domain/types'
import { getStore } from '@/lib/store'

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

  const taken = await getStore().findUserByHandle(handle)
  return Response.json(
    taken ? { available: false, reason: 'مأخوذ — جرّب غيره' } : { available: true, handle },
  )
}
