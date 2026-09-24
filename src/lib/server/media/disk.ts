import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import { contentTypeOf, type MediaDriver } from './driver'
import { isSafeKey } from './keys'

/**
 * محرّك القرص — **وهو المخزن كلُّه**.
 *
 * الملفّات تحت مجلَّدٍ واحد يُربط بحجمٍ دائم، وتُقدَّم من `/api/media/` في
 * نفس الأصل. فلا مضيفَ خارجيًّا في سياسة المحتوى، ولا سرَّ يُوزَّع لتمرّ
 * الفحوص، ولا بايتَ يُقرأ إلّا بعد أن يُفحص الإذن.
 *
 * والثمن صريح: كلُّ بايت فدّيو يمرّ بالخادم، ووصلةٌ طويلة لكلّ مشاهد.
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

  }
}
