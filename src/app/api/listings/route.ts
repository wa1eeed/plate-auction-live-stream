import { listingInputSchema } from '@/lib/domain/schemas'
import { riyalsToHalalas } from '@/lib/domain/money'
import { normalizeArabicLetters, normalizePlateNumbers } from '@/lib/saudi-plate-mapping'
import { PLATE_TYPE_MAX_LETTERS, type PlateEmblem } from '@/lib/domain/types'
import { handleError, ok, readJson } from '@/lib/server/api'
import { getMarketListings } from '@/lib/server/market-service'
import { requireUserId } from '@/lib/server/require-user'
import { getStore } from '@/lib/store'
import { computeDeposit } from '@/lib/domain/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // وقت الخادم يرافق البطاقات ليكون عدّادها حيًّا ومرجعه الخادم لا جهاز الزائر
    return ok(
      { listings: await getMarketListings(), serverTime: new Date().toISOString() },
      { headers: { 'cache-control': 'no-store' } },
    )
  } catch (error) {
    return handleError(error)
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId()
    const input = listingInputSchema.parse(await readJson(request))
    const governance = await getStore().getAuctionSettings()
    const maxLetters = PLATE_TYPE_MAX_LETTERS[input.plateType]

    const listing = await getStore().createListing({
      sellerId: userId,
      plateType: input.plateType,
      arabicLetters: normalizeArabicLetters(input.arabicLetters, maxLetters),
      latinLetters: input.latinLetters.toUpperCase(),
      plateNumbers: normalizePlateNumbers(input.plateNumbers, 4),
      emblem: input.emblem as PlateEmblem,
      customEmblemUrl: input.customEmblemUrl ?? null,
      description: input.description ?? null,
      saleType: input.saleType,
      status: 'draft',
      price: riyalsToHalalas(input.price),
      startingPrice: riyalsToHalalas(input.startingPrice),
      minimumIncrement: riyalsToHalalas(input.minimumIncrement),
      reservePrice: riyalsToHalalas(input.reservePrice),
      minimumOffer: riyalsToHalalas(input.minimumOffer),
      durationSeconds: input.durationSeconds,
      // قواعد الحوكمة تُطبَّق من الإعدادات المركزية لا من إدخال البائع
      extensionTriggerSeconds: governance.extensionTriggerSeconds,
      extensionDurationSeconds: governance.extensionDurationSeconds,
      extensionResetsTimer: governance.extensionResetsTimer,
      allowCustomBid: governance.allowCustomBid,
      depositAmount: computeDeposit(governance, riyalsToHalalas(input.startingPrice)),
      paymentWindowHours: governance.paymentWindowHours,
      forfeitPercent: governance.forfeitPercent,
      // لقطة قواعد الضمان وقت النشر — لا تتغيّر بتغيّر الإعدادات لاحقًا
      escrowTransferWindowHours: governance.escrowTransferWindowHours,
      escrowReviewWindowHours: governance.escrowReviewWindowHours,
      escrowDisputeWindowHours: governance.escrowDisputeWindowHours,
      escrowReleaseUndoWindowHours: governance.escrowReleaseUndoWindowHours,
      forfeitUndoWindowHours: governance.forfeitUndoWindowHours,
      refundDepositOnLoss: true,
      startsAt: null,
      endsAt: null,
      endedAt: null,
      highestBidId: null,
      soldToUserId: null,
      soldAmount: 0,
      viewCount: 0,
    })
    return ok({ listing })
  } catch (error) {
    return handleError(error)
  }
}
