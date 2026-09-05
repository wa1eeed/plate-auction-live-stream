import { z } from 'zod'
import { fail, handleError, ok, readJson } from '@/lib/server/api'
import { requireAdminId } from '@/lib/server/require-admin'
import { getStore } from '@/lib/store'
import { BRAND_ASSET_LIMITS, type BrandAsset, type BrandAssetKind } from '@/lib/domain/types'

export const dynamic = 'force-dynamic'

/** ما تقبله المنصّة رفعًا — وما عداه يُرفض بلا محاولة تخمين. */
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/x-icon']

const assetSchema = z
  .object({
    data: z.string().min(1),
    mime: z.string().refine((value) => IMAGE_TYPES.includes(value), 'صيغة صورة غير مدعومة'),
    fileName: z.string().max(200).default('صورة'),
  })
  .nullable()

const hex = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'اللون بصيغة #RRGGBB')

const listOfUrls = z
  .array(z.string().trim().url('رابط غير صحيح'))
  .max(12)
  .default([])

const brandSchema = z.object({
  name: z.string().trim().min(2, 'اسم المنصّة مطلوب').max(80),
  shortName: z.string().trim().min(2, 'الاسم القصير مطلوب').max(40),
  brandDisplay: z.enum(['logoAndName', 'logoOnly', 'nameOnly']).default('logoAndName'),

  heroBadge: z.string().trim().max(80).default(''),
  heroTitle: z.string().trim().min(2).max(120),
  heroHighlight: z.string().trim().max(120).default(''),
  heroBody: z.string().trim().max(600).default(''),

  primaryColor: hex,
  logo: assetSchema.optional(),
  icon: assetSchema.optional(),
  ogImage: assetSchema.optional(),

  metaTitle: z.string().trim().min(2, 'عنوان الصفحة مطلوب').max(70, 'العنوان يزيد عن ٧٠ حرفًا فيُقصّ في نتائج البحث'),
  metaDescription: z
    .string()
    .trim()
    .min(20, 'الوصف قصير جدًّا')
    .max(160, 'الوصف يزيد عن ١٦٠ حرفًا فيُقصّ في نتائج البحث'),
  keywords: z.array(z.string().trim().min(1).max(40)).max(15).default([]),

  legalName: z.string().trim().max(120).default(''),
  sameAs: listOfUrls,
  geoRegion: z.string().trim().max(10).default(''),
  geoPlace: z.string().trim().max(80).default(''),
  googleSiteVerification: z.string().trim().max(120).default(''),
})

/** يقيس البايتات قبل الترميز — `base64` يزيد الحجم الثلث. */
function decodedBytes(base64: string): number {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.floor((base64.length * 3) / 4) - padding
}

export async function PATCH(request: Request) {
  try {
    const adminId = await requireAdminId()
    const input = brandSchema.parse(await readJson(request))
    const store = getStore()
    const before = await store.getBrandSettings()

    /*
     * الأصل الغائب من الحمولة يبقى كما هو، والصريح `null` يُزيله.
     *
     * الفرق مقصود: نموذجٌ يُحفظ بعد تعديل الاسم وحده لا يُرسل البايتات
     * مجدّدًا — ولو عُومل الغياب حذفًا لمحا كل حفظٍ شعارَ المنصّة.
     */
    const assets: Partial<Record<BrandAssetKind, BrandAsset | null>> = {}
    for (const kind of ['logo', 'icon', 'ogImage'] as const) {
      const value = input[kind]
      if (value === undefined) continue
      if (value === null) {
        assets[kind] = null
        continue
      }
      const bytes = decodedBytes(value.data)
      if (bytes > BRAND_ASSET_LIMITS[kind]) {
        return fail(
          `الملفّ ${Math.round(bytes / 1024)} كيلوبايت، والحدّ ${Math.round(BRAND_ASSET_LIMITS[kind] / 1024)}`,
          413,
          'ASSET_TOO_LARGE',
        )
      }
      assets[kind] = { ...value, bytes, updatedAt: new Date().toISOString() }
    }

    // الأصول الخام من الحمولة تُستبعد: ما يُكتب هو النسخ المقيسة أعلاه
    const { logo: _l, icon: _i, ogImage: _o, ...fields } = input
    const settings = await store.updateBrandSettings({
      ...fields,
      ...assets,
      updatedByAdminId: adminId,
    })

    await store.appendAudit({
      actorId: adminId,
      action: 'brand.settings',
      entityType: 'brand_settings',
      entityId: 'singleton',
      // البايتات لا تُكتب في السجلّ — يُسجَّل أنّ أصلًا تبدّل لا محتواه
      beforeData: { name: before.name, primaryColor: before.primaryColor },
      afterData: {
        name: settings.name,
        primaryColor: settings.primaryColor,
        assetsChanged: Object.keys(assets),
      },
    })

    return ok({ settings })
  } catch (error) {
    return handleError(error)
  }
}
