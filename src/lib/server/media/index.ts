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

const R2_KEYS = ['R2_ACCOUNT_ID', 'R2_BUCKET', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'] as const

const setOf = (name: string): boolean => Boolean(process.env[name]?.trim())

export function mediaConfigured(): boolean {
  return R2_KEYS.every(setOf)
}

/**
 * ضبطٌ ناقص يُرفض — ولا يُنزَل صامتًا إلى القرص.
 *
 * ومتغيّرٌ واحدٌ أُخطئ اسمُه (`R2_SECRET_KEY` بدل `R2_SECRET_ACCESS_KEY` مثلًا)
 * كان يعني أنّ `mediaConfigured()` تردّ `false`، فتسكن البنراتُ **قرصَ
 * الحاوية** بينما تحسبها الإدارةُ في R2. والحاوية تُستبدل مع كلّ نشرة — فتضيع
 * كلُّ صورةٍ رُفعت، وتبقى صفوفُها في القاعدة تشير إلى ما لم يعد موجودًا.
 *
 * وثلاثةٌ من أربعةٍ ليست نيّةً أحدٍ. فيُرمى **عند الاستعمال** لا عند الإقلاع:
 * الصفحاتُ تُعرض وتُقرأ، ويفشل الرفعُ وحده برسالةٍ تسمّي ما نقص.
 */
function assertNoPartialR2(): void {
  const missing = R2_KEYS.filter((key) => !setOf(key))
  if (missing.length === 0 || missing.length === R2_KEYS.length) return
  throw new Error(
    `ضبطُ R2 ناقص — ${missing.join(' و')} غيرُ مضبوطة. ` +
      'فاضبطها كلَّها ليُستعمل R2، أو أفرغها كلَّها ليُستعمل قرصُ الخادم — ' +
      'ولا يُنزَل إلى القرص صامتًا فتضيع الملفّات مع أوّل نشرة.',
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
  assertNoPartialR2()

  cached = mediaConfigured()
    ? r2Driver({
        accountId: process.env.R2_ACCOUNT_ID!,
        bucket: process.env.R2_BUCKET!,
        privateBucket: process.env.R2_PRIVATE_BUCKET?.trim() || null,
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
