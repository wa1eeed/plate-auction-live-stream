/**
 * واجهةُ التخزين — محرّكان خلفها، ولا يعرف المستدعي أيّهما يعمل.
 *
 * `disk` للتطوير والفحص: لا حاوية ولا مفاتيح، فالمجموعة تعمل على أيّ جهاز
 * وفي البوّابة بلا سرٍّ واحد. و`r2` للإنتاج. والانتقال بينهما **متغيّرُ
 * بيئةٍ لا تعديلُ كود** — وهو الشرط الذي يجعل الطبقة تستحقّ وجودها.
 */
export type MediaDriver = {
  readonly kind: 'r2' | 'disk'

  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>
  remove(key: string): Promise<void>

  /**
   * بايتاتُ ملفٍّ — للمحرّك الذي يُقدّم بنفسه (القرص)، و`null` لما لا يُقرأ.
   *
   * ولا تُستعمل لما هو عامّ: العامّ يُقدَّم من CDN لا من الخادم.
   */
  read(key: string): Promise<{ bytes: Uint8Array; contentType: string } | null>

  /** رابطٌ دائم لما تحت `platform/` — يُكتب في الصفحة كما هو. */
  publicUrl(key: string): string

  /**
   * رابطٌ موقَّتٌ لما تحت `users-files/`، أو `null` إن كان المحرّك يقدّمه
   * بنفسه فيُبثّ من المسار المحروس بدل إعادة التوجيه.
   */
  signedUrl(key: string, expiresInSeconds: number): Promise<string | null>

  /**
   * رابطٌ يرفع إليه **المتصفّح مباشرةً**، أو `null` لمحرّكٍ لا يدعمه.
   *
   * و`null` ليست عطبًا بل مسلكًا آخر: محرّك القرص لا رابطَ له، فيرجع العميل
   * إلى الرفع عبر الخادم كما كان. فيبقى التطوير والفحص بلا حاويةٍ ولا سرّ.
   *
   * و`contentType` **يُوقَّع**: R2 يرفض كتابةَ الكائن بنوعٍ سواه.
   */
  signedUpload(input: {
    key: string
    contentType: string
    expiresInSeconds: number
  }): Promise<string | null>

  /** وصفُ كائنٍ بلا تحميله — حجمُه الحقيقيّ كما يراه المخزن، لا كما ادُّعي. */
  head(key: string): Promise<{ size: number; contentType: string } | null>

  /**
   * أوّلُ بايتاتٍ من كائن — **بها يُفحص ما رُفع بلا أن يُحمَّل**.
   *
   * وكلُّ فحوصنا تقرأ الرأس: نوعُ الصورة وأبعادُها في أوّلها، و`ftyp` في
   * أوّل اثني عشر بايتًا من MP4. فأربعةٌ وستّون كيلوبايت تكفي لِما كان
   * يُقرأ له مئتا ميغابايت.
   */
  readRange(key: string, length: number): Promise<Uint8Array | null>

  /** نقلُ كائنٍ داخل المخزن — **ولا تمرّ بايتاتُه بالخادم**. */
  move(from: string, to: string): Promise<void>
}

/** نوعُ المحتوى من امتداد المفتاح — ما يُكتب في الترويسة عند التقديم. */
export function contentTypeOf(key: string): string {
  const ext = key.slice(key.lastIndexOf('.') + 1).toLowerCase()
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'webp':
      return 'image/webp'
    case 'mp4':
      return 'video/mp4'
    case 'mov':
      return 'video/quicktime'
    case 'pdf':
      return 'application/pdf'
    default:
      return 'application/octet-stream'
  }
}
