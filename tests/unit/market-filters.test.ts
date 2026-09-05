import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MARKET_FILTERS,
  filterAndSortListings,
  type MarketFilters,
} from '@/lib/domain/market-filters'
import { buildReference } from '@/lib/domain/reference'
import { riyalsToHalalas } from '@/lib/domain/money'
import type { ListingCard, ListingStatus, PlateType, SaleType } from '@/lib/domain/types'

function card(
  id: string,
  overrides: {
    ar?: string
    en?: string
    numbers?: string
    plateType?: PlateType
    saleType?: SaleType
    status?: ListingStatus
    price?: number
    bids?: number
    remaining?: number
    createdAt?: string
  } = {},
): ListingCard {
  return {
    id,
    reference: buildReference('listing', 26, Number(id.replace(/\D/g, '')) || 1),
    plate: {
      plateType: overrides.plateType ?? 'private',
      plateFormat: 'long',
      arabicLetters: overrides.ar ?? 'أ',
      latinLetters: overrides.en ?? 'A',
      plateNumbers: overrides.numbers ?? '1',
      emblem: 'palm-swords-black',
      customEmblemUrl: null,
    },
    saleType: overrides.saleType ?? 'auction',
    status: overrides.status ?? 'active',
    displayPrice: riyalsToHalalas(overrides.price ?? 10_000),
    priceLabel: 'السعر',
    bidCount: overrides.bids ?? 0,
    offerCount: 0,
    endsAt: overrides.remaining ? new Date(Date.now() + overrides.remaining).toISOString() : null,
    remainingMs: overrides.remaining ?? 0,
    sellerName: 'بائع',
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
  }
}

const base: MarketFilters = DEFAULT_MARKET_FILTERS

const CARDS: ListingCard[] = [
  card('a', { ar: 'كطع', en: 'KTE', numbers: '4040', price: 26_500, bids: 3, remaining: 3_600_000, createdAt: '2026-01-04T00:00:00.000Z' }),
  card('b', { ar: 'رر', en: 'RR', numbers: '77', saleType: 'fixed', price: 45_000, createdAt: '2026-01-03T00:00:00.000Z' }),
  card('c', { ar: 'نقل', en: 'NGL', numbers: '5566', plateType: 'transport', saleType: 'offers', price: 9_000, createdAt: '2026-01-02T00:00:00.000Z' }),
  card('d', { ar: 'حد', en: 'JD', numbers: '9', plateType: 'motorcycle', status: 'sold', price: 6_500, createdAt: '2026-01-01T00:00:00.000Z' }),
]

describe('بحث السوق', () => {
  it('يجد اللوحة بالأرقام الغربية والعربية', () => {
    expect(filterAndSortListings(CARDS, { ...base, query: '4040' }).map((c) => c.id)).toEqual(['a'])
    expect(filterAndSortListings(CARDS, { ...base, query: '٤٠٤٠' }).map((c) => c.id)).toEqual(['a'])
  })

  it('يجد اللوحة بالحروف العربية أو اللاتينية', () => {
    expect(filterAndSortListings(CARDS, { ...base, query: 'كطع' }).map((c) => c.id)).toEqual(['a'])
    expect(filterAndSortListings(CARDS, { ...base, query: 'kte' }).map((c) => c.id)).toEqual(['a'])
  })

  it('لا يعيد شيئًا عند بحث بلا تطابق', () => {
    expect(filterAndSortListings(CARDS, { ...base, query: '9999' })).toHaveLength(0)
  })
})

describe('فلاتر السوق', () => {
  it('الافتراضي يعرض المتاح للتداول فقط', () => {
    expect(filterAndSortListings(CARDS, base).map((c) => c.id).sort()).toEqual(['a', 'b', 'c'])
  })

  it('يصفّي بطريقة البيع', () => {
    expect(filterAndSortListings(CARDS, { ...base, saleType: 'fixed' }).map((c) => c.id)).toEqual(['b'])
    expect(filterAndSortListings(CARDS, { ...base, saleType: 'offers' }).map((c) => c.id)).toEqual(['c'])
  })

  it('يصفّي بنوع اللوحة', () => {
    expect(
      filterAndSortListings(CARDS, { ...base, plateType: 'transport', availability: 'all' }).map((c) => c.id),
    ).toEqual(['c'])
  })

  it('يعرض المغلق عند طلبه', () => {
    expect(filterAndSortListings(CARDS, { ...base, availability: 'closed' }).map((c) => c.id)).toEqual(['d'])
    expect(filterAndSortListings(CARDS, { ...base, availability: 'all' })).toHaveLength(4)
  })
})

