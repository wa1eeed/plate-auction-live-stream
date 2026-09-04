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
   * بيئةٌ تجريبية تُعلن عن نفسها — بطلبٍ صريح لا افتراضًا.
   *
   * نسخةٌ على الإنترنت ببيانات وهمية وأرصدةٍ من لا شيء تُشبه المنصّة الحقيقية
   * تمامًا، فيدخلها من يظنّها هي ويزايد بمالٍ يحسبه ماله. والشارة تقطع الظنّ.
   *
   * وهي مُطفأة ما لم يُضبط `APP_ENV=staging`: مَن أخذ نسخةً من هذا الكود
   * ونشرها لا يجد فيها شارةً تقول لزوّاره إنّ موقعه تجربة.
   */
  isStaging: process.env.APP_ENV === 'staging',
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
  email: process.env.DEMO_ADMIN_EMAIL || 'admin@demo.sa',
  password: process.env.DEMO_ADMIN_PASSWORD || 'admin1234',
  displayName: 'مدير المنصّة',
} as const

/** رصيد افتتاحي لحسابات Demo حتى تُجرَّب المزايدة بالعربون فورًا. */
export const DEMO_WALLET_OPENING_BALANCE = 50_000

export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'http://localhost:3000'
}
