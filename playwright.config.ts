import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.E2E_PORT ?? 3100)
const baseURL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL, locale: 'ar-SA', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm build && PORT=${PORT} pnpm start`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      AUCTION_STORE: 'memory',
      DEMO_MODE: 'true',
      SESSION_SECRET: 'e2e-secret-please-change',
      PORT: String(PORT),
      // مجلّد مخرجات خاص حتى لا يستبدل مبنى الاختبار ملفات خادم تطوير عامل
      NEXT_DIST_DIR: '.next-e2e',
      /*
       * بلا عامل خدمة في المجموعة — دَينٌ **مُقاس** لا افتراض.
       *
       * قِيس على خمس تشغيلاتٍ كاملة بعد تحرير المنفذ العالق (وهو كان يُفسد
       * القياس الأوّل): بلا عامل ١٣٢/١٣٢ مطّردًا، ومعه ١٢٩–١٣١ **تتبدّل
       * سقطاتها في كلّ مرّة**. وأُصلحت أربعُ منها فعلًا — ضعفٌ حقيقيّ فيها —
       * ثمّ سقط غيرُها، فبان أنّ التصويب يلاحق عَرَضًا لا سببًا.
       *
       * والعَرَض واحد: الصفحة تُقاس **فارغةً** (`main` بلا نصّ) أو **مكرّرة**
       * (شجرتا تصيير). أي أنّ تركيب عاملٍ في ١٣٢ سياقًا على خادمٍ واحد يزاحم
       * استجابة Next المتدفّقة.
       *
       * وما يُستثنى **خاملٌ في الإنتاج**: العامل بلا مستمع `fetch` عامل، وجودُه
       * شرطُ التثبيت عند Chrome ولا شيء غيره. فلا تُخفي العلامةُ سلوكًا يعمل.
       *
       * ورفعُه يلزمه فهمُ تلك المزاحمة لا تصويبُ فحصٍ آخر.
       */
      NEXT_PUBLIC_DISABLE_SW: '1',
      /*
       * وسائطُ المجموعة على القرص في مجلَّدٍ خاصّ — لا R2.
       *
       * فالمجموعة تمرّ على أيّ جهازٍ وفي البوّابة بلا مفتاحٍ واحد، وما يُقاس
       * هو منطقُ الرفع والصلاحية لا الشبكة. والمجلَّد مستقلٌّ عن مجلَّد خادم
       * التطوير فلا يمحو أحدُهما ملفّات الآخر.
       */
      MEDIA_DIR: '.next-e2e/media',
    },
  },
})
