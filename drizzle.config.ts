import type { Config } from 'drizzle-kit'

/**
 * إعداد أداة الترحيل.
 *
 * والترحيلات **ملفّاتٌ في المستودع** لا أوامرُ تُدفع من جهاز أحدهم: ما يغيّر
 * شكل قاعدةٍ فيها مالٌ يجب أن يُراجَع ويُودَع ويُنشر مع الكود الذي يحتاجه.
 */
export default {
  schema: './src/lib/store/pg/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
  /* أسماء الجداول والأعمدة بالإنجليزية — والتعليقات وحدها عربية */
  casing: 'snake_case',
} satisfies Config
