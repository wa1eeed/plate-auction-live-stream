import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BANNER_RATIO, bannerRatioError, isMp4, probeImage } from '@/lib/server/media/image'
import { isPublicKey, isSafeKey, ownerOfKey, platformKey, userFileKey } from '@/lib/server/media/keys'

/*
 * صورٌ مرمَّزةٌ فعلًا — لا رؤوسٌ صُنعت في الفحص.
 *
 * ورأسٌ يُبنى في الفحص يُقاس بما بُني به: يمرّ ولو كان القارئ يقرأ الحقل
 * الخطأ ما دام الفحص يكتبه في الموضع الخطأ نفسه. والملفّات هنا من `sips`
 * و`cwebp`، وفي الـJPEG قطعةُ EXIF يجب أن تُتخطّى — وهي بعينها ما يُسقط
 * القارئ الساذج الذي يقرأ المقاس من أوّل الملفّ.
 */
const fixture = (name: string) =>
  new Uint8Array(readFileSync(join(process.cwd(), 'tests/fixtures/media', name)))

describe('قياس الصورة من بايتاتها', () => {
  it('PNG — النوع والمقاس', () => {
    expect(probeImage(fixture('banner-2x1.png'))).toEqual({
      mime: 'image/png',
      width: 1200,
      height: 600,
    })
  })

  it('JPEG — يتخطّى EXIF ويبلغ إطار SOF', () => {
    expect(probeImage(fixture('banner-2x1.jpg'))).toEqual({
      mime: 'image/jpeg',
      width: 1200,
      height: 600,
    })
  })

  it('WebP بالفقد (VP8) وبلا فقد (VP8L) — كلاهما يُقرأ', () => {
    expect(probeImage(fixture('banner-2x1.webp'))).toEqual({
      mime: 'image/webp',
      width: 1200,
      height: 600,
    })
    expect(probeImage(fixture('banner-lossless.webp'))).toEqual({
      mime: 'image/webp',
      width: 1200,
      height: 600,
    })
  })

  it('ما ليس صورةً يُردّ `null` — ولا يُخمَّن له مقاس', () => {
    expect(probeImage(new TextEncoder().encode('<html>not an image</html>'))).toBeNull()
    expect(probeImage(new Uint8Array([0x89, 0x50]))).toBeNull()
    expect(probeImage(new Uint8Array(0))).toBeNull()
  })

  it('الاسم لا يُصدَّق — بايتاتُ HTML باسم صورةٍ تُردّ', () => {
    // ما يُرفع يُقاس ببايتاته: هذه تبدأ بـ`<` لا بتوقيع صورة
    const disguised = new TextEncoder().encode('<script>alert(1)</script>'.padEnd(64, ' '))
    expect(probeImage(disguised)).toBeNull()
  })

  it('MP4 يُعرف بصندوق `ftyp`', () => {
    const mp4 = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32])
    expect(isMp4(mp4)).toBe(true)
    expect(isMp4(fixture('banner-2x1.png'))).toBe(false)
  })
})

describe('نسبة البنر', () => {
  it('٢:١ تُقبل، والمربّع يُردّ برسالةٍ تقول النسبة المطلوبة', () => {
    expect(bannerRatioError(probeImage(fixture('banner-2x1.png'))!)).toBeNull()

    const error = bannerRatioError(probeImage(fixture('square.png'))!)
    expect(error).toContain('2:1')
    expect(error).toContain('1.00')
  })

  it('نطاقُ تسامحٍ لا مقاسٌ بالبكسل — 1080×540 و1200×628 تمرّان', () => {
    for (const [width, height] of [
      [1080, 540],
      [1200, 628],
      [1200, 600],
    ] as const) {
      expect(bannerRatioError({ mime: 'image/png', width, height })).toBeNull()
    }
  })

  it('وما خرج عن النطاق يُردّ — أعرضَ كان أو أطول', () => {
    expect(bannerRatioError({ mime: 'image/png', width: 1200, height: 400 })).toContain('نسبة')
    expect(bannerRatioError({ mime: 'image/png', width: 1200, height: 900 })).toContain('نسبة')
  })

  it('والصغيرُ يُردّ ولو صحّت نسبته — يهترئ على الشاشات الحادّة', () => {
    const error = bannerRatioError({ mime: 'image/png', width: 400, height: 200 })
    expect(error).toContain(String(BANNER_RATIO.minWidth))
  })
})

describe('تخطيط المفاتيح', () => {
  it('العامّ تحت `platform/<scope>/` بامتدادٍ من النوع لا من الاسم', () => {
    expect(platformKey('image/png')).toMatch(/^platform\/images\/[a-z0-9]+\.png$/)
    expect(platformKey('video/mp4')).toMatch(/^platform\/videos\/[a-z0-9]+\.mp4$/)
    expect(platformKey('application/pdf')).toMatch(/^platform\/files\/[a-z0-9]+\.pdf$/)
  })

  it('والخاصّ تحت `users-files/<userId>/` — وصاحبُه يُقرأ منه', () => {
    const key = userFileKey('usr_abc123', 'application/pdf')
    expect(key).toMatch(/^users-files\/usr_abc123\/[a-z0-9]+\.pdf$/)
    expect(ownerOfKey(key)).toBe('usr_abc123')
    expect(isPublicKey(key)).toBe(false)
  })

  it('العامّ لا صاحب له، والخاصُّ ليس عامًّا — فلا يختلط البابان', () => {
    const key = platformKey('image/png')
    expect(isPublicKey(key)).toBe(true)
    expect(ownerOfKey(key)).toBeNull()
  })

  /*
   * **حارس اجتياز المسار.** محرّك القرص يكتب تحت مجلَّد، و`..` في المفتاح
   * تُخرج الكتابة منه. ويُقاس هنا على المفتاح نفسه لا على الكتابة، لأنّه
   * يمرّ على الروابط والحذف والقراءة كذلك.
   */
  it('ما فيه اجتيازُ مسارٍ يُردّ — ولو بدأ بالبادئة العامّة نصًّا', () => {
    const nul = String.fromCharCode(0)
    for (const bad of [
      'platform/../users-files/usr_1/proof.pdf',
      'platform//images/a.png',
      '/platform/images/a.png',
      '../etc/passwd',
      `platform/images/a.png${nul}.txt`,
      'other/images/a.png',
      '',
    ]) {
      expect(isSafeKey(bad), bad).toBe(false)
      expect(isPublicKey(bad), bad).toBe(false)
      expect(ownerOfKey(bad), bad).toBeNull()
    }
  })

  it('ومعرّفُ مستخدمٍ فيه شرطةُ مسارٍ يُرفض عند البناء لا عند الكتابة', () => {
    expect(() => userFileKey('../../etc', 'application/pdf')).toThrow()
    expect(() => userFileKey('usr/1', 'application/pdf')).toThrow()
  })
})
