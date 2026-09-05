import { z } from 'zod'
import { handleError, ok, readJson } from '@/lib/server/api'
import { requireAdminId } from '@/lib/server/require-admin'
import { getStore } from '@/lib/store'
import { HOW_IT_WORKS_STEPS, TRUST_FEATURES } from '@/lib/domain/types'

export const dynamic = 'force-dynamic'

const heading = z.string().trim().min(2, 'العنوان مطلوب').max(120)
const body = z.string().trim().min(2, 'النصّ مطلوب').max(2_000)

const sectionSchema = z.object({ heading, body })

const docSchema = z.object({
  title: heading,
  intro: z.string().trim().max(400).default(''),
  published: z.boolean().default(true),
  sections: z.array(sectionSchema).min(1, 'أضف قسمًا واحدًا على الأقل').max(24),
})

const stepSchema = z.object({ title: heading, body })

/**
 * الخطوات والبطاقات عددها ثابت.
 *
 * لكلٍّ أيقونتها وموضعها في التصميم، فزيادةُ خطوةٍ من حقلٍ نصّي تترك بطاقةً
 * بلا أيقونة أو أيقونةً بلا بطاقة. والعدد يُفرض هنا لا في الواجهة وحدها:
 * الحمولة قد تصل من غيرها.
 */
const fixedSteps = (count: number) => z.array(stepSchema).length(count)

const pagesSchema = z.object({
  about: docSchema,
  terms: docSchema,
  howItWorks: z.object({
    title: heading,
    intro: z.string().trim().max(400).default(''),
    sellerTitle: heading,
    sellerSteps: fixedSteps(HOW_IT_WORKS_STEPS),
    buyerTitle: heading,
    buyerSteps: fixedSteps(HOW_IT_WORKS_STEPS),
    reserveTitle: heading,
    reserveBody: body,
    rulesTitle: heading,
    rules: z.array(z.string().trim().min(2).max(300)).min(1).max(20),
    settlementTitle: heading,
    settlementBody: body,
  }),
  trust: z.object({
    title: heading,
    body: z.string().trim().min(2).max(600),
    features: fixedSteps(TRUST_FEATURES),
  }),
})

export async function PATCH(request: Request) {
  try {
    const adminId = await requireAdminId()
    const input = pagesSchema.parse(await readJson(request))
    const store = getStore()
    const before = await store.getPageSettings()

    const settings = await store.updatePageSettings({ ...input, updatedByAdminId: adminId })

    await store.appendAudit({
      actorId: adminId,
      action: 'pages.settings',
      entityType: 'page_settings',
      entityId: 'singleton',
      // العناوين وحدها في السجلّ — المتن يطول ولا يُقرأ في جدول تدقيق
      beforeData: { about: before.about.title, terms: before.terms.title },
      afterData: {
        about: settings.about.title,
        terms: settings.terms.title,
        aboutPublished: settings.about.published,
        termsPublished: settings.terms.published,
      },
    })

    return ok({ settings })
  } catch (error) {
    return handleError(error)
  }
}
