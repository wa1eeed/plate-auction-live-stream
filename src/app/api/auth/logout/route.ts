import { ok } from '@/lib/server/api'
import { clearUserSession } from '@/lib/server/session'

export async function POST() {
  await clearUserSession()
  return ok({ success: true })
}
