import { z } from 'zod'
import { fail, handleError, ok, readJson } from '@/lib/server/api'
import { requireUserId } from '@/lib/server/require-user'
import { getStore } from '@/lib/store'
import { HANDLE_PATTERN, RESERVED_HANDLES } from '@/lib/domain/types'

export const dynamic = 'force-dynamic'

const schema = z.object({
  handle: z
    .string()
    .trim()
    .toLowerCase()
    .transform((value) => value.replace(/^@+/, ''))
    .refine((value) => value === '' || HANDLE_PATTERN.test(value), {
      message: 'حروف لاتينية صغيرة وأرقام وشرطة سفلية، من ٣ إلى ٣٠ خانة',
    })
    .refine((value) => !RESERVED_HANDLES.has(value), { message: 'هذا المعرّف محجوز' }),
  showcaseUsesHandle: z.boolean(),
})

export async function PATCH(request: Request) {
  try {
    const userId = await requireUserId()
    const input = schema.parse(await readJson(request))
    const store = getStore()

    const handle = input.handle || null

    if (handle) {
      // المعرّف في الرابط مباشرةً، فتكراره يجعل معرضين على عنوانٍ واحد
      const taken = await store.findUserByHandle(handle)
      if (taken && taken.id !== userId) return fail('المعرّف مأخوذ', 409, 'HANDLE_TAKEN')
    }

    /*
     * ولا يُعرَض معرّفٌ لا وجود له.
     *
     * من اختار «اعرض معرّفي» ثمّ محا المعرّف يبقى الخيار قائمًا على فراغ —
     * فيخرج المعرض بلا اسم. والخيار يتبع وجود ما يُعرض.
     */
    const user = await store.updateUser(userId, {
      handle,
      showcaseUsesHandle: handle ? input.showcaseUsesHandle : false,
    })

    return ok({
      handle: user.handle,
      showcaseUsesHandle: user.showcaseUsesHandle,
    })
  } catch (error) {
    return handleError(error)
  }
}
