/**
 * إعداد Next بصيغة `.mjs` لا `.ts` — عمدًا.
 *
 * إعدادُ TypeScript يُحمَّل وقت **التشغيل** لا وقت البناء وحده: يطلب Next حزمة
 * `typescript` من `node_modules` ليترجم الملفّ، وإن لم يجدها **حاول تنزيلها من
 * الشبكة أثناء الإقلاع**. وذلك يربط إقلاع الحاوية بالإنترنت وبحزمة تطوير لا
 * موضع لها في صورة الإنتاج. والتعليق أدناه يعطي التحقّق من الأنواع في المحرّر
 * كما كان، بلا اعتماد وقت التشغيل.
 *
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: false },
  experimental: { optimizePackageImports: ['lucide-react'] },
  /**
   * مجلّد المخرجات قابل للتبديل عبر البيئة.
   * السبب: `pnpm test:e2e` يبني مبنى إنتاج، وإن كتبه في `.next` نفسه الذي
   * يستخدمه خادم التطوير العامل استبدل ملفاته، فترجع الحُزم 404 وتظهر
   * الصفحات بلا تنسيق ولا تفاعل. الاختبار الشامل يستخدم مجلّدًا خاصًّا به.
   */
  distDir: process.env.NEXT_DIST_DIR ?? '.next',

  /**
   * لكل مجلّد مخرجات ملفّ إعداد خاص به.
   * أنواع المسارات المولّدة تعيش داخل مجلّد المخرجات، فلو اجتمع مجلّدان في
   * `include` واحد تضاربت نسختان من النوع نفسه وسقط البناء.
   */
  typescript: {
    tsconfigPath: process.env.NEXT_DIST_DIR ? 'tsconfig.e2e.json' : 'tsconfig.json',
  },
}

export default nextConfig
