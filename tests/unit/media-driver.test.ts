import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { diskDriver } from '@/lib/server/media/disk'
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

  it('الحذف يرفعه، وحذفُ ما ليس موجودًا لا يرمي', async () => {
    const key = platformKey('image/png')
    await driver().put(key, new Uint8Array([1]), 'image/png')
    await driver().remove(key)

    expect(await driver().read(key)).toBeNull()
    await expect(driver().remove(key)).resolves.toBeUndefined()
  })

  it('وما لم يُكتب يُقرأ `null` — لا يرمي ولا يُخترع', async () => {
    expect(await driver().read(platformKey('image/png'))).toBeNull()
  })

  it('العامّ يُقدَّم من نفس الأصل — فلا تحتاج سياسةُ المحتوى مضيفًا في التطوير', () => {
    const key = platformKey('image/png')
    expect(driver().publicUrl(key)).toBe(`/api/media/${key}`)
  })

  it('ولا رابطَ موقَّت — المسار المحروس يبثّ بنفسه', async () => {
    expect(await driver().signedUrl(userFileKey('usr_1', 'application/pdf'), 300)).toBeNull()
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
    // ولم يُكتب شيءٌ خارج المجلَّد
    expect(existsSync(join(root, '..', 'escaped.png'))).toBe(false)
  })
})
