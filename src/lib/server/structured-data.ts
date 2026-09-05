import { appUrl } from '@/lib/config'
import { absoluteAssetUrl } from './brand-service'
import type { BrandSettings, FaqItem } from '@/lib/domain/types'

/**
 * البيانات المنظَّمة — ما تقرؤه الآلة لا العين.
 *
 * ثلاث جهات تقرأ الصفحة اليوم ولكلٍّ حاجة:
 *
 *   · **محرّك البحث** يريد وصفًا وعنوانًا وصورة — وهي في `metadata`.
 *   · **محرّك الإجابة** (ما يجيب مباشرة بلا نقرة) يريد سؤالًا وجوابًا
 *     مفصولين: `FAQPage`. وبدونه يُقتبس نصُّ الصفحة مقطوعًا من سياقه أو
 *     لا يُقتبس أصلًا.
 *   · **المولِّد** يريد كيانًا يعرف حدوده: من هذه المنصّة، وأين، وبأي
 *     أسماء تُعرف في مواضع أخرى — `Organization` و`sameAs`.
 *
 * وكلّها JSON-LD في وسم `script`: لا تُغيّر ما يراه الزائر، ولا تُقرأ إلّا
 * ممّن يبحث عنها.
 */

const cleaned = <T extends Record<string, unknown>>(node: T): T =>
  Object.fromEntries(
    Object.entries(node).filter(([, v]) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)),
  ) as T

export function organizationJsonLd(brand: BrandSettings) {
  const base = appUrl()
  return cleaned({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${base}#organization`,
    name: brand.name,
    legalName: brand.legalName || undefined,
    url: base,
    logo: absoluteAssetUrl('logo', brand.logo) ?? undefined,
    image: absoluteAssetUrl('ogImage', brand.ogImage) ?? undefined,
    description: brand.metaDescription,
    sameAs: brand.sameAs,
    areaServed: brand.geoPlace || undefined,
    address: brand.geoPlace
      ? cleaned({
          '@type': 'PostalAddress',
          addressCountry: brand.geoRegion?.slice(0, 2) || undefined,
          addressRegion: brand.geoRegion || undefined,
          addressLocality: brand.geoPlace,
        })
      : undefined,
  })
}

/**
 * الموقع نفسه ككيان، ومعه فعل البحث.
 *
 * `SearchAction` يخبر المحرّك أنّ للموقع بحثًا داخليًّا وكيف يُستدعى، فيعرض
 * صندوق بحثٍ تحت النتيجة — ويتيح للمولِّد أن يقود سائله إلى نتيجة بعينها بدل
 * الصفحة الأولى.
 */
export function websiteJsonLd(brand: BrandSettings) {
  const base = appUrl()
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${base}#website`,
    name: brand.name,
    alternateName: brand.shortName,
    url: base,
    inLanguage: 'ar-SA',
    publisher: { '@id': `${base}#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${base}/market?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  }
}

/** الأسئلة الشائعة — ما تقتبسه محرّكات الإجابة حرفًا بحرف. */
export function faqJsonLd(items: FaqItem[]) {
  if (items.length === 0) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  }
}

/**
 * وسمٌ واحد يحمل الرسم.
 *
 * `JSON.stringify` لا `dangerouslySetInnerHTML` بنصٍّ مُركَّب: الحقول تأتي من
 * لوحة الإدارة، ووسمُ `script` لا يُهرَّب داخله شيء — فـ`</script>` في وصف
 * المنصّة يُغلق الوسم ويُخرج ما بعده إلى الصفحة. والاستبدال يقطع ذلك.
 */
export function jsonLdHtml(node: unknown): string {
  return JSON.stringify(node).replace(/</g, '\\u003c')
}
