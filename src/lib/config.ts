/** إعدادات التطبيق المقروءة من متغيرات البيئة (خادمية). */
export const config = {
  storeKind: (process.env.AUCTION_STORE ?? 'memory') as 'memory' | 'supabase',
  /*
   * التجريبي يُطلب طلبًا.
   *
   * كان افتراضه التشغيل، فتُنشر الصفحة الرئيسية وفيها كلمة مرور حساب عامل
   * ما لم يُضبط `DEMO_MODE=false` صراحةً — أي أن نشرًا بلا انتباه ينشرها.
   * والافتراض الآمن أن يُطفأ ما لم يُطلب.
   */
  demoMode: process.env.DEMO_MODE === 'true',
  /*
   * رايةٌ واحدة لكل ما يقول «هذه ليست منصّة حقيقية».
   *
   * كانت رايتين: `DEMO_MODE` لبيانات الدخول المعروضة، و`APP_ENV=staging`
   * للشارة. فمن أراد نسخةً تبدو حقيقية احتاج إصابة اثنتين معًا، وإخطاء
   * واحدةٍ منهما يترك **كلمة مرور الإدارة معروضة على صفحة عامّة** — وقع
   * ذلك فعلًا على نشرٍ حيّ.
   *
   * وواحدةٌ مطفأةٌ افتراضًا أسلم: من نسي ضبطها خرجت نسخته نظيفة، ومن أرادها
   * طلبها صراحةً. والقديمتان لم تعودا تُقرآن هنا — فما بقي منهما في متغيّرات
   * نشرٍ قائم لا يُعيد التلميحات من حيث لا يُنتبه.
   */
  demoHints: process.env.DEMO_HINTS === 'true',
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  tradeRateLimit: {
    windowMs: Number(process.env.BID_RATE_LIMIT_WINDOW_MS ?? 10_000),
    max: Number(process.env.BID_RATE_LIMIT_MAX ?? 6),
  },
} as const

/** حسابات تجريبية — كل حساب يبيع ويشتري في آنٍ واحد. */
export const DEMO_USERS = [
  {
    email: 'waleed@demo.sa',
    password: 'demo1234',
    displayName: 'وليد العتيبي',
    phone: '+966500000001',
    city: 'الرياض',
    social: { tiktok: 'waleed.plates', snapchat: 'waleed_sa', instagram: 'waleed.plates' },
    payout: { bankName: 'مصرف الراجحي', iban: 'SA3144000001012345678901', accountName: 'وليد العتيبي' },
  },
  {
    email: 'sara@demo.sa',
    password: 'demo1234',
    displayName: 'سارة القحطاني',
    phone: '+966500000002',
    city: 'جدة',
    social: { tiktok: 'sara.auctions', snapchat: null, instagram: 'sara.auctions' },
    payout: { bankName: 'البنك الأهلي', iban: 'SA9805000000682012345678', accountName: 'سارة القحطاني' },
  },
  {
    email: 'majed@demo.sa',
    password: 'demo1234',
    displayName: 'ماجد الشهري',
    phone: '+966500000003',
    city: 'الدمام',
    social: { tiktok: null, snapchat: 'majed_dmm', instagram: null },
    payout: { bankName: 'بنك الرياض', iban: 'SA1310000010045678912345', accountName: 'ماجد الشهري' },
  },
] as const

export const DEMO_PRIMARY_USER = DEMO_USERS[0]

/**
 * حساب الإدارة التجريبي.
 * منفصل تمامًا عن حسابات المستخدمين، وبكوكي جلسة مستقلّ — فيمكن فتح لوحة
 * الإدارة وحساب مستخدم عادي في المتصفّح نفسه معًا.
 *
 * **وكلمته تُبدَّل من البيئة.**
 *
 * البذرة تُنشئ هذا الحساب في كل إقلاع سواءٌ أكان `DEMO_MODE` مشتغلًا أم لا —
 * `DEMO_MODE` يحكم عرض البيانات على صفحة الدخول، لا وجود الحساب. فنشرٌ على
 * الإنترنت من مستودعٍ عامّ يعني أنّ كلمة الإدارة مكتوبة في الكود لمن قرأه:
 * يدخل اللوحة، ويُفرج عن أموال، ويصادر عرابين، ويوقف إعلانات.
 *
 * وأخطر صوره حين يُطفأ `DEMO_MODE`: تختفي البيانات عن الصفحة فتبدو اللوحة
 * مقفلة، والباب مفتوح كما كان.
 *
 * والافتراض يبقى كما هو ليعمل التطوير المحلّي والاختبارات بلا إعداد.
 */
export const DEMO_ADMIN = {
  /*
   * يُخفَّض الحرف هنا لا عند المقارنة وحدها.
   *
   * `findAdminByEmail` يُخفّض ما يُكتب في نموذج الدخول ثمّ يقارنه بما في
   * المخزن **حرفيًّا**. والبذرة تخزّن ما جاء من البيئة كما جاء — فمن كتب
   * `Admin@Site.com` في متغيّرات النشر خُزّن بحرفه الكبير، ولم يُطابقه ما
   * يُخفَّض عند الدخول أبدًا. والرسالة الراجعة «بيانات الدخول غير صحيحة»
   * لا تدلّ على السبب، فيبقى صاحب اللوحة خارجها بلا خبر.
   */
  email: (process.env.DEMO_ADMIN_EMAIL || 'admin@demo.sa').trim().toLowerCase(),
  password: process.env.DEMO_ADMIN_PASSWORD || 'admin1234',
  displayName: 'مدير المنصّة',
} as const

/** رصيد افتتاحي لحسابات Demo حتى تُجرَّب المزايدة بالعربون فورًا. */
export const DEMO_WALLET_OPENING_BALANCE = 50_000

export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'http://localhost:3000'
}
