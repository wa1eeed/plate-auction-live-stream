import { bannerInputSchema } from '@/lib/domain/schemas'
import { handleError, ok, readJson } from '@/lib/server/api'
import { requireAdminId } from '@/lib/server/require-admin'
import { deleteBanner, updateBanner } from '@/lib/server/home-media-service'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, context: Ctx) {
  try {
    const adminId = await requireAdminId()
    const { id } = await context.params
    /*
     * `.partial()` على المُنقَّى لا على الكائن — و`superRefine` يمنع ذلك.
     *
     * فيُقرأ الشكلُ الداخليّ ثمّ يُجزَّأ، ويبقى تحقّقُ كلّ حقلٍ على حاله.
     * وما يخصّ الترتيب الزمنيّ يُفحص في `updateBanner` على الصفّ المدموج.
     */
    const input = bannerInputSchema.innerType().partial().parse(await readJson(request))
    return ok({ item: await updateBanner(id, input, adminId) })
  } catch (error) {
    return handleError(error)
  }
}

export async function DELETE(_request: Request, context: Ctx) {
  try {
    const adminId = await requireAdminId()
    const { id } = await context.params
    await deleteBanner(id, adminId)
    return ok({ success: true })
  } catch (error) {
    return handleError(error)
  }
}
