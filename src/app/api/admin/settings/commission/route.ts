import { commissionSettingsSchema } from '@/lib/domain/schemas'
import { riyalsToHalalas } from '@/lib/domain/money'
import { handleError, ok, readJson } from '@/lib/server/api'
import { requireAdminId } from '@/lib/server/require-admin'
import { getStore } from '@/lib/store'
import type { CommissionSide } from '@/lib/domain/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await requireAdminId()
    return ok({ settings: await getStore().getCommissionSettings() })
  } catch (error) {
    return handleError(error)
  }
}

type SideInput = {
  enabled: boolean
  mode: 'percent' | 'fixed'
  percent: number
  fixed: number
  min: number
  max: number
}

/** الريالات تدخل من النموذج وتُخزَّن هللات — التحويل هنا لا في المكوّن. */
function toSide(input: SideInput): CommissionSide {
  return {
    enabled: input.enabled,
    mode: input.mode,
    percent: input.percent,
    fixed: riyalsToHalalas(input.fixed),
    min: riyalsToHalalas(input.min),
    max: riyalsToHalalas(input.max),
  }
}

/** عمولة المنصّة وضريبتها — تُحتسب على كل صفقة تكتمل بعد الحفظ. */
export async function PATCH(request: Request) {
  try {
    const adminId = await requireAdminId()
    const input = commissionSettingsSchema.parse(await readJson(request))
    const store = getStore()
    const before = await store.getCommissionSettings()

    const settings = await store.updateCommissionSettings({
      seller: toSide(input.seller),
      buyer: toSide(input.buyer),
      vatEnabled: input.vatEnabled,
      vatPercent: input.vatPercent,
      updatedByAdminId: adminId,
    })

    await store.appendAudit({
      actorId: adminId,
      action: 'commission.settings',
      entityType: 'commission_settings',
      entityId: 'singleton',
      beforeData: {
        seller: before.seller.enabled,
        buyer: before.buyer.enabled,
        vatEnabled: before.vatEnabled,
      },
      afterData: {
        seller: settings.seller.enabled,
        buyer: settings.buyer.enabled,
        vatEnabled: settings.vatEnabled,
      },
    })
    return ok({ settings })
  } catch (error) {
    return handleError(error)
  }
}
