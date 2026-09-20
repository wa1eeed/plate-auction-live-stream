import { z } from 'zod'
import { handleError, ok, readJson } from '@/lib/server/api'
import { requireAdminId } from '@/lib/server/require-admin'
import { countAudience, sendBroadcast } from '@/lib/server/broadcast-service'

export const dynamic = 'force-dynamic'

const audience = z.enum(['all', 'active_bidders', 'active_sellers', 'user'])

/** عدد من ستبلغهم الشريحة — يُقرأ قبل الإرسال فلا يُبَثّ في العمياء. */
export async function GET(request: Request) {
  try {
    await requireAdminId()
    const params = new URL(request.url).searchParams
    const parsed = audience.safeParse(params.get('audience'))
    if (!parsed.success) return ok({ count: 0 })
    return ok({
      count: await countAudience(parsed.data, params.get('reference')).catch(() => 0),
    })
  } catch (error) {
    return handleError(error)
  }
}

/*
 * حدودُ النصّ ليست تحكّمًا: الإشعار يُقرأ على شاشةٍ مقفلة بسطرٍ ونصف، وما زاد
 * يُقصّ في منتصف كلمة. والوجهة تُفحص في الخدمة — مسارٌ داخليّ وحده.
 */
const schema = z.object({
  title: z.string().trim().min(2).max(60),
  body: z.string().trim().min(2).max(200),
  href: z.string().trim().max(200).nullish(),
  audience,
  reference: z.string().trim().max(40).nullish(),
})

export async function POST(request: Request) {
  try {
    const adminId = await requireAdminId()
    const input = schema.parse(await readJson(request))
    const result = await sendBroadcast({ ...input, href: input.href ?? null, adminId })
    return ok(result)
  } catch (error) {
    return handleError(error)
  }
}
