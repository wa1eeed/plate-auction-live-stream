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

/**
 * أقفال استشارية — رقمُ نطاقٍ ثابتٌ للمنصّة، ورقمٌ لكلّ قفل.
 *
 * ورقمان لا نصٌّ مُجزّأ: `pg_try_advisory_lock` يأخذ عددين صحيحين، وتجزئةُ
 * نصٍّ إلى عددٍ تُدخل احتمال تصادمٍ يجعل قفلين مختلفين قفلًا واحدًا — وهو
 * عطبٌ لا يظهر إلّا تحت حملٍ نادر.
 */
const LOCK_NAMESPACE = 0x504c_4154 // 'PLAT'
export const LOCKS = { sweep: 1 } as const

/**
 * يُشغّل العمل **إن ظفر بالقفل وحده** — ويُعيد `null` إن كان غيرُه فيه.
 *
 * ولماذا `try` لا الانتظار؟ لأنّ المقصود مسحٌ دوريّ يتكرّر كلّ خمس ثوانٍ: من
 * لم يظفر به الآن لا حاجة به أن ينتظر، فالدورة التالية قريبة. والانتظارُ
 * يكدّس اتّصالاتٍ معلّقة بلا فائدة.
 *
 * ⚠ **والقفل مربوطٌ بالاتّصال لا بالمَجمع.** فيُحجز اتّصالٌ واحد ويُقفل
 * ويُفكّ عليه هو — ولو فُكّ على اتّصالٍ آخر من المَجمع لبقي الأوّل مقفولًا
 * إلى أن يُغلق، فيتوقّف المسح إلى الأبد.
 */
export async function withAdvisoryLock<T>(
  lock: (typeof LOCKS)[keyof typeof LOCKS],
  run: () => Promise<T>,
): Promise<T | null> {
  getDb() // يضمن تهيئة المَجمع
  const ref = globalThis as Ref
  const pool = ref.__platePg?.pool
  if (!pool) return run()

  const client = await pool.connect()
  try {
    const got = await client.query<{ locked: boolean }>(
      'SELECT pg_try_advisory_lock($1, $2) AS locked',
      [LOCK_NAMESPACE, lock],
    )
    if (!got.rows[0]?.locked) return null

    try {
      return await run()
    } finally {
      // يُفكّ ولو سقط العمل — وإلّا بقي مقفولًا حتى يُغلق الاتّصال
      await client.query('SELECT pg_advisory_unlock($1, $2)', [LOCK_NAMESPACE, lock])
    }
  } finally {
    client.release()
  }
}

/** يُغلق المَجمع — للاختبارات وللإطفاء النظيف. */
export async function closeDb(): Promise<void> {
  const ref = globalThis as Ref
  if (!ref.__platePg) return
  await ref.__platePg.pool.end()
  ref.__platePg = undefined
}
