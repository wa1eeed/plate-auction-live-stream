export const dynamic = 'force-dynamic'

/**
 * ارتباطُ النطاق بالتطبيق على أندرويد — «App Links».
 *
 * يجلبه النظام من `https://<النطاق>/.well-known/assetlinks.json` عند التثبيت،
 * فيتحقّق أنّ صاحب النطاق يُقرّ بالتطبيق. وبدونه يُعرض للمستخدم مُنتقي «بأيّ
 * تطبيق تفتح؟» بدل أن يفتح تطبيقُنا مباشرةً.
 *
 * والبصمة بصمةُ **شهادة التوقيع** لا شهادة التطوير:
 *
 *   keytool -list -v -keystore release.keystore -alias <الاسم>
 *
 * ومن يوقّع عبر «توقيع تطبيق Play» تُؤخذ البصمة من لوحة Play نفسها — لأنّ
 * جوجل تُعيد توقيع الحزمة بمفتاحها، فبصمةُ مفتاحك المحلّيّ لا تطابق ما يصل
 * الأجهزة، وهو أكثر ما يُعطِّل هذه الميزة صامتًا.
 */

/** أكثر من بصمة: مفتاح التحميل ومفتاح Play، وبصمةُ تصحيحٍ عند الحاجة. */
function fingerprints(): string[] {
  return (process.env.ANDROID_CERT_FINGERPRINTS ?? '')
    .split(',')
    .map((value) => value.trim().toUpperCase())
    // البصمة ستّون محرفًا بين نقطتين — وما لا يطابق يُسقَط ولا يُكتب ناقصًا
    .filter((value) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(value))
}

export async function GET() {
  const certs = fingerprints()
  const packageName = process.env.ANDROID_PACKAGE_ID?.trim() || 'sa.nx.mazad'

  /*
   * بلا بصمةٍ صالحة يُردّ 404 لا ملفٌّ فارغ.
   *
   * ملفٌّ بقائمةٍ فارغة يُقرأ إقرارًا بأنّ **لا تطبيق** لهذا النطاق، فيُخزَّن
   * النفي عند النظام ويُعطَّل الارتباط حتى بعد ضبطه. والغياب أسلم من نفيٍ
   * يُحفظ.
   */
  if (certs.length === 0) {
    return new Response('غير مهيّأ', { status: 404 })
  }

  return Response.json(
    [
      {
        relation: [
          'delegate_permission/common.handle_all_urls',
          // يُتيح ملء كلمة المرور من «مدير كلمات مرور جوجل» داخل التطبيق
          'delegate_permission/common.get_login_creds',
        ],
        target: {
          namespace: 'android_app',
          package_name: packageName,
          sha256_cert_fingerprints: certs,
        },
      },
    ],
    {
      headers: {
        'content-type': 'application/json',
        'cache-control': 'public, max-age=3600',
      },
    },
  )
}
