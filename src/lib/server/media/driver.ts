/**
 * واجهةُ التخزين — **على قرص الخادم**.
 *
 * وكانت خلفها محرّكان (قرصٌ وR2) ثمّ أُسقط R2 بقرار المالك: الملفّات تسكن
 * الحجم الدائم `/app/data/media`، ويُقدَّمها التطبيق من `/api/media/`.
 *
 * والواجهةُ باقيةٌ وإن كان خلفها محرّكٌ واحد — لأنّها **مُعامَلة بالمجلَّد**:
 * الفحوص تعطيه مجلَّدًا مؤقّتًا فتعمل بلا أن تكتب في مجلَّد المنصّة.
 */
export type MediaDriver = {
  readonly kind: 'disk'

  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>
  remove(key: string): Promise<void>

  /** بايتاتُ ملفٍّ، و`null` لما ليس موجودًا. */
  read(key: string): Promise<{ bytes: Uint8Array; contentType: string } | null>

  /** رابطُ التقديم — يمرّ بالتطبيق دائمًا، فيُفحص الإذنُ قبل كلّ بايت. */
  publicUrl(key: string): string
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
