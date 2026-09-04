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
    },
  },
})
