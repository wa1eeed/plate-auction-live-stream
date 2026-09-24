import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { diskDriver } from '@/lib/server/media/disk'
import { getMedia, resetMediaForTests } from '@/lib/server/media'
import { platformKey, userFileKey } from '@/lib/server/media/keys'

describe('محرّك القرص', () => {
  let root = ''
  const driver = () => diskDriver(root)

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'media-'))
  })
  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('يكتب ثمّ يقرأ البايتات نفسها بنوعها من الامتداد', async () => {
    const key = platformKey('image/png')
    const bytes = new Uint8Array([1, 2, 3, 4, 5])

    await driver().put(key, bytes, 'image/png')
    const read = await driver().read(key)

    expect(read?.bytes).toEqual(bytes)
    expect(read?.contentType).toBe('image/png')
  })

  it('المفتاح يصير مسارًا تحت المجلَّد بتفرّعه', async () => {
    const key = userFileKey('usr_abc', 'application/pdf')
    await driver().put(key, new Uint8Array([9]), 'application/pdf')

    expect(existsSync(join(root, key))).toBe(true)
    expect(new Uint8Array(await readFile(join(root, key)))).toEqual(new Uint8Array([9]))
  })

  /*
   * **الحذفُ يرفع الملفّ من القرص فعلًا** — لا يعلّمه محذوفًا.
   *
   * وهو ما تعتمد عليه خدمةُ الرئيسية: حذفُ ستوري أو بنرٍ يمحو ملفَّه، وكذلك
   * استبدالُ الوسيطة. فلو بقي الملفُّ لتراكمت الأصولُ اليتيمة على الحجم
   * الدائم حتى يمتلئ — بلا صفٍّ في القاعدة يدلّ عليها.
   */
  it('الحذف يرفعه من القرص، وحذفُ ما ليس موجودًا لا يرمي', async () => {
    const key = platformKey('image/png')
    await driver().put(key, new Uint8Array([1]), 'image/png')
    expect(existsSync(join(root, key))).toBe(true)

    await driver().remove(key)

    expect(existsSync(join(root, key))).toBe(false)
    expect(await driver().read(key)).toBeNull()
    await expect(driver().remove(key)).resolves.toBeUndefined()
  })

  it('وما لم يُكتب يُقرأ `null` — لا يرمي ولا يُخترع', async () => {
    expect(await driver().read(platformKey('image/png'))).toBeNull()
  })

  it('ويُقدَّم من التطبيق لا من نطاقٍ آخر — فيُفحص الإذن قبل كلّ بايت', () => {
    const key = platformKey('image/png')
    expect(driver().publicUrl(key)).toBe(`/api/media/${key}`)
  })

  /*
   * **الحارس الذي يمنع الكتابة خارج المجلَّد.**
   *
   * ولو سقط لَكتب مفتاحٌ فيه `..` في أيّ موضعٍ من نظام الملفّات — وهو ما
   * يُصيب كلَّ محرّكٍ يبني مسارًا من مدخلٍ خارجيّ.
   */
  it('مفتاحٌ يخرج عن المجلَّد يُردّ في كلّ عملية', async () => {
    const escapes = ['../escaped.png', 'platform/../../escaped.png', '/etc/passwd']
    for (const bad of escapes) {
      await expect(driver().put(bad, new Uint8Array([1]), 'image/png'), bad).rejects.toThrow()
      await expect(driver().remove(bad), bad).rejects.toThrow()
      expect(() => driver().publicUrl(bad), bad).toThrow()
    }
    expect(existsSync(join(root, '..', 'escaped.png'))).toBe(false)
  })
})

describe('مجلَّد الوسائط', () => {
  const saved = { ...process.env }
  afterEach(() => {
    process.env = { ...saved }
    resetMediaForTests()
  })

  /*
   * **الفخُّ الذي لا يظهر إلّا بعد النشر.**
   *
   * `.data/media` نسبيٌّ داخل الحاوية، والحاوية تُستبدل مع كلّ نشرة. وصفُّ
   * البنر في القاعدة يبقى — فيشير إلى ملفٍّ لم يعد موجودًا، وتُعرض صورةٌ
   * مكسورة بلا رسالةِ خطأ واحدة.
   */
  it('يتبع الحجم الدائم حيث وُجد', async () => {
    const { diskRootForTests } = await import('@/lib/server/media/index')
    delete process.env.MEDIA_DIR
    process.env.PLATFORM_DATA_DIR = '/app/data'
    expect(diskRootForTests()).toBe('/app/data/media')

    /* وشرطةٌ زائدة في آخره لا تُنتج مسارًا بشرطتين */
    process.env.PLATFORM_DATA_DIR = '/app/data/'
    expect(diskRootForTests()).toBe('/app/data/media')

    /* وما ضُبط صراحةً يسبق كلَّ شيء */
    process.env.MEDIA_DIR = '/mnt/media'
    expect(diskRootForTests()).toBe('/mnt/media')

    /* وبلا حجمٍ دائم يبقى الافتراض المحلّيّ */
    delete process.env.MEDIA_DIR
    delete process.env.PLATFORM_DATA_DIR
    expect(diskRootForTests()).toBe('.data/media')
  })

  it('والمحرّك واحدٌ لا خيار فيه — قرصٌ دائمًا', () => {
    resetMediaForTests()
    expect(getMedia().kind).toBe('disk')
  })
})
