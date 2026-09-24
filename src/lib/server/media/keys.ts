import { newId } from '@/lib/server/crypto'

/**
 * تخطيط المفاتيح في R2 — بادئتان لا واحدة.
 *
 * ```
 * platform/images/<id>.<ext>     ← عامٌّ: البنرات والستوريز وأصول المنصّة
 * platform/videos/<id>.<ext>     ← عامّ
 * platform/files/<id>.<ext>      ← عامّ
 * users-files/<userId>/<id>.<ext> ← خاصٌّ: إثبات نقل الملكيّة وما يشبهه
 * ```
 *
 * **والفصل ليس ترتيبًا بل صلاحية.** البنر يُراد له أن يُرى، وإثباتُ ملكيّةٍ
 * وثيقةٌ تخصّ صاحبها — فلو سكنا نطاقًا عامًّا واحدًا صار رابطُ الوثيقة مفتوحًا
 * لمن بلغه. فما تحت `platform/` يُقدَّم من نطاق CDN بلا سؤال، وما تحت
 * `users-files/` لا يُقدَّم إلّا من مسارٍ في التطبيق يتحقّق من الجلسة أوّلًا.
 *
 * وملفّات المستخدمين **تحت بادئةٍ واحدة** لا في جذر الحاوية لكلٍّ مجلَّد:
 * قاعدةُ صلاحيةٍ واحدة وقاعدةُ دورة حياةٍ واحدة تغطّيهم جميعًا، ومسحُ ما
 * يخصّ مستخدمًا فحصُ بادئةٍ لا بحثٌ في الحاوية كلّها.
 */

export const PUBLIC_PREFIX = 'platform'
export const USER_FILES_PREFIX = 'users-files'


export const MEDIA_SCOPES = ['images', 'videos', 'files'] as const
export type MediaScope = (typeof MEDIA_SCOPES)[number]

/**
 * ما يُقبل رفعًا — قائمةُ سماحٍ لا قائمةَ منع.
 *
 * والامتداد يُشتقّ من النوع المعلن **بعد أن تُقرأ البايتات**، لا من اسم
 * الملفّ: اسمٌ ينتهي بـ`.jpg` وبداخله HTML يُقدَّم HTML إن صُدِّق اسمُه.
 */
export const ALLOWED_MEDIA = {
  'image/jpeg': { ext: 'jpg', scope: 'images' },
  'image/png': { ext: 'png', scope: 'images' },
  'image/webp': { ext: 'webp', scope: 'images' },
  'video/mp4': { ext: 'mp4', scope: 'videos' },
  /*
   * QuickTime — وهو ما يخرج من كاميرا الآيفون.
   *
   * وحاويتُه نفسُها حاويةُ MP4 (ISO BMFF) بصندوق `ftyp` في أوّلها، فالفحصُ
   * بالبايتات يقبلهما بلا تفريق. والفرقُ في **التشغيل** لا في القبول: انظر
   * تحذير `docs/media-storage.md`.
   */
  'video/quicktime': { ext: 'mov', scope: 'videos' },
  'application/pdf': { ext: 'pdf', scope: 'files' },
} as const satisfies Record<string, { ext: string; scope: MediaScope }>

export type AllowedMime = keyof typeof ALLOWED_MEDIA

export function isAllowedMime(value: string): value is AllowedMime {
  return value in ALLOWED_MEDIA
}

/** مفتاحٌ عامٌّ جديد تحت `platform/<scope>/`. */
export function platformKey(mime: AllowedMime): string {
  const { ext, scope } = ALLOWED_MEDIA[mime]
  return `${PUBLIC_PREFIX}/${scope}/${newId('m').slice(2)}.${ext}`
}

/** مفتاحٌ خاصٌّ جديد تحت `users-files/<userId>/`. */
export function userFileKey(userId: string, mime: AllowedMime): string {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(userId)) throw new Error('معرّف مستخدم غير صالح')
  const { ext } = ALLOWED_MEDIA[mime]
  return `${USER_FILES_PREFIX}/${userId}/${newId('f').slice(2)}.${ext}`
}

/**
 * هل يُقدَّم هذا المفتاح للعامّة؟
 *
 * والفحص على البادئة **بعد التطبيع**: `platform/../users-files/x` يبدأ
 * بـ`platform/` نصًّا وهو يشير إلى غيرها. فما فيه `..` أو `//` يُردّ.
 */
export function isPublicKey(key: string): boolean {
  return isSafeKey(key) && key.startsWith(`${PUBLIC_PREFIX}/`)
}

/** صاحبُ الملفّ الخاصّ، أو `null` إن لم يكن تحت بادئة المستخدمين. */
export function ownerOfKey(key: string): string | null {
  if (!isSafeKey(key)) return null
  const match = /^users-files\/([A-Za-z0-9_-]{1,64})\//.exec(key)
  return match?.[1] ?? null
}

/**
 * مفتاحٌ سليمٌ شكلًا — وهو حارسُ اجتياز المسار.
 *
 * محرّك القرص يكتب تحت مجلَّد، و`..` في المفتاح تُخرج الكتابة منه إلى أيّ
 * موضعٍ في نظام الملفّات. والحارس هنا لا عند الكتابة وحدها: المفتاح يمرّ
 * على الروابط والحذف والقراءة كذلك.
 */
export function isSafeKey(key: string): boolean {
  if (!key || key.length > 512) return false
  if (key.startsWith('/') || key.includes('..') || key.includes('//')) return false
  if (!/^[A-Za-z0-9/_.-]+$/.test(key)) return false
  return key.startsWith(`${PUBLIC_PREFIX}/`) || key.startsWith(`${USER_FILES_PREFIX}/`)
}
