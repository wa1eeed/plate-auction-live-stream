export const dynamic = 'force-dynamic'

/**
 * ارتباطُ النطاق بالتطبيق على iOS — ما يجعل رابط `https` يفتح التطبيق.
 *
 * يجلبه جهاز آبل من `https://<النطاق>/.well-known/apple-app-site-association`
 * عند أوّل تثبيت، بشروطٍ لا تُتجاوَز:
 *
 * - **`application/json` بلا امتداد `.json`** في المسار.
 * - **بلا إعادة توجيه** — ولو إلى النطاق نفسه بـ`www`.
 * - **HTTPS بشهادةٍ صالحة** ومنفذ 443.
 *
 * ولا يُوقَّع الملفّ منذ iOS 9، فلا حاجة إلى شهادةٍ فيه.
 */

/**
 * معرّف التطبيق = معرّف الفريق + معرّف الحزمة.
 *
 * ومعرّف الفريق يُقرأ من البيئة لا يُكتب هنا: هو خاصٌّ بحساب مطوّرٍ بعينه،
 * ونسخةٌ أخرى من المنصّة لها حسابٌ آخر. **وبلا ضبطه يُردّ 404** — وهو ما يقع
 * اليوم لأيّ نطاقٍ بلا تطبيق، فلا يُوهم آبل بارتباطٍ لا يصحّ.
 */
function appId(): string | null {
  const team = process.env.APPLE_TEAM_ID?.trim()
  const bundle = process.env.APPLE_BUNDLE_ID?.trim() || 'sa.nx.mazad'
  return team ? `${team}.${bundle}` : null
}

export async function GET() {
  const identifier = appId()
  if (!identifier) {
    return new Response('غير مهيّأ', { status: 404 })
  }

  return Response.json(
    {
      applinks: {
        /*
         * `details` بصيغتها الحديثة: `components` لا `paths`.
         *
         * وتُفتح المسارات التي يقصدها الإشعار وحدها، ويُستثنى ما لا ينبغي أن
         * يُفتح في غلافٍ بلا شريط عنوان: مسارات الإدارة ونقاط الواجهة
         * البرمجية. ومن فتح رابط إدارةٍ على جوّاله فُتح في متصفّحه — حيث يرى
         * العنوان ويعرف أين هو.
         */
        details: [
          {
            appIDs: [identifier],
            components: [
              { '/': '/market/*', comment: 'صفحة لوحة' },
              { '/': '/account/*', comment: 'صفحات الحساب والمحفظة والصفقات' },
              { '/': '/u/*', comment: 'معرض بائع' },
              { '/': '/@*', comment: 'معرض بمعرّفه القصير' },
            ],
          },
        ],
      },
      /*
       * `webcredentials` يُتيح لـ«سلسلة المفاتيح» أن تعرض كلمة المرور نفسها
       * في التطبيق وفي سفاري — فلا يُطلب من المستخدم أن يكتبها مرّتين.
       */
      webcredentials: { apps: [identifier] },
    },
    {
      headers: {
        'content-type': 'application/json',
        // يُجلب عند التثبيت وعند التحديث — ولا يُخزَّن طويلًا كي يصل تعديلُه
        'cache-control': 'public, max-age=3600',
      },
    },
  )
}
