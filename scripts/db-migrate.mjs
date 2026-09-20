import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'

/**
 * ترحيل المخطَّط — JavaScript خالصة، بلا إطار عمل ولا مترجم.
 *
 * يُستدعى من `server.mjs` **قبل** أن يبدأ Next، فيبلغ أوّلُ طلبٍ قاعدةً
 * مكتملة. ولا يُوضع في `instrumentation.ts` لأنّ Next يترجم ذلك الملفّ لبيئة
 * الحافّة كذلك، وسائق القاعدة لا يعمل فيها — فيسقط الإقلاع كلُّه.
 *
 * والترحيل SQL خالصة، فلا يحتاج شيئًا من كود التطبيق.
 */

const TABLE = '__migrations'

export async function migrate(connectionString, dir = 'drizzle') {
  const client = new pg.Client({
    connectionString,
    ssl: /\bsslmode=require\b/.test(connectionString) ? { rejectUnauthorized: false } : undefined,
  })
  await client.connect()

  try {
    await client.query(`CREATE TABLE IF NOT EXISTS ${TABLE} (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`)

    const files = readdirSync(dir)
      .filter((name) => name.endsWith('.sql'))
      .sort()

    const applied = []

    for (const name of files) {
      /*
       * كلُّ ترحيلٍ في معاملةٍ مع تسجيله.
       *
       * فلو سقط في منتصفه تراجَع كلُّه ولم يُسجَّل — ولا يبقى مخطَّطٌ نصفُ
       * مهاجَر يُظنّ تامًّا. والقفل يجعل خادمًا ثانيًا يُقلع معه ينتظر، ثمّ
       * يجد العمل قد تمّ فلا يُعيده.
       */
      await client.query('BEGIN')
      try {
        await client.query(`LOCK TABLE ${TABLE} IN SHARE ROW EXCLUSIVE MODE`)
        const done = await client.query(`SELECT 1 FROM ${TABLE} WHERE name = $1`, [name])
        if (done.rowCount > 0) {
          await client.query('COMMIT')
          continue
        }

        const body = readFileSync(join(dir, name), 'utf8')
        // `drizzle-kit` يفصل العبارات بهذا الفاصل، وتُنفَّذ واحدةً واحدة
        for (const statement of body.split('--> statement-breakpoint')) {
          const trimmed = statement.trim()
          if (trimmed) await client.query(trimmed)
        }

        await client.query(`INSERT INTO ${TABLE} (name) VALUES ($1)`, [name])
        await client.query('COMMIT')
        applied.push(name)
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    }

    // أسماء الملفّات وحدها — لا محتوى ولا رابط اتّصال ولا سرّ
    if (applied.length > 0) console.log(`[db] طُبّق ${applied.length} ترحيلًا: ${applied.join(', ')}`)
    else console.log('[db] المخطَّط محدَّث — لا ترحيل جديد')

    return applied
  } finally {
    await client.end()
  }
}
