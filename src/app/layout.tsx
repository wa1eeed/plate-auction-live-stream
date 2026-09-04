import type { Metadata, Viewport } from 'next'
import { Tajawal } from 'next/font/google'
import { Toaster } from '@/components/ui/toaster'
import './globals.css'
import { StagingBanner } from '@/components/layout/staging-banner'

const tajawal = Tajawal({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '700', '800'],
  variable: '--font-tajawal',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'سوق تداول لوحات المركبات',
    template: '%s — سوق اللوحات',
  },
  description:
    'سوق ويب لتداول لوحات المركبات السعودية: اعرض لوحتك للبيع المباشر أو بمزاد أو استقبل العروض، وزايد على لوحات غيرك — بحساب واحد يبيع ويشتري.',
}

export const viewport: Viewport = {
  // يطابق خلفية السمة الفاتحة التي تعمل بها كل صفحات المنصّة
  themeColor: '#f4f6fa',
  width: 'device-width',
  initialScale: 1,
  // لا `maximumScale`: منع التكبير يمنع قراءة الآيبان ورقم اللوحة ومبلغ السداد
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
      <body className="min-h-dvh antialiased">
        {/* فوق كل شيء: تُقرأ قبل أن يظنّ الزائر أنّه في المنصّة الحقيقية */}
        <StagingBanner />
        {children}
        <Toaster />
      </body>
    </html>
  )
}
