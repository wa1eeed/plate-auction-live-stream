import type { MetadataRoute } from 'next'
import { appUrl } from '@/lib/config'

/** السوق قابل للفهرسة، وصفحات الحساب والمصادقة خارج محركات البحث. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/market', '/how-it-works'],
        disallow: ['/account', '/api', '/login', '/register'],
      },
    ],
    sitemap: `${appUrl()}/sitemap.xml`,
  }
}
