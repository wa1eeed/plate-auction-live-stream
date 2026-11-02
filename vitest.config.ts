import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: {
    environment: 'node',
    /* بيانةُ فحصٍ على قاعدةٍ عابرة — لا تبلغ قاعدةً حقيقيّة */
    env: { DEMO_USER_PASSWORD: 'demo1234' },
    include: ['tests/unit/**/*.test.ts'],
    globals: true,
  },
})
