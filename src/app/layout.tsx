import type { Metadata, Viewport } from 'next'
import { Tajawal } from 'next/font/google'
import { Toaster } from '@/components/ui/toaster'
import './globals.css'
import { StagingBanner } from '@/components/layout/staging-banner'
import { assetUrl, brandColorCss, getBrand } from '@/lib/server/brand-service'
import { jsonLdHtml, organizationJsonLd, websiteJsonLd } from '@/lib/server/structured-data'
import { appUrl } from '@/lib/config'

const tajawal = Tajawal({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '700', '800'],
  variable: '--font-tajawal',
  display: 'swap',
})

/**
 * الوصف والعنوان والصورة من اللوحة لا من الكود.
 *
 * كانت مكتوبةً هنا، فتغيير اسم المنصّة أو وصفها في نتائج البحث يحتاج نشرًا.
 * وهي أوّل ما يبدّله من ينصب نسخته.
 *
 * و`metadataBase` شرطٌ لا زينة: بدونه يُصدِّر Next روابط `og:image` نسبيّة،
 * وجالبُ بطاقة المشاركة في واتساب أو تويتر خادمٌ خارجيّ لا يعرف أصل الموقع —
 * فتصل البطاقة بلا صورة.
 */
export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrand()
  const og = assetUrl('ogImage', brand.ogImage)
  const icon = assetUrl('icon', brand.icon)

  return {
    metadataBase: new URL(appUrl()),
    title: { default: brand.metaTitle, template: `%s — ${brand.shortName}` },
    description: brand.metaDescription,
    keywords: brand.keywords.length > 0 ? brand.keywords : undefined,
    applicationName: brand.name,
    alternates: { canonical: '/' },
    icons: icon ? { icon: [{ url: icon }], apple: [{ url: icon }] } : undefined,
    verification: brand.googleSiteVerification
      ? { google: brand.googleSiteVerification }
      : undefined,
    openGraph: {
      type: 'website',
      siteName: brand.name,
      title: brand.metaTitle,
      description: brand.metaDescription,
      locale: 'ar_SA',
      url: '/',
      images: og ? [{ url: og, width: 1200, height: 630, alt: brand.name }] : undefined,
    },
    twitter: {
      card: og ? 'summary_large_image' : 'summary',
      title: brand.metaTitle,
      description: brand.metaDescription,
      images: og ? [og] : undefined,
    },
    other: {
      // تحديد الموقع لمحرّكات تقرؤه: أوسمة `geo` القديمة ما زالت تُقرأ
      ...(brand.geoRegion ? { 'geo.region': brand.geoRegion } : {}),
      ...(brand.geoPlace ? { 'geo.placename': brand.geoPlace } : {}),
    },
  }
}

export const viewport: Viewport = {
  // يطابق خلفية السمة الفاتحة التي تعمل بها كل صفحات المنصّة
  themeColor: '#f4f6fa',
  width: 'device-width',
  initialScale: 1,
  // لا `maximumScale`: منع التكبير يمنع قراءة الآيبان ورقم اللوحة ومبلغ السداد
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const brand = await getBrand()
  const colors = brandColorCss(brand.primaryColor)

  return (
    /*
      * السمة على الجذر لا على قشرة الصفحة.
      *
      * كانت `data-theme="light"` على عنصرٍ داخل `body`، والنوافذ المنبثقة
      * (الإشعارات، دُرج الجوال، القوائم، الحوارات) تُصيَّر في `body` **خارجه**
      * عبر Portal — فترث الرموز الداكنة الافتراضية وتظهر سوداء في منصّة فاتحة.
      * ورفعها إلى `html` يجعلها تشمل كل ما يُصيَّر في المستند.
      */
    <html
      lang="ar"
      dir="rtl"
      data-theme="light"
      className={tajawal.variable}
      suppressHydrationWarning
    >
      <head>
        {/*
          * لون المنصّة يُحقن في الوثيقة لا في ملفّ التنسيق.
          *
          * الملفّ يُبنى مرّة عند النشر واللون يتغيّر من اللوحة بعده، فلا سبيل
          * إلى كتابته فيه. ويُحقن هنا قبل أي رسم فلا تُرى وميضةٌ باللون
          * الافتراضي قبل أن يحلّ محلّه المختار.
          */}
        {colors && <style dangerouslySetInnerHTML={{ __html: colors }} />}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdHtml(organizationJsonLd(brand)) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdHtml(websiteJsonLd(brand)) }}
        />
      </head>
      <body className="min-h-dvh antialiased">
        {/* فوق كل شيء: تُقرأ قبل أن يظنّ الزائر أنّه في المنصّة الحقيقية */}
        <StagingBanner />
        {children}
        <Toaster />
      </body>
    </html>
  )
}
