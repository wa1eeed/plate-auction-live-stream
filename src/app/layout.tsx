import type { Metadata, Viewport } from 'next'
import { Tajawal } from 'next/font/google'
import { Suspense } from 'react'
import { Toaster } from '@/components/ui/toaster'
import './globals.css'
import { getCurrentUser } from '@/lib/server/require-user'
import { getStore } from '@/lib/store'
import { NativeShell } from '@/components/layout/native-shell'
import { RouteProgress } from '@/components/layout/route-progress'
import { BottomNav } from '@/components/layout/bottom-nav'
import { NetworkBanner } from '@/components/layout/network-banner'
import { PullToRefresh } from '@/components/layout/pull-to-refresh'
import { ServiceWorkerRegistrar } from '@/components/layout/service-worker'
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
    icons: {
      icon: icon ? [{ url: icon }] : [{ url: '/app-icon.svg', type: 'image/svg+xml' }],
      apple: icon ? [{ url: icon }] : [{ url: '/app-icon.svg' }],
    },
    /*
     * iOS لا يقرأ البيان في التثبيت.
     *
     * سفاري يبني أيقونة الشاشة الرئيسية واسمَها من هذه الوسوم وحدها، ويتجاهل
     * `manifest.json` فيهما. فبدونها يُثبَّت التطبيق باسم عنوان الصفحة الطويل
     * ولقطةٍ من الشاشة بدل الأيقونة.
     */
    appleWebApp: {
      capable: true,
      title: brand.shortName,
      statusBarStyle: 'default',
    },
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
      /*
       * الوسم المهجور يبقى — لأنّ الأجهزة تبقى.
       *
       * `appleWebApp.capable` يُخرج `mobile-web-app-capable` وحده، وهو ما
       * تقرؤه iOS 17 فما فوق. وما دونها لا يعرف إلّا القديم، فيُثبَّت التطبيق
       * عندها بشريط سفاري فوقه فلا يُقرأ تطبيقًا. وسطرٌ واحد يشمل الجهازين.
       */
      'apple-mobile-web-app-capable': 'yes',
    },
  }
}

export const viewport: Viewport = {
  // يطابق خلفية السمة الفاتحة التي تعمل بها كل صفحات المنصّة
  themeColor: '#f4f6fa',
  width: 'device-width',
  initialScale: 1,
  // لا `maximumScale`: منع التكبير يمنع قراءة الآيبان ورقم اللوحة ومبلغ السداد
  /*
   * الصفحة تمتدّ تحت الشقّ وشريط الإيماءات — و`env(safe-area-inset-*)` لا
   * تُعطي قيمةً إلّا معها.
   *
   * وبدونها يحجز النظام تلك المناطق بنفسه: تبقى القيم أصفارًا، ويظهر شريطٌ
   * أسود فوق الصفحة وتحتها — وهي أوّل ما يقول «هذا موقعٌ في نافذة».
   *
   * والويب لا يتأثّر: المتصفّح على الحاسوب لا مناطق آمنة عنده، والقيم صفر.
   */
  viewportFit: 'cover',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const brand = await getBrand()
  const colors = brandColorCss(brand.primaryColor)
  /*
   * قرارُ الإدارة في الصوت والاهتزاز — سمةٌ على الجذر لا خاصيّةٌ تُمرَّر.
   *
   * والتمرير يقتضي خيطًا من التخطيط إلى كلّ مكوّنٍ يُصدر تكّةً أو نبضة —
   * وهي متفرّقةٌ في الجرس وصندوق المزايدة والعدّاد. والسمةُ تُقرأ من أيّ
   * موضع، وهو المسلك نفسه الذي تُضبط به السمة اللونية.
   *
   * وهو **كابحٌ عامّ** لا بديلٌ عن تفضيل المستخدم: من أطفأ الصوت عن نفسه
   * يبقى مُطفأً، ومن أطفأته الإدارة لا يسمعه أحد.
   */
  const mobile = await getStore().getMobileSettings().catch(() => null)
  /* الملاحة السفلية تحتاج أن تعرف: غير المسجَّل لا محفظةَ له ولا لوحات */
  const sessionUser = await getCurrentUser().catch(() => null)

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
      {...(mobile?.soundsEnabled === false ? { 'data-sounds': 'off' } : {})}
      {...(mobile?.hapticsEnabled === false ? { 'data-haptics': 'off' } : {})}
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
        {/*
          * جوابُ الضغطة قبل أيّ شيء — والصمتُ هو ما يُقرأ «الزرّ لا يعمل».
          *
          * و`Suspense` شرطٌ لا زينة: المكوّن يقرأ `useSearchParams`، وبلا حدٍّ
          * حولَه يُخرج التصييرَ الساكن للصفحات كلّها إلى التصيير عند الطلب.
          */}
        <Suspense fallback={null}>
          <RouteProgress />
        </Suspense>
        {/* فوق كل شيء: تُقرأ قبل أن يظنّ الزائر أنّه في المنصّة الحقيقية */}
        <StagingBanner />
        {/*
          * وقبل المحتوى: الانقطاع يُعلَن ولا تُبدَّل الصفحة من تحت قارئها.
          * ويقع فوق الهيدر اللاصق فلا يزاحمه، ويحمل حشوة الشقّ بنفسه.
          */}
        <NetworkBanner />
        {children}
        {/*
          * الملاحة السفلية — للغلاف وحده، وبعد المحتوى.
          *
          * وموضعُها هنا لا في كلّ صفحة: هي ثابتةٌ خارج السياق، فتُركَّب مرّةً
          * وتبقى بين التنقّلات بلا إعادة تركيب — وهو ما يجعلها تبدو جزءًا من
          * التطبيق لا عنصرًا يُرسم مع كلّ شاشة.
          */}
        <PullToRefresh />
        <BottomNav signedIn={Boolean(sessionUser)} />
        <Toaster />
        <ServiceWorkerRegistrar />
        <NativeShell />
      </body>
    </html>
  )
}
