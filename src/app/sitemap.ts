import type { MetadataRoute } from 'next'
import { appUrl } from '@/lib/config'
import { getMarketListings } from '@/lib/server/market-service'
import { getStore } from '@/lib/store'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = appUrl()
  const entries: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/market`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${base}/how-it-works`, changeFrequency: 'monthly', priority: 0.5 },
  ]

  /*
   * المخفيّة لا تُدرَج.
   *
   * الخريطة دعوةٌ للزحف، وصفحةٌ تردّ 404 لمن دُعي إليها تُحسب خطأً على
   * الموقع لا على الزاحف.
   */
  try {
    const pages = await getStore().getPageSettings()
    for (const [path, doc] of [
      ['/about', pages.about],
      ['/terms', pages.terms],
    ] as const) {
      if (doc.published) {
        entries.push({ url: `${base}${path}`, changeFrequency: 'monthly', priority: 0.4 })
      }
    }
  } catch {
    // الخريطة لا يجب أن تُفشل الطلب
  }

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
