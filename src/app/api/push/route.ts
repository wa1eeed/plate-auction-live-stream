import { z } from 'zod'
import { handleError, ok, readJson } from '@/lib/server/api'
import { requireUserId } from '@/lib/server/require-user'
import { pushConfigured, pushPublicKey } from '@/lib/server/push-service'
import { getStore } from '@/lib/store'

export const dynamic = 'force-dynamic'

/**
 * حال الدفع ومفتاحه العامّ.
 *
 * تُقرأ قبل عرض الزرّ: نسخةٌ بلا مفاتيح في بيئتها لا دفعَ فيها، فيُقال ذلك بدل
 * زرٍّ يُضغط فلا يقع شيء.
 */
export async function GET() {
  return ok(
    { enabled: pushConfigured(), publicKey: pushPublicKey() },
    { headers: { 'cache-control': 'no-store' } },
  )
}

/*
 * ما يُقبل من الجسم: عنوان الجهاز ومفتاحاه ولا شيء غير ذلك.
 *
 * والعنوان يجب أن يكون رابطًا: خادم الدفع عنوانه من صانع المتصفّح، وقبولُ نصٍّ
 * حرٍّ يعني تخزين ما يُملى علينا.
 */
const subscribeSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(300),
    auth: z.string().min(1).max(300),
  }),
})

/** يسجّل جهاز صاحب الجلسة — ويُعاد إرساله في كلّ فتح فيُحدَّث لا يتكرّر. */
export async function POST(request: Request) {
  try {
    const userId = await requireUserId()
    const input = subscribeSchema.parse(await readJson(request))
    await getStore().savePushSubscription({
      userId,
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
    })
    return ok({ saved: true })
  } catch (error) {
    return handleError(error)
  }
}

const unsubscribeSchema = z.object({ endpoint: z.string().url().max(1000) })

/**
 * يحذف جهازًا.
 *
 * ويشترط جلسةً وإن كان العنوان يكفي للحذف: بلا ذلك يستطيع من عرف عنوان جهازٍ
 * أن يُسكت إشعاراته. وحذفُ عنوانٍ ليس لصاحب الجلسة لا يقع.
 */
export async function DELETE(request: Request) {
  try {
    const userId = await requireUserId()
    const { endpoint } = unsubscribeSchema.parse(await readJson(request))
    const mine = await getStore().listPushSubscriptions(userId)
    if (!mine.some((row) => row.endpoint === endpoint)) return ok({ removed: false })
    return ok({ removed: await getStore().deletePushSubscription(endpoint) })
  } catch (error) {
    return handleError(error)
  }
}
