import type { MediaDriver } from './driver'
import { diskDriver } from './disk'

export * from './driver'
export * from './keys'
export * from './image'

let cached: MediaDriver | null = null

/**
 * مجلَّد الوسائط — **على الحجم الدائم**.
 *
 * و`.data/media` نسبيٌّ داخل الحاوية، والحاوية تُستبدل مع كلّ نشرة. وصفوفُ
 * البنرات في القاعدة تبقى، فيبقى الصفُّ يشير إلى ملفٍّ لم يعد موجودًا —
 * **بنرٌ بصورةٍ مكسورة بلا رسالةِ خطأ واحدة**، ولا يُكتشف إلّا بعد النشر.
 *
 * و`PLATFORM_DATA_DIR` يضبطه `Dockerfile` على `/app/data`، وهو المسار الذي
 * **يجب** أن يُربط بحجمٍ دائم في كوليفاي. وبلا ذلك تضيع الوسائط كلُّها مع
 * أوّل نشرة — يحرسه `server.mjs` بفحصٍ عند الإقلاع.
 */
function diskRoot(): string {
  const explicit = process.env.MEDIA_DIR?.trim()
  if (explicit) return explicit
  const persistent = process.env.PLATFORM_DATA_DIR?.trim()
  return persistent ? `${persistent.replace(/\/+$/, '')}/media` : '.data/media'
}

export function getMedia(): MediaDriver {
  cached ??= diskDriver(diskRoot())
  return cached
}

/** للفحص وحده — يُقاس المجلَّد المختار بلا كتابةٍ على القرص. */
export const diskRootForTests = diskRoot

/** للفحص وحده — يُنسى المحرّك فيُعاد بناؤه على بيئةٍ جديدة. */
export function resetMediaForTests(): void {
  cached = null
}
