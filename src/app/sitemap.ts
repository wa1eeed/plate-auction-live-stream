import type { MetadataRoute } from 'next'
import { appUrl } from '@/lib/config'
import { getMarketListings } from '@/lib/server/market-service'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = appUrl()
  const entries: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/market`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${base}/how-it-works`, changeFrequency: 'monthly', priority: 0.5 },
  ]

  try {
    for (const card of await getMarketListings()) {
      entries.push({
        url: `${base}/market/${card.id}`,
        changeFrequency: 'hourly',
        priority: 0.7,
      })
    }
  } catch {
    // خريطة الموقع لا يجب أن تُفشل الطلب
  }
  return entries
}
