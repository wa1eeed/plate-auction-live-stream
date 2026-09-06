import type { MetadataRoute } from 'next'
import { assetUrl, getBrand } from '@/lib/server/brand-service'

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
  const icon = assetUrl('icon', brand.icon)

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
       * المرفوعة أوّلًا، والمرسومة تبقى خلفها لا بدلًا منها.
       *
       * التثبيت يشترط أيقونةً صالحة، فنسخةٌ لم يُرفع لها شعار لا تُثبَّت أصلًا
       * ولا يُقال لصاحبها لماذا. والمرفوعة قد تكون شفّافةً أو غير مربّعة،
       * فتُعلَن `any` وحدها؛ و`maskable` للمرسومة لأنّ حشوها معلوم.
       */
      ...(icon && brand.icon
        ? [{ src: icon, sizes: 'any', type: brand.icon.mime, purpose: 'any' as const }]
        : []),
      { src: '/app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  }
}
