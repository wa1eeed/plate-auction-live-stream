import { fail, handleError, ok } from '@/lib/server/api'
import { requireUserId } from '@/lib/server/require-user'
import { getStore } from '@/lib/store'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * **المتابعة** — يتابع الزائرُ إعلانًا أو يترك متابعته.
 *
 * **ولا يُتابَع ما لا يوجد**: معرّفٌ غيرُ معروفٍ يُردّ ٤٠٤ ولا يُكتب صفٌّ
 * يتيم. ومن تابع إعلانَه نفسَه لا يُمنَع — فالمنعُ هنا تضييقٌ بلا فائدة:
 * صاحبُ الإعلان يراه في «لوحاتي» أصلًا، ولا ضرر أن يرصده كذلك.
 *
 * والمتابعةُ لا تُخطر أحدًا ولا تُعرَض لصاحب الإعلان باسم صاحبها — يرى
 * عددًا لا أسماء.
 */
async function toggle(context: Ctx, on: boolean) {
  const userId = await requireUserId()
  const { id } = await context.params
  const store = getStore()

  if (!(await store.getListing(id))) {
    return fail('الإعلان غير موجود', 404, 'LISTING_NOT_FOUND')
  }

  await store.setWatch(userId, id, on)
  return ok({ following: on })
}

/** يبدأ المتابعة — ومعادتُها لا تُنشئ صفًّا ثانيًا. */
export async function POST(_request: Request, context: Ctx) {
  try {
    return await toggle(context, true)
  } catch (error) {
    return handleError(error)
  }
}

/** يترك المتابعة — وتركُ ما لم يُتابَع لا يُخطئ. */
export async function DELETE(_request: Request, context: Ctx) {
  try {
    return await toggle(context, false)
  } catch (error) {
    return handleError(error)
  }
}