describe('فرز السوق', () => {
  it('يرتّب بالسعر صعودًا ونزولًا', () => {
    expect(
      filterAndSortListings(CARDS, { ...base, availability: 'all', sort: 'price_desc' })[0].id,
    ).toBe('b')
    expect(
      filterAndSortListings(CARDS, { ...base, availability: 'all', sort: 'price_asc' })[0].id,
    ).toBe('d')
  })

  it('يرتّب بعدد المزايدات', () => {
    expect(filterAndSortListings(CARDS, { ...base, sort: 'most_bids' })[0].id).toBe('a')
  })

  it('يقدّم ما ينتهي قريبًا', () => {
    expect(filterAndSortListings(CARDS, { ...base, sort: 'ending_soon' })[0].id).toBe('a')
  })

  it('الافتراضي هو الأحدث', () => {
    expect(filterAndSortListings(CARDS, base).map((c) => c.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('فلترة عدد الحروف والأرقام', () => {
  const plate = (ar: string, numbers: string) =>
    card(`${ar}-${numbers}`, { ar, en: 'X'.repeat(ar.length), numbers })

  const cards = [
    plate('ا', '1'),
    plate('اب', '12'),
    plate('ابح', '123'),
    plate('ابح', '1234'),
    plate('اب', '4040'),
  ]

  it('تصفّي حسب عدد الحروف', () => {
    const single = filterAndSortListings(cards, {
      ...DEFAULT_MARKET_FILTERS,
      availability: 'all',
      letterCount: 1,
    })
    expect(single).toHaveLength(1)
    expect(single[0].plate.arabicLetters).toBe('ا')

    const triple = filterAndSortListings(cards, {
      ...DEFAULT_MARKET_FILTERS,
      availability: 'all',
      letterCount: 3,
    })
    expect(triple).toHaveLength(2)
  })

  it('تصفّي حسب عدد الأرقام', () => {
    const four = filterAndSortListings(cards, {
      ...DEFAULT_MARKET_FILTERS,
      availability: 'all',
      digitCount: 4,
    })
    expect(four.map((c) => c.plate.plateNumbers)).toEqual(['1234', '4040'])
  })

  it('تتقاطع الفلترتان معًا', () => {
    const both = filterAndSortListings(cards, {
      ...DEFAULT_MARKET_FILTERS,
      availability: 'all',
      letterCount: 2,
      digitCount: 4,
    })
    expect(both).toHaveLength(1)
    expect(both[0].plate.arabicLetters).toBe('اب')
  })

  it('«الكل» لا تُسقط شيئًا', () => {
    expect(
      filterAndSortListings(cards, { ...DEFAULT_MARKET_FILTERS, availability: 'all' }),
    ).toHaveLength(cards.length)
  })
})

describe('البحث برقم الإعلان', () => {
  const cards = [
    card('lst_1', { ar: 'ابح', en: 'ABJ', numbers: '4040' }),
    card('lst_2', { ar: 'رر', en: 'RR', numbers: '12' }),
  ]

  const search = (query: string) =>
    filterAndSortListings(cards, { ...DEFAULT_MARKET_FILTERS, query }).map((c) => c.reference)

  it('«L26-00002» تجد الإعلان الثاني وحده', () => {
    expect(search('L26-00002')).toEqual(['L26-00002'])
  })

  it('تقبل الصيغة بلا شرطة وبأي حالة', () => {
    expect(search('l2600001')).toEqual(['L26-00001'])
  })

  it('أرقام بلا حرف نوع تبقى بحثًا في أرقام اللوحة', () => {
    // «4040» أرقام اللوحة الأولى، ولو فُسّرت رقمَ إعلان لما وُجد شيء
    expect(search('4040')).toEqual(['L26-00001'])
    expect(search('12')).toEqual(['L26-00002'])
  })

  it('رقم إعلان غير موجود يُرجع لا شيء', () => {
    expect(search('L26-00099')).toEqual([])
  })

  it('رقم من نوع آخر لا يطابق إعلانًا', () => {
    expect(search('U26-00001')).toEqual([])
  })
})
