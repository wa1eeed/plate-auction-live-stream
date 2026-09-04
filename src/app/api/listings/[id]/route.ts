import { z } from 'zod'
import { listingInputSchema } from '@/lib/domain/schemas'
import { riyalsToHalalas } from '@/lib/domain/money'
import { normalizeArabicLetters, normalizePlateNumbers } from '@/lib/saudi-plate-mapping'
import {
  PLATE_TYPE_MAX_LETTERS,
  canSellerRelist,
  isClosedListing,
  type PlateEmblem,
} from '@/lib/domain/types'
import { fail, handleError, ok, readJson } from '@/lib/server/api'
import {
  closeListing,
  getListingDetail,
  relistListing,
  requireOwnedListing,
  ServiceError,
} from '@/lib/server/market-service'
import { readUserSession } from '@/lib/server/session'
import { requireUserId } from '@/lib/server/require-user'
import { getStore } from '@/lib/store'
import { computeDeposit } from '@/lib/domain/types'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Ctx) {
  try {
    const { id } = await context.params
    const session = await readUserSession()
    return ok(await getListingDetail(id, session?.userId ?? null), {
      headers: { 'cache-control': 'no-store' },
    })
  } catch (error) {
    return handleError(error)
  }
}

export async function PATCH(request: Request, context: Ctx) {
  try {
    const { id } = await context.params
    const userId = await requireUserId()
    const store = getStore()
    const listing = await requireOwnedListing(store, id, userId)

    if (listing.status !== 'draft' && listing.status !== 'active') {
      return fail('لا يمكن تعديل إعلان مغلق', 409, 'LISTING_CLOSED')
    }
    const bids = await store.listBids(id)
    if (bids.some((bid) => bid.status === 'accepted')) {
      return fail('لا يمكن تعديل إعلان عليه مزايدات', 409, 'HAS_BIDS')
    }

    const input = listingInputSchema.parse(await readJson(request))
    const governance = await store.getAuctionSettings()
    const maxLetters = PLATE_TYPE_MAX_LETTERS[input.plateType]
    const updated = await store.updateListing(id, {
      plateType: input.plateType,
      arabicLetters: normalizeArabicLetters(input.arabicLetters, maxLetters),
      latinLetters: input.latinLetters.toUpperCase(),
      plateNumbers: normalizePlateNumbers(input.plateNumbers, 4),
      emblem: input.emblem as PlateEmblem,
      customEmblemUrl: input.customEmblemUrl ?? null,
      description: input.description ?? null,
      saleType: input.saleType,
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
      forfeitUndoWindowHours: governance.forfeitUndoWindowHours,
      refundDepositOnLoss: true,
    })
    return ok({ listing: updated })
  } catch (error) {
    return handleError(error)
  }
}

const actionSchema = z.object({ action: z.enum(['publish', 'cancel', 'relist']) })

/** نشر الإعلان أو إلغاؤه أو إعادة عرضه. */
export async function POST(request: Request, context: Ctx) {
  try {
    const { id } = await context.params
    const userId = await requireUserId()
    const store = getStore()
    const listing = await requireOwnedListing(store, id, userId)
    const { action } = actionSchema.parse(await readJson(request))
    const now = Date.now()

    if (action === 'cancel') {
      if (isClosedListing(listing.status)) return fail('الإعلان مغلق مسبقًا', 409, 'LISTING_CLOSED')
      // الإغلاق يفكّ العرابين: لا ضمان يبقى محجوزًا لمزاد لم يعد قائمًا
      const updated = await closeListing(store, id, 'cancelled', 'ألغى البائع عرض اللوحة')
      return ok({ listing: updated })
    }

    if (action === 'relist') {
      if (listing.status === 'suspended') {
        return fail(
          'الإعلان موقوف من الإدارة — لا تُرفع الإيقاف إلا هي',
          403,
          'LISTING_SUSPENDED',
        )
      }
      if (!canSellerRelist(listing.status)) {
        return fail('لا يمكن إعادة عرض هذا الإعلان', 409, 'LISTING_NOT_RELISTABLE')
      }
      const { listing: updated, invited } = await relistListing(store, listing)
      return ok({ listing: updated, invited })
    }

    // publish
    if (listing.status !== 'draft') return fail('الإعلان منشور مسبقًا', 409, 'ALREADY_PUBLISHED')
    const isAuction = listing.saleType === 'auction'
    const updated = await store.updateListing(id, {
      status: 'active',
      startsAt: isAuction ? new Date(now).toISOString() : null,
      endsAt: isAuction ? new Date(now + listing.durationSeconds * 1000).toISOString() : null,
    })
    await store.appendEvent({ listingId: id, eventType: 'listing_published', payload: {} })
    return ok({ listing: updated })
  } catch (error) {
    return handleError(error)
  }
}

export async function DELETE(_request: Request, context: Ctx) {
  try {
    const { id } = await context.params
    const userId = await requireUserId()
    const store = getStore()
    const listing = await requireOwnedListing(store, id, userId)

    const bids = await store.listBids(id)
    if (bids.length > 0) {
      throw new ServiceError('لا يمكن حذف إعلان عليه مزايدات — ألغِه بدلًا من ذلك', 409, 'HAS_BIDS')
    }
    if (listing.status === 'sold') {
      throw new ServiceError('لا يمكن حذف إعلان مُباع', 409, 'LISTING_SOLD')
    }
    // الحذف يمحو الدليل: إعلان موقوف لمخالفة لا يحذفه صاحبه
    if (listing.status === 'suspended') {
      throw new ServiceError(
        'الإعلان موقوف من الإدارة — لا يُحذف',
        403,
        'LISTING_SUSPENDED',
      )
    }
    await store.deleteListing(id)
    return ok({ success: true })
  } catch (error) {
    return handleError(error)
  }
}
