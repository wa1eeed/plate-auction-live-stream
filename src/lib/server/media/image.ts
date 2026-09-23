/**
 * قياس الصورة من بايتاتها — لا من اسمها ولا ممّا أعلنه المتصفّح.
 *
 * ويُقاس شيئان معًا:
 *
 *  ١. **النوع الحقيقيّ**: ملفٌّ اسمه `.jpg` ونوعه المعلن `image/jpeg` وفيه
 *     HTML يُخزَّن ثمّ يُقدَّم من نطاقٍ نثق به. والتوقيع في أوّل البايتات
 *     لا يكذب.
 *  ٢. **المقاس**: نسبةُ البنر تُفرض عند الرفع لا عند العرض. وبنرٌ مربّع في
 *     شريحةٍ نسبتها 2:1 يُقصّ نصفُه أو يُمطّ — والرفض عند الرفع برسالةٍ
 *     تقول النسبة المطلوبة خيرٌ من تخطيطٍ ينكسر بعد النشر.
 *
 * ولا حزمةَ صور: ثلاثُ صيغٍ وثلاثةُ رؤوس تُقرأ بـ`DataView`.
 */

export type ImageProbe = { mime: 'image/jpeg' | 'image/png' | 'image/webp'; width: number; height: number }

function readPng(view: DataView): ImageProbe | null {
  // 89 50 4E 47 0D 0A 1A 0A ثمّ طول القطعة ثمّ 'IHDR' ثمّ العرض والارتفاع
  if (view.byteLength < 24) return null
  if (view.getUint32(0) !== 0x89504e47 || view.getUint32(4) !== 0x0d0a1a0a) return null
  if (view.getUint32(12) !== 0x49484452) return null
  return { mime: 'image/png', width: view.getUint32(16), height: view.getUint32(20) }
}

function readJpeg(view: DataView): ImageProbe | null {
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null

  /*
   * المقاس في `SOFn` لا في أوّل الملفّ — فتُتخطّى القطع بأطوالها.
   *
   * و`SOF4` و`SOF8` و`SOF12` ليست إطارات (هي جداول ترميزٍ وما يشبهها)،
   * فتُستثنى وإلّا قُرئ طولُ جدولٍ مقاسًا.
   */
  let offset = 2
  while (offset + 9 < view.byteLength) {
    if (view.getUint8(offset) !== 0xff) return null
    const marker = view.getUint8(offset + 1)
    const length = view.getUint16(offset + 2)
    const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)
    if (isFrame) {
      return { mime: 'image/jpeg', height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) }
    }
    if (length < 2) return null
    offset += 2 + length
  }
  return null
}

function readWebp(view: DataView, bytes: Uint8Array): ImageProbe | null {
  // 'RIFF' …… 'WEBP' ثمّ نوعُ القطعة: VP8 / VP8L / VP8X
  if (view.byteLength < 30) return null
  if (view.getUint32(0) !== 0x52494646 || view.getUint32(8) !== 0x57454250) return null

  const chunk = String.fromCharCode(...bytes.slice(12, 16))
  if (chunk === 'VP8 ') {
    // إطارُ مفتاحٍ بسيط: المقاس بعد رمز البدء `9D 01 2A`
    return {
      mime: 'image/webp',
      width: view.getUint16(26, true) & 0x3fff,
      height: view.getUint16(28, true) & 0x3fff,
    }
  }
  if (chunk === 'VP8L') {
    const packed = view.getUint32(21, true)
    return {
      mime: 'image/webp',
      width: (packed & 0x3fff) + 1,
      height: ((packed >> 14) & 0x3fff) + 1,
    }
  }
  if (chunk === 'VP8X') {
    const at = (i: number) => view.getUint8(i)
    return {
      mime: 'image/webp',
      width: (at(24) | (at(25) << 8) | (at(26) << 16)) + 1,
      height: (at(27) | (at(28) << 8) | (at(29) << 16)) + 1,
    }
  }
  return null
}

/** يقرأ النوع والمقاس، و`null` لما ليس صورةً من الثلاث. */
export function probeImage(bytes: Uint8Array): ImageProbe | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const probe = readPng(view) ?? readJpeg(view) ?? readWebp(view, bytes)
  if (!probe || probe.width <= 0 || probe.height <= 0) return null
  return probe
}

/** توقيع `ftyp` في أوّل صندوقٍ من MP4 — ما يميّزه عمّا سُمِّي باسمه. */
export function isMp4(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 12) return false
  return String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp'
}

/**
 * نسبةُ البنر — **نطاقُ تسامحٍ لا مقاسٌ بالبكسل**.
 *
 * 2:1 هي نسبةُ البنرات المستطيلة في التطبيقات الأصيلة، وعند عرض ٣٩٠ وحشوة
 * ١٦ تعطي ارتفاع ١٧٩ بكسلًا — فيبقى أوّلُ كاروسيل فوق الطيّة، وهو ما يفقده
 * 16:9 بائتين وعشرين بكسلًا.
 *
 * ويُقبل ما بين 1.7 و2.3 لا ١٢٠٠×٦٠٠ حرفًا: تصميمٌ خرج 1080×540 أو
 * 1200×628 صحيحٌ، ورفضُه بالبكسل عنادٌ لا حراسة.
 */
export const BANNER_RATIO = { ideal: 2, min: 1.7, max: 2.3, minWidth: 600 } as const

export function bannerRatioError(probe: ImageProbe): string | null {
  const ratio = probe.width / probe.height
  if (probe.width < BANNER_RATIO.minWidth) {
    return `عرض الصورة ${probe.width} بكسل، والحدّ الأدنى ${BANNER_RATIO.minWidth} — فتظهر مهترئة على الشاشات الحادّة`
  }
  if (ratio < BANNER_RATIO.min || ratio > BANNER_RATIO.max) {
    return `نسبة الصورة ${ratio.toFixed(2)}:1، والمطلوب قريبٌ من 2:1 (مثل ١٢٠٠×٦٠٠)`
  }
  return null
}
