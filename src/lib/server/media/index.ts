import type { MediaDriver } from './driver'
import { diskDriver } from './disk'
import { r2Driver } from './r2'

export * from './driver'
export * from './keys'
export * from './image'

/**
 * اختيار المحرّك — بالبيئة لا بالكود.
 *
 * ويُشتقّ من وجود المفاتيح لا من رايةٍ ثالثة تُنسى: من ضبط مفاتيح R2 أرادها،
 * ومن لم يضبطها يعمل على القرص. ورايةٌ منفصلة تعني حالةً رابعة — مفاتيحُ
 * مضبوطةٌ وراية مطفأة — لا معنى لها وتُربك من يقرأ.
 */
let cached: MediaDriver | null = null

export function mediaConfigured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_BUCKET &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY,
  )
}

/** النطاق العامّ المضبوط — تقرؤه سياسةُ المحتوى لتسمح به. */
export function mediaPublicOrigin(): string | null {
  const value = process.env.R2_PUBLIC_BASE_URL?.trim().replace(/\/+$/, '')
  if (!value) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

export function getMedia(): MediaDriver {
  if (cached) return cached

  cached = mediaConfigured()
    ? r2Driver({
        accountId: process.env.R2_ACCOUNT_ID!,
        bucket: process.env.R2_BUCKET!,
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
        publicBaseUrl: process.env.R2_PUBLIC_BASE_URL?.trim().replace(/\/+$/, '') || null,
      })
    : diskDriver(process.env.MEDIA_DIR?.trim() || '.data/media')

  return cached
}

/** للفحص وحده — يُنسى المحرّك فيُعاد بناؤه على بيئةٍ جديدة. */
export function resetMediaForTests(): void {
  cached = null
}
