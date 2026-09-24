import { NextResponse, type NextRequest } from 'next/server'

/**
 * ترويسة `Content-Security-Policy` — بـ`nonce` يُولَّد لكلّ طلب.
 *
 * ⚠ **هذا الملفّ يعمل في بيئة الحافّة.** لا يُستورد فيه شيءٌ من `@/lib` ولا
 * من المخزن ولا أيّ حزمةٍ تطلب `node:`. وقد أسقط ذلك المنصّة كلَّها مرّةً
 * حين وُضع اتّصال القاعدة في `instrumentation.ts`: يترجمه Next للحافّة، وسائق
 * القاعدة لا يعمل فيها. فما هنا `next/server` و`crypto` العالميّ وحدهما.
 *
 * ولماذا CSP أصلًا؟ لأنّها **آخر خطٍّ يقف بين ثغرة XSS وحساب الأدمن**: كلُّ
 * الترويسات الأخرى تمنع أشياء محدّدة، وهذه تمنع تنفيذ كلّ سكربتٍ لم نضعه نحن.
 */

/** ترويسات لا تحمل مستنَدًا لا تحتاج سياسةً لمحتواه. */
export const config = {
  matcher: [
    /*
     * كلّ شيءٍ إلّا الأصول الساكنة وملفّات الجذر المعروفة.
     * وهي تأخذ الترويسات الساكنة من `next.config.mjs` على أيّ حال.
     */
    '/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js|robots.txt|sitemap.xml).*)',
  ],
}

export function middleware(request: NextRequest) {
  const nonce = crypto.randomUUID().replaceAll('-', '')
  const dev = process.env.NODE_ENV !== 'production'

  /*
   * `strict-dynamic` يُلغي `'self'` للسكربتات عمدًا: لا يُنفَّذ إلّا ما حمله
   * سكربتٌ يحمل الـnonce. فرفعُ ملفٍّ إلى مجلّدٍ عامّ لا يجعله قابلًا للتنفيذ.
   *
   * و`unsafe-eval` في التطوير وحده — إعادة التحميل الساخن تحتاجه، والإنتاج لا.
   */
  const script = dev
    ? `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`

  /*
   * `unsafe-inline` للأنماط — ولا مفرّ منه اليوم.
   *
   * React يكتب `style={{…}}` سماتِ نمطٍ سطرية (٢٧ موضعًا)، وFramer Motion
   * يكتب أنماطًا في كلّ إطارٍ من الحركة. و`nonce` لا يُطبَّق على سمة نمط.
   * والخطر منها أقلّ بكثير: نمطٌ لا يُنفِّذ كودًا.
   */
  const directives = [
    `default-src 'self'`,
    `script-src ${script}`,
    `style-src 'self' 'unsafe-inline'`,
    /* الشعارات تُخزَّن `data:` في الإعدادات، والمعاينات `blob:` قبل الرفع */
    `img-src 'self' data: blob:`,
    /*
     * الستوري فدّيو — وبلا هذه يقع على `default-src` فلا يُشغَّل.
     * والوسائط كلُّها من أصلنا: تُقدَّم من `/api/media/` لا من نطاقٍ آخر.
     */
    `media-src 'self' blob:`,
    /* الخطّ يستضيفه Next في `_next/static` — لا طلب إلى جوجل */
    `font-src 'self'`,
    /* المزايدة اللحظية على `/ws` — نفس الأصل، والصريح أوضح من الاتّكال على `'self'` */
    `connect-src 'self' ws: wss:`,
    `worker-src 'self'`,
    `manifest-src 'self'`,
    /* لا إطار ولا مصدر قاعدة ولا هدف نموذج خارج المنصّة */
    `frame-ancestors 'none'`,
    `frame-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
  ]
  if (!dev) directives.push('upgrade-insecure-requests')

  const policy = directives.join('; ')

  /*
   * **مخرجٌ بلا نشرة**: `CSP_REPORT_ONLY=1` يحوّلها إلى وضع التقرير.
   *
   * فلو كسرت السياسةُ شيئًا لم يظهر في الاختبار، يُبدَّل متغيّرٌ في لوحة
   * النشر ويعود الموقع في دقيقة — بدل انتظار بناءٍ ونشرةٍ كاملة.
   */
  const header =
    process.env.CSP_REPORT_ONLY === '1'
      ? 'Content-Security-Policy-Report-Only'
      : 'Content-Security-Policy'

  /*
   * السياسة تُوضع على **الطلب** أيضًا لا على الردّ وحده: Next يقرأ الـnonce
   * منها ليضعه على سكربتاته هو. وبغير ذلك تُحجب حزمُ الإطار نفسها.
   */
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', policy)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set(header, policy)
  return response
}
