import { taxSettingsSchema } from '@/lib/domain/schemas'
import { handleError, ok, readJson } from '@/lib/server/api'
import { requireAdminId } from '@/lib/server/require-admin'
import { getStore } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await requireAdminId()
    return ok({ settings: await getStore().getTaxSettings() })
  } catch (error) {
    return handleError(error)
  }
}

/** بيانات المنشأة الضريبية — تُنسخ في كل فاتورة تُصدَر بعد الحفظ. */
export async function PATCH(request: Request) {
  try {
    const adminId = await requireAdminId()
    const input = taxSettingsSchema.parse(await readJson(request))
    const store = getStore()
    const before = await store.getTaxSettings()

    const settings = await store.updateTaxSettings({ ...input, updatedByAdminId: adminId })

    await store.appendAudit({
      actorId: adminId,
      action: 'tax.settings',
      entityType: 'tax_settings',
      entityId: 'singleton',
      // الرقم الضريبي رقم منشأة معلن لا سرّ — وتغيّره أهمّ ما يُدقَّق هنا
      beforeData: { enabled: before.enabled, vatNumber: before.vatNumber },
      afterData: { enabled: settings.enabled, vatNumber: settings.vatNumber },
    })
    return ok({ settings })
  } catch (error) {
    return handleError(error)
  }
}
