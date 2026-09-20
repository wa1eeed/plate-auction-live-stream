import { Pool, types } from 'pg'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import * as schema from './schema'

/**
 * الاتّصال بقاعدة البيانات — مَجمعٌ واحد للعملية كلّها.
 *
 * ويُحفظ على `globalThis` كما يُحفظ مخزنُ الذاكرة: إعادةُ التحميل الساخنة في
 * التطوير تُعيد تنفيذ الوحدة، فبلا ذلك يُفتح مَجمعٌ جديد مع كلّ حفظِ ملفّ حتى
 * تنفد اتّصالات الخادم.
 */

/*
 * المال أعدادٌ صحيحة — وسائق `pg` يردّ `int8` نصًّا.
 *
 * وهو يفعل ذلك حرصًا: `bigint` في بوستجرس يتجاوز ما يُمثَّل في `number`. لكنّ
 * مبالغنا هللاتٌ لا تقارب ذلك السقف (٩٠ تريليون ريال)، والنصّ يُفسد كلّ حساب:
 * `"1000" + 500` تصير `"1000500"`. فيُقرأ عددًا صحيحًا صراحةً.
 */
types.setTypeParser(types.builtins.INT8, (value) => Number(value))

/*
 * والتواريخ تُقرأ نصًّا كما هي.
 *
 * نموذج المجال كلُّه يتعامل بسلاسل ISO — والسائق يحوّل `timestamptz` إلى
 * `Date` بمنطقة الخادم الزمنية، فيعود التاريخ مختلفًا باختلاف إعداد الجهاز.
 * فيُترك نصًّا ويُطبَّع في طبقة المخزن، فيبقى ما يُقرأ هو ما كُتب.
 */
types.setTypeParser(types.builtins.TIMESTAMPTZ, (value) => value)
types.setTypeParser(types.builtins.TIMESTAMP, (value) => value)

export type Database = NodePgDatabase<typeof schema>

type Ref = typeof globalThis & { __platePg?: { pool: Pool; db: Database } }

/** رابط الاتّصال من البيئة وحدها — وهو سرٌّ لا يُكتب في الكود ولا يُسجَّل. */
export function databaseUrl(): string | null {
  return process.env.DATABASE_URL?.trim() || null
}

export function isPostgresConfigured(): boolean {
  return databaseUrl() !== null
}

export function getDb(): Database {
  const ref = globalThis as Ref
  if (ref.__platePg) return ref.__platePg.db

  const connectionString = databaseUrl()
  if (!connectionString) {
    throw new Error('DATABASE_URL غير مضبوط — لا اتّصال بقاعدة البيانات')
  }

  const pool = new Pool({
    connectionString,
    /*
     * سقفٌ معتدل: الخادم عمليةٌ واحدة، وبوستجرس الافتراضيّ يقبل ١٠٠ اتّصال.
     * ومَجمعٌ أوسع لا يزيد إنتاجية قاعدةٍ صغيرة، ويستهلك ذاكرتها في اتّصالاتٍ
     * نائمة.
     */
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    /*
     * TLS للمضيف البعيد وحده.
     *
     * قاعدةٌ في الشبكة نفسها (كوليفاي) تُوصَل بلا تشفير، ومضيفٌ خارجيّ **لا
     * يُوصَل بلا** — الجلسات والمبالغ تمرّ في هذا الاتّصال.
     */
    ssl: /\bsslmode=require\b/.test(connectionString) ? { rejectUnauthorized: false } : undefined,
  })

  /*
   * خطأٌ في اتّصالٍ نائم لا يُسقط العملية.
   *
   * `pg` يرمي على مستوى المَجمع حين يُقطع اتّصالٌ خامل — وبلا مستمعٍ هنا يصير
   * ذلك `uncaughtException` فتموت العملية وتسقط المنصّة كلّها لانقطاعٍ عابر.
   */
  pool.on('error', (error) => {
    console.error('[pg] اتّصالٌ خامل سقط:', error.message)
  })

  const db = drizzle(pool, { schema })
  ref.__platePg = { pool, db }
  return db
}

/**
 * معاملةٌ ذرّية — تحلّ محلّ أقفال الذاكرة.
 *
 * مخزن الذاكرة يحرس تزامنه بـ`KeyedMutex` لأنّ العملية واحدة. وقاعدةُ بياناتٍ
 * قد يخاطبها خادمان، فالحارس يجب أن يكون فيها هي: ما يقرأ رصيدًا ثمّ يكتب
 * عليه يلزمه `SELECT … FOR UPDATE` داخل معاملة، وإلّا قرأ اثنان الرصيد نفسه
 * وكتب كلٌّ منهما على قراءته.
 */
export async function withTransaction<T>(run: (tx: Database) => Promise<T>): Promise<T> {
  return getDb().transaction(async (tx) => run(tx as unknown as Database))
}

/** يُغلق المَجمع — للاختبارات وللإطفاء النظيف. */
export async function closeDb(): Promise<void> {
  const ref = globalThis as Ref
  if (!ref.__platePg) return
  await ref.__platePg.pool.end()
  ref.__platePg = undefined
}
