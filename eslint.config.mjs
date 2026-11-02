import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const compat = new FlatCompat({ baseDirectory: __dirname })

const config = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  /*
   * مخرجاتُ البناء مولَّدةٌ لا مصدرٌ — تُهمَل.
   *
   * **والمُهملُ يُطابَق في أيّ عمق لا في الجذر وحده.** فـ`.next-e2e/**`
   * مُثبَّتةٌ بجذر المستودع، وتحت `.claude/worktrees/` نُسخُ عملٍ لكلِّ
   * واحدةٍ منها مخرجاتُها — فتدخلها ESLint وتسقط على ملفٍّ يمحوه بناءٌ
   * يجري في نسخةٍ أخرى:
   *
   *     ENOENT: .claude/worktrees/…/.next-e2e/static/…/_buildManifest.js
   *
   * وبادئةُ `**` تُطابق النسخَ كلَّها، و`.claude` تُقصى جملةً: ليس فيها
   * مصدرٌ يُفحص، وما فيها من كودٍ تفحصه نسختُه هي.
   */
  {
    ignores: [
      '**/.next/**',
      '**/.next-e2e/**',
      '**/.next-dev/**',
      '**/node_modules/**',
      '.claude/**',
      'tests/e2e/**',
      'next-env.d.ts',
      /*
       * حزمةُ التسليم مرجعٌ لا كودُ إنتاج: `support.js` محرّكُ معاينةٍ
       * للنماذج لا يُشحن، و`.dc.html` قوالبُ تصميم. وفحصُها يُنتج أخطاءً
       * عن كودٍ لا نملكه ولا نبنيه.
       */
      'docs/design_handoff_final/**',
      'mobile/**',
    ],
  },
]

export default config
