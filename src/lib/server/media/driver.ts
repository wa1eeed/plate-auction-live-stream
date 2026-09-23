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
    case 'pdf':
      return 'application/pdf'
    default:
      return 'application/octet-stream'
  }
}
