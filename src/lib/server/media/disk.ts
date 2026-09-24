import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import { contentTypeOf, type MediaDriver } from './driver'
import { isSafeKey } from './keys'

/**
 * محرّك القرص — للتطوير والفحص، ولنشرةٍ صغيرةٍ لا حاوية لها بعد.
 *
 * ووجودُه ليس ترفًا: بلاه تحتاج المجموعةُ مفاتيحَ R2 لتمرّ، فلا تعمل على
 * جهازٍ جديد ولا في البوّابة إلّا بسرٍّ يُوزَّع. وبه تمرّ المجموعة كاملةً
 * بلا إعداد، ويبقى ما يُقاس هو المنطق نفسه لا الشبكة.
 *
 * **ولا يُقدَّم العامّ منه من نطاقٍ آخر** — بل من `/api/media/` في نفس
 * الأصل، فلا تحتاج سياسةُ المحتوى إلى مضيفٍ إضافيّ في التطوير.
 */
export function diskDriver(root: string): MediaDriver {
  const base = resolve(root)

  /*
   * التطبيعُ ثمّ الفحص — لا الفحصُ وحده.
   *
   * `isSafeKey` يردّ ما فيه `..`، وهذا الحارس الثاني يقيس الناتج: لو مرّ
   * يومًا مفتاحٌ يخرج من المجلَّد بصيغةٍ لم تُتوقَّع، لم تقع الكتابة خارجه.
   */
  const pathOf = (key: string): string => {
    if (!isSafeKey(key)) throw new Error('مفتاح غير صالح')
    const full = resolve(join(base, key))
    if (full !== base && !full.startsWith(base + sep)) throw new Error('مفتاح يخرج عن المجلَّد')
    return full
  }

  return {
    kind: 'disk',

    async put(key, bytes, _contentType) {
      const path = pathOf(key)
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, bytes)
    },

    async remove(key) {
      await rm(pathOf(key), { force: true })
    },

    async read(key) {
      try {
        const bytes = new Uint8Array(await readFile(pathOf(key)))
        return { bytes, contentType: contentTypeOf(key) }
      } catch {
        return null
      }
    },

    publicUrl(key) {
      if (!isSafeKey(key)) throw new Error('مفتاح غير صالح')
      return `/api/media/${key}`
    },

    /* يقدّمه المسار المحروس نفسه — فلا رابط موقَّت ولا إعادة توجيه */
    async signedUrl() {
      return null
    },

    /*
     * **لا رفعَ مباشرًا على القرص — و`null` هنا قرارٌ لا نقص.**
     *
     * لا مخزنَ خارجيًّا يُوقَّع له رابط، ومحاكاتُه بمسارٍ في التطبيق تعني
     * بابَ كتابةٍ ثانيًا يُحرَس على حدة — وبابان يُحرسان أسوأ من باب.
     * فيقرأ العميلُ `null` ويرجع إلى الرفع عبر الخادم كما كان.
     */
    async signedUpload() {
      return null
    },

    async head(key) {
      try {
        const info = await stat(pathOf(key))
        return { size: info.size, contentType: contentTypeOf(key) }
      } catch {
        return null
      }
    },

    async readRange(key, length) {
      /* القرص يقرأ الملفّ ثمّ يقتطع — والملفّات هنا للفحص لا للإنتاج */
      try {
        return new Uint8Array(await readFile(pathOf(key))).slice(0, length)
      } catch {
        return null
      }
    },

    async move(from, to) {
      const target = pathOf(to)
      await mkdir(dirname(target), { recursive: true })
      await rename(pathOf(from), target)
    },
  }
}
