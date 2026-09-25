import type { MetadataRoute } from 'next'
import { getBrand } from '@/lib/server/brand-service'

/*
 * السجلّ مصدر الهويّة، فالبيان يُولَّد لا يُكتب.
 *
 * ملفٌّ ثابت في `public/` يعني اسمَ منصّةٍ ولونًا وأيقونةً مكتوبةً في الكود —
 * وهي أوّل ما يبدّله من ينصب نسخته، وقد صارت تُضبط من اللوحة. ولو بقي ثابتًا
 * لثبّت التطبيقُ المثبَّت على جوال المستخدم اسمًا غير الذي يقرؤه في الموقع.
 */
export const dynamic = 'force-dynamic'

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const brand = await getBrand()

  return {
    name: brand.name,
    short_name: brand.shortName,
    description: brand.metaDescription,
    /*
     * يفتح على السوق لا على الواجهة التسويقية.
     *
     * من ثبّت التطبيق قرأ ما تقوله الواجهة الأولى وانتهى؛ وما يفتحه بعد ذلك
     * يفتحه ليرى اللوحات المعروضة الآن.
     */
    start_url: '/market',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'ar',
    dir: 'rtl',
    // يطابق `themeColor` في التخطيط — لونان مختلفان يُنتجان وميضًا عند الإقلاع
    background_color: '#f4f6fa',
    theme_color: '#f4f6fa',
    categories: ['shopping', 'business'],
    icons: [
      /*
       * **المرفوعُ فافيكون، ولا يُثبَّت.**
       *
       * كان يُوضع هنا أوّلًا بحجّةِ أنّ نسخةً لم تُرفع لها هويّة لا تُثبَّت —
       * وهي حجّةٌ لا تقوم: `app-icon.png` في `public/` دائمًا. وأثرُه أنّ
       * حقلًا اسمُه «أيقونة التبويب (Favicon)» صار يحكم أيقونةَ الشاشة
       * الرئيسية، فيضع النظامُ قناعَه المستدير على صورةٍ لم تُعدّ له.
       *
       * والقياس: المرفوعة ٣٠١×٣٠١ وزواياها `rgb(237,246,244)`، وهذه ٥١٢×٥١٢
       * وزواياها `rgb(3,46,24)`. انظر `layout.tsx` لوجه الفرق بين العهدين.
       */
      { src: '/app-icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  }
}
