import { handleError, ok } from '@/lib/server/api'
import { listPublicFaq } from '@/lib/server/admin-service'

export const dynamic = 'force-dynamic'

/** الأسئلة المنشورة — عامة بلا مصادقة. */
export async function GET(request: Request) {
  try {
    const onListingOnly = new URL(request.url).searchParams.get('scope') === 'listing'
    return ok({ items: await listPublicFaq(onListingOnly) }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    return handleError(error)
  }
}
