import { auctionSettingsSchema } from '@/lib/domain/schemas'
import { riyalsToHalalas } from '@/lib/domain/money'
import { handleError, ok, readJson } from '@/lib/server/api'
import { requireAdminId } from '@/lib/server/require-admin'
import { getStore } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await requireAdminId()
    return ok({ settings: await getStore().getAuctionSettings() })
  } catch (error) {
    return handleError(error)
  }
}

/** قواعد الحوكمة الموحّدة — تُطبَّق على كل مزاد يُنشر بعدها. */
export async function PATCH(request: Request) {
  try {
    const adminId = await requireAdminId()
    const input = auctionSettingsSchema.parse(await readJson(request))
    const store = getStore()
    const before = await store.getAuctionSettings()

    const settings = await store.updateAuctionSettings({
      depositMode: input.depositMode,
      depositFixed: riyalsToHalalas(input.depositFixed),
      depositPercent: input.depositPercent,
      depositMin: riyalsToHalalas(input.depositMin),
      depositMax: riyalsToHalalas(input.depositMax),
      paymentWindowHours: input.paymentWindowHours,
      forfeitPercent: input.forfeitPercent,
      forfeitUndoWindowHours: input.forfeitUndoWindowHours,
      escrowTransferWindowHours: input.escrowTransferWindowHours,
      escrowReviewWindowHours: input.escrowReviewWindowHours,
      extensionTriggerSeconds: input.extensionTriggerSeconds,
      extensionDurationSeconds: input.extensionDurationSeconds,
      extensionResetsTimer: input.extensionResetsTimer,
      allowCustomBid: input.allowCustomBid,
      updatedByAdminId: adminId,
    })

    await store.appendAudit({
      actorId: adminId,
      action: 'auction.settings',
      entityType: 'auction_settings',
      entityId: 'singleton',
      beforeData: {
        depositMode: before.depositMode,
        depositPercent: before.depositPercent,
        paymentWindowHours: before.paymentWindowHours,
        forfeitPercent: before.forfeitPercent,
        escrowTransferWindowHours: before.escrowTransferWindowHours,
        escrowReviewWindowHours: before.escrowReviewWindowHours,
      },
      afterData: {
        depositMode: settings.depositMode,
        depositPercent: settings.depositPercent,
        paymentWindowHours: settings.paymentWindowHours,
        forfeitPercent: settings.forfeitPercent,
        escrowTransferWindowHours: settings.escrowTransferWindowHours,
        escrowReviewWindowHours: settings.escrowReviewWindowHours,
      },
    })
    return ok({ settings })
  } catch (error) {
    return handleError(error)
  }
}
