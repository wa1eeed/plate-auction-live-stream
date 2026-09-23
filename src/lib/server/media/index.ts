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

/**
 * مجلَّد القرص — **على الحجم الدائم إن وُجد**.
 *
 * و`.data/media` نسبيٌّ داخل الحاوية، والحاوية تُستبدل مع كلّ نشرة. وصفوفُ
 * البنرات في القاعدة تبقى، فيبقى الصفُّ يشير إلى ملفٍّ لم يعد موجودًا —
 * **بنرٌ بصورةٍ مكسورة بلا رسالةِ خطأ واحدة**، ولا يُكتشف إلّا بعد النشر.
 *
 * و`PLATFORM_DATA_DIR` يضبطه `Dockerfile` على `/app/data` وهو المسار الذي
 * يُربط بحجمٍ دائم في كوليفاي. فما دام موجودًا فالوسائط تحته.
 */
function diskRoot(): string {
  const explicit = process.env.MEDIA_DIR?.trim()
  if (explicit) return explicit
  const persistent = process.env.PLATFORM_DATA_DIR?.trim()
  return persistent ? `${persistent.replace(/\/+$/, '')}/media` : '.data/media'
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
    : diskDriver(diskRoot())

  return cached
}

/** للفحص وحده — يُقاس المجلَّد المختار بلا كتابةٍ على القرص. */
export const diskRootForTests = diskRoot

/** للفحص وحده — يُنسى المحرّك فيُعاد بناؤه على بيئةٍ جديدة. */
export function resetMediaForTests(): void {
  cached = null
}
