import { getStore } from '@/lib/store'
import type { BrandAssetKind } from '@/lib/domain/types'

export const dynamic = 'force-dynamic'

const KIND: Record<string, BrandAssetKind> = {
  logo: 'logo',
  icon: 'icon',
  og: 'ogImage',
}

/**
 * يخدم أصول الهويّة من السجلّ.
 *
 * ولماذا مسارٌ بدل `data:` في الوسم؟ لأنّ `og:image` لا يقبل إلّا رابطًا
 * مطلقًا يجلبه خادمُ واتساب أو تويتر من الخارج — و`data:` لا يُجلب. والشعار
 * والأيقونة تمرّان من هنا كذلك ليكون للثلاثة مصدرٌ واحد.
 */
export async function GET(_request: Request, context: { params: Promise<{ kind: string }> }) {
  const { kind } = await context.params
  const key = KIND[kind]
  if (!key) return new Response('غير موجود', { status: 404 })

  const brand = await getStore().getBrandSettings()
  const asset = brand[key]
  if (!asset) return new Response('غير موجود', { status: 404 })

  return new Response(Buffer.from(asset.data, 'base64'), {
    headers: {
      'content-type': asset.mime,
      /*
       * تخزينٌ طويل مع إبطالٍ بالبصمة.
       *
       * الرابط يحمل `?v=<لحظة التحديث>`، فكل استبدالٍ يُنتج رابطًا جديدًا.
       * ولولا ذلك لبقي الشعار القديم في بطاقة المشاركة أشهرًا — تلك البطاقات
       * تُخزَّن عند المنصّات لا عند الزائر.
       */
      'cache-control': 'public, max-age=31536000, immutable',
    },
  })
}
