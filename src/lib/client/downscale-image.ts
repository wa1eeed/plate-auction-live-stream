/**
 * **تصغيرُ الصورة في متصفّح الرافع — لا في الخادم ولا عند كلّ مشاهد.**
 *
 * وصورةُ هاتفٍ حديث تبلغ العشرين ميغابايت بأربعة آلاف بكسل، وحدُّ الرفع
 * خمسةٌ وعشرون — فتُقبل كما هي، وتُقدَّم كما هي. فحلقةُ الستوري عرضُها
 * ثمانيةٌ وستّون بكسلًا تُنزّل عشرين ميغابايت لترسمها، والبنرُ مثلُها.
 * وهو ما شكاه صاحبُ المنصّة: الصورُ لا تظهر حتى يُنتظر.
 *
 * **ولمَ في المتصفّح؟** لأنّ البديل خادمٌ يحوّل. والخادمُ هنا بنواةٍ واحدة
 * (`cpus: 1` في إعداد Next، ومعها `workerThreads: false`) — وتحويلُ صورةٍ
 * بعشرين ميغابايت عليه يحبسه عن كلّ طلبٍ آخر. ويقتضي حزمةَ صورٍ أصيلة
 * (`sharp`) تُضاف إلى الحاوية، والمستودعُ يتجنّبها عمدًا: قياسُ الرؤوس هنا
 * مكتوبٌ بـ`DataView` بلا حزمة.
 *
 * **ومرّةً واحدةً إلى الأبد**: الإدارةُ ترفع مرّة، والمشاهدون يُقدَّم لهم
 * المصغَّر دائمًا. والعكسُ — تصغيرٌ عند العرض — عملٌ يتكرّر بعدد الزوّار.
 *
 * **ولا يُصغَّر ما يُرفع دليلًا**: ملفّات المستخدمين (إثباتُ نقلِ ملكيّة)
 * تُحفظ كما جاءت. وهذه الدالّة لا تُنادى إلّا من مسار الوسائط العامّة.
 */

/**
 * أطولُ ضلعٍ يُحفظ.
 *
 * وألفٌ وستّمئة تسع ستوري 1080×1920 بعد تصغيرها إلى 900×1600، وهي على
 * شاشةِ هاتفٍ بكثافةٍ ثلاثيّة أوفى ممّا يُرى. والبنر 2:1 يصير 1600×800،
 * وحدُّ عرضه في الخادم ستّمئة — فلا يسقط عنده.
 */
export const MAX_EDGE = 1600

/** جودةُ WebP — دونها يظهر التكتّل في التدرّجات، وفوقها يكبر بلا فرقٍ يُرى. */
export const WEBP_QUALITY = 0.82

/** ما يُصغَّر: صورٌ ساكنةٌ وحدها. والفدّيو والمستندات تمرّ كما هي. */
const RESIZABLE = new Set(['image/jpeg', 'image/png', 'image/webp'])

/**
 * المقاسُ المطلوب — أو `null` إن كانت الصورة في حدّها أصلًا.
 *
 * والنسبةُ محفوظة: حدُّ البنر في الخادم نسبةٌ بين 1.7 و2.3، فتغييرُها هنا
 * يردّ الرفعَ بعد أن صُغّرت الصورة.
 */
export function targetSize(
  width: number,
  height: number,
  maxEdge: number = MAX_EDGE,
): { width: number; height: number } | null {
  const longest = Math.max(width, height)
  if (longest <= maxEdge || longest === 0) return null
  const scale = maxEdge / longest
  return {
    /* والتدوير إلى واحدٍ على الأقلّ: ضلعٌ بصفرٍ لا يُرسم */
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/**
 * يُصغّر الصورة إن احتاجت، ويُعيد الأصلَ إن لم تحتج أو تعذّر التصغير.
 *
 * **ولا يُسقط رفعًا أبدًا.** فكلُّ ما هنا تحسينٌ: متصفّحٌ لا يعرف
 * `createImageBitmap`، أو لوحةٌ تُمنع قراءتها، أو صورةٌ لا تُفكّ — كلُّها
 * تُعيد الملفَّ كما جاء ويمضي الرفع. ورفعٌ بطيءٌ خيرٌ من رفعٍ لا يقع.
 */
export async function downscaleImage(file: File, maxEdge: number = MAX_EDGE): Promise<File> {
  if (!RESIZABLE.has(file.type.trim().toLowerCase())) return file
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file

  let bitmap: ImageBitmap | undefined
  try {
    /*
     * `from-image` تطبّق دورانَ EXIF.
     *
     * وصورةُ هاتفٍ تُلتقط أفقيًّا وتحمل علمَ دورانٍ في بياناتها — والرسمُ
     * على لوحةٍ يُسقط البيانات. فبلا هذا تُحفظ مقلوبةً تسعين درجة.
     */
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const size = targetSize(bitmap.width, bitmap.height, maxEdge)
    if (!size) return file

    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const context = canvas.getContext('2d')
    if (!context) return file
    context.drawImage(bitmap, 0, 0, size.width, size.height)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY),
    )
    /*
     * **ولا يُستبدل بما هو أكبر.**
     *
     * فصورةٌ صغيرةُ البايتات عاليةُ البكسلات قد تكبر بعد إعادة الترميز —
     * وصورةٌ مسطّحةٌ (رسمٌ بألوانٍ قليلة) PNG أصغرُ من WebP لها. والشرطُ
     * يحسم: ما لم يصغر لا يُؤخذ.
     */
    if (!blob || blob.size >= file.size) return file

    return new File([blob], 'image.webp', { type: 'image/webp', lastModified: Date.now() })
  } catch {
    return file
  } finally {
    bitmap?.close()
  }
}
