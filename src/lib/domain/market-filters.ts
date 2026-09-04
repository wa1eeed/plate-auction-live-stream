import type { ListingCard, SaleType } from './types'
import { isClosedListing } from './types'
import { matchesReference, parseReference } from './reference'
import { normalizeArabicLetters, normalizePlateNumbers, toWesternDigits } from '@/lib/saudi-plate-mapping'

export type MarketAvailability = 'all' | 'open' | 'closed'
export type MarketSort = 'newest' | 'ending_soon' | 'price_desc' | 'price_asc' | 'most_bids'

/** عدد الحروف أو الأرقام — 'all' يعني بلا تقييد. */
export type CharCount = 'all' | 1 | 2 | 3 | 4

export type MarketFilters = {
  query: string
  saleType: SaleType | 'all'
  plateType: string
  /** أحادي/ثنائي/ثلاثي الحروف — من أهمّ ما يبحث به مقتنو اللوحات */
  letterCount: CharCount
  /** عدد أرقام اللوحة، من 1 إلى 4 */
  digitCount: CharCount
  availability: MarketAvailability
  sort: MarketSort
}

export const DEFAULT_MARKET_FILTERS: MarketFilters = {
  query: '',
  saleType: 'all',
  plateType: 'all',
  letterCount: 'all',
  digitCount: 'all',
  availability: 'open',
  sort: 'newest',
}

export const LETTER_COUNT_LABELS: Record<Exclude<CharCount, 'all' | 4>, string> = {
  1: 'أحادي الحروف',
  2: 'ثنائي الحروف',
  3: 'ثلاثي الحروف',
}

export const DIGIT_COUNT_LABELS: Record<Exclude<CharCount, 'all'>, string> = {
  1: 'رقم واحد',
  2: 'رقمان',
  3: 'ثلاثة أرقام',
  4: 'أربعة أرقام',
}

/**
 * عدد الحروف يُحسب على الحروف العربية لا اللاتينية.
 * الاثنان متساويان دائمًا بحكم التحقّق، لكن العربية هي الأصل على اللوحة.
 */
export function letterCountOf(card: ListingCard): number {
  return Array.from(card.plate.arabicLetters).length
}

export function digitCountOf(card: ListingCard): number {
  return card.plate.plateNumbers.length
}

/**
 * مطابقة البحث: تقبل الحروف عربية أو لاتينية والأرقام عربية أو غربية،
 * فيجد الزائر اللوحة سواء كتب «أ ب ح» أو «ABJ» أو «٤٠٤٠» أو «4040».
 *
 * و`L26-00043` تبحث في **رقم الإعلان** لا في أرقام اللوحة: حرف النوع يميّزها،
 * فيبقى `4040` وحده أرقامَ لوحةٍ يبحث عنها الزائر.
 */
function matchesQuery(card: ListingCard, rawQuery: string): boolean {
  const query = rawQuery.trim()
  if (!query) return true

  if (parseReference(query)) return matchesReference(card.reference, query)

  const digits = normalizePlateNumbers(toWesternDigits(query), 4)
  if (digits && card.plate.plateNumbers.includes(digits)) return true

  const asArabic = normalizeArabicLetters(query, 3)
  if (asArabic && card.plate.arabicLetters.includes(asArabic)) return true

  const plain = query.replace(/\s+/g, '').toLowerCase()
  return plain.length > 0 && card.plate.latinLetters.toLowerCase().includes(plain)
}

/** تصفية وفرز إعلانات السوق — منطق نقي يشاركه العميل والاختبارات. */
export function filterAndSortListings(cards: ListingCard[], filters: MarketFilters): ListingCard[] {
  const filtered = cards.filter((card) => {
    if (!matchesQuery(card, filters.query)) return false
    if (filters.saleType !== 'all' && card.saleType !== filters.saleType) return false
    if (filters.plateType !== 'all' && card.plate.plateType !== filters.plateType) return false
    if (filters.letterCount !== 'all' && letterCountOf(card) !== filters.letterCount) return false
    if (filters.digitCount !== 'all' && digitCountOf(card) !== filters.digitCount) return false
    if (filters.availability === 'open' && card.status !== 'active') return false
    if (filters.availability === 'closed' && !isClosedListing(card.status)) return false
    return true
  })

  const sorted = [...filtered]
  switch (filters.sort) {
    case 'price_desc':
      sorted.sort((a, b) => b.displayPrice - a.displayPrice)
      break
    case 'price_asc':
      sorted.sort((a, b) => a.displayPrice - b.displayPrice)
      break
    case 'most_bids':
      sorted.sort((a, b) => b.bidCount - a.bidCount || b.displayPrice - a.displayPrice)
      break
    case 'ending_soon':
      sorted.sort((a, b) => {
        const rank = (card: ListingCard) =>
          card.status === 'active' && card.endsAt ? 0 : card.status === 'active' ? 1 : 2
        if (rank(a) !== rank(b)) return rank(a) - rank(b)
        if (a.endsAt && b.endsAt) return a.remainingMs - b.remainingMs
        return b.createdAt.localeCompare(a.createdAt)
      })
      break
    default:
      sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
  return sorted
}
