import { describe, expect, it, vi } from 'vitest'
import { downscaleImage, MAX_EDGE, targetSize } from '@/lib/client/downscale-image'
import { BANNER_RATIO } from '@/lib/server/media/image'

/**
 * **تصغيرُ الصورة في متصفّح الرافع.**
 *
 * وحدُّ الرفع خمسةٌ وعشرون ميغابايت، وصورةُ هاتفٍ حديث تبلغها بأربعة آلاف
 * بكسل — فتُقبل كما هي وتُقدَّم كما هي. وحلقةُ الستوري عرضُها ثمانيةٌ
 * وستّون بكسلًا تُنزّل عشرين ميغابايت لترسمها.
 */
describe('مقاسُ التصغير', () => {
  it('ما كان في حدّه لا يُمسّ', () => {
    expect(targetSize(1200, 600)).toBeNull()
    expect(targetSize(MAX_EDGE, 900)).toBeNull()
  })

  it('وما تجاوزه يُصغَّر بأطول ضلعيه', () => {
    expect(targetSize(4000, 3000)).toEqual({ width: 1600, height: 1200 })
    expect(targetSize(3000, 4000)).toEqual({ width: 1200, height: 1600 })
  })

  /*
   * **والنسبةُ محفوظة — وإلّا رُدّ البنرُ بعد تصغيره.**
   *
   * فحدُّ البنر في الخادم نسبةٌ بين 1.7 و2.3، يُفحص على البايتات الواصلة.
   * فتغييرُ النسبة هنا يعني رفعًا يُقبل قبل التصغير ويُردّ بعده.
   */
  it('والنسبةُ تبقى في حدّ البنر', () => {
    for (const [w, h] of [
      [4000, 2000],
      [3600, 1800],
      [2400, 1255],
    ]) {
      const size = targetSize(w, h)!
      const ratio = size.width / size.height
      expect(ratio, `${w}×${h} خرجت بنسبة ${ratio}`).toBeGreaterThanOrEqual(BANNER_RATIO.min)
      expect(ratio).toBeLessThanOrEqual(BANNER_RATIO.max)
    }
  })

  /*
   * وحدُّ عرض البنر في الخادم ستّمئة — فتصغيرٌ ينزل دونه يُسقط رفعًا صحيحًا.
   */
  it('ولا ينزل عرضُ بنرٍ عن حدّ الخادم', () => {
    const size = targetSize(6000, 3000)!
    expect(size.width).toBeGreaterThanOrEqual(BANNER_RATIO.minWidth)
  })

  /*
   * وصورةٌ شريطيّةٌ شديدةُ الطول — راياتٌ ولافتات — تُصغَّر فيصير ارتفاعُها
   * جزءًا من بكسل. والتدوير يُنزله إلى صفر، ولوحةٌ بضلعٍ صفرٍ لا تُرسم.
   */
  it('ولا يخرج ضلعٌ بصفر', () => {
    const size = targetSize(8000, 2)!
    expect(size.width).toBe(MAX_EDGE)
    expect(Math.round(2 * (MAX_EDGE / 8000)), 'الحالةُ لا تُنزل الضلعَ إلى صفرٍ أصلًا').toBe(0)
    expect(size.height).toBe(1)
  })

  it('وصفرٌ لا يُقسم عليه', () => {
    expect(targetSize(0, 0)).toBeNull()
  })
})

describe('تصغيرُ الملفّ', () => {
  const fileOf = (type: string) => new File([new Uint8Array([1, 2, 3])], 'x', { type })

  /*
   * **ولا يُفكّ الفدّيو ولا المستند أصلًا.**
   *
   * و`createImageBitmap` على ملفٍّ ليس صورةً يرمي — فيُعاد الأصل على كلّ
   * حال. لكنّ الفرقَ أنّه يُقرأ كلَّه إلى الذاكرة قبل أن يرمي: مئتا
   * ميغابايت من فدّيو في متصفّح هاتف. فالحارسُ يمنع المحاولة لا نتيجتَها —
   * ويُقاس بأنّها لم تُحاوَل.
   */
  it('الفدّيو والمستندات لا تُفكّ أصلًا', async () => {
    const attempts: string[] = []
    const options: unknown[] = []
    vi.stubGlobal('createImageBitmap', (file: File, opts?: unknown) => {
      attempts.push(file.type)
      options.push(opts)
      throw new Error('ما كان ينبغي أن يُنادى')
    })
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => null }) })
    try {
      for (const type of ['video/mp4', 'application/pdf', 'video/quicktime']) {
        const file = fileOf(type)
        await expect(downscaleImage(file)).resolves.toBe(file)
      }
      expect(attempts, 'فُكّ ما ليس صورةً').toEqual([])

      /* وصورةٌ تُحاوَل — فالحارسُ ينتقي ولا يمنع الكلّ */
      await downscaleImage(fileOf('image/jpeg'))
      expect(attempts).toEqual(['image/jpeg'])

      /*
       * **ودورانُ EXIF يُطبَّق عند الفكّ.**
       *
       * فصورةُ هاتفٍ تُلتقط وتحمل علمَ دورانٍ في بياناتها، والرسمُ على لوحةٍ
       * يُسقط البيانات. فبلا `from-image` تُحفظ مقلوبةً تسعين درجة — ولا
       * يظهر ذلك إلّا بعد النشر على صورةٍ بعينها.
       */
      expect(options[0], 'تُفكّ بلا دوران EXIF — فتُحفظ مقلوبة').toMatchObject({
        imageOrientation: 'from-image',
      })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  /*
   * **ولا يُسقط رفعًا أبدًا.**
   *
   * فبيئةٌ بلا `createImageBitmap` — وهي بيئةُ هذا الفحص — تُعيد الملفّ كما
   * جاء ويمضي الرفع. ورفعٌ بطيءٌ خيرٌ من رفعٍ لا يقع.
   */
  it('وبيئةٌ بلا لوحةٍ تُعيد الأصل ولا ترمي', async () => {
    const file = fileOf('image/jpeg')
    await expect(downscaleImage(file)).resolves.toBe(file)
  })
})
