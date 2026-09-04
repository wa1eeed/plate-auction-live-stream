import { ok } from '@/lib/server/api'
import { clearAdminSession } from '@/lib/server/admin-session'

export const dynamic = 'force-dynamic'

/** خروج الإدارة وحدها — جلسة المستخدم العادي تبقى كما هي. */
export async function POST() {
  await clearAdminSession()
  return ok({ success: true })
}
