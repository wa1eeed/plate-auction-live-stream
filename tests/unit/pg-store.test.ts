import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { hashPassword } from '@/lib/server/crypto'
import { closeDb, getDb, isPostgresConfigured } from '@/lib/store/pg/client'
import { PostgresStore } from '@/lib/store/pg/store'
import { sql } from 'drizzle-orm'

/**
 * اختبار مخزن Postgres على **قاعدةٍ حقيقية** لا على تقليد.
 *
 * وما يُراد إثباتُه هنا لا يظهر إلّا على قاعدة: الذرّية، والفرادة، وسلوك
 * القفل. ومخزنٌ يُقلَّد بكائنٍ في الذاكرة يُثبت أنّ الكود يُستدعى، لا أنّه
 * صحيح.
 *
 * ويُتخطّى الملفّ كلُّه بلا `DATABASE_URL` — فلا تسقط بوّابة من لا قاعدة عنده.
 */
const configured = isPostgresConfigured()
const when = configured ? describe : describe.skip

const store = new PostgresStore()

when('مخزن Postgres', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../scripts/db-migrate.mjs')
    await migrate(process.env.DATABASE_URL!)
  })

  beforeEach(async () => {
    /* تنظيفٌ بين الاختبارات — والترتيب لا يهمّ فلا مفاتيح أجنبية بعد */
    const db = getDb()
    for (const table of [
      'ledger',
      'wallets',
      'bids',
      'offers',
      'orders',
      'deposits',
      'listings',
      'users',
      'settings',
      'sequences',
      'faq',
      'notifications',
    ]) {
      await db.execute(sql.raw(`TRUNCATE TABLE ${table} CASCADE`))
    }
  })

  afterAll(async () => {
    await closeDb()
  })

  it('المستخدم يُنشأ برقم عضويّة ومحفظة', async () => {
    const user = await store.createUser({
      email: 'A@Demo.SA',
      passwordHash: hashPassword('x'),
      displayName: 'وليد',
    })

    expect(user.reference).toMatch(/^U\d{2}-\d{5}$/)
    // البريد يُخزَّن مخفَّضًا فلا يتكرّر الحساب بصيغتين
    expect(user.email).toBe('a@demo.sa')

    const wallet = await store.getWallet(user.id)
    expect(wallet.balance).toBe(0)
  })

  /*
   * الفرادة في القاعدة لا في الكود.
   *
   * فحصُ التوفّر ثمّ الإدراج سباقٌ يمرّ به طلبان معًا — والقاعدة وحدها تحرسه
   * حرسًا لا يُخترق.
   */
  it('بريدٌ مكرّر يُرفض من القاعدة نفسها', async () => {
    const input = {
      email: 'dup@demo.sa',
      passwordHash: hashPassword('x'),
      displayName: 'أوّل',
    }
    await store.createUser(input)
    await expect(store.createUser({ ...input, displayName: 'ثانٍ' })).rejects.toThrow()
  })

  it('الأرقام المرجعية تتسلسل ولا تتكرّر — ولو طُلبت معًا', async () => {
    const refs = await Promise.all(
      Array.from({ length: 20 }, () => store.nextReference('listing')),
    )
    expect(new Set(refs).size).toBe(20)
  })

  it('الإعدادات تُحفظ وتُقرأ، والحقل الجديد يأخذ افتراضيَّه', async () => {
    await store.updateBrandSettings({ name: 'سوق نجد' })
    const brand = await store.getBrandSettings()

    expect(brand.name).toBe('سوق نجد')
    // لم يُحفظ، فجاء من الافتراضيّ — لا `undefined`
    expect(brand.primaryColor).toMatch(/^#/)
  })

  /*
   * أخطر ما في المنصّة: حركةُ محفظةٍ لا تتضارب.
   *
   * عشر عمليّاتٍ متزامنة على محفظةٍ واحدة يجب أن تنتهي بمجموعها كاملًا. وبلا
   * قفلٍ تقرأ كلُّها الرصيد نفسه فتكتب عليه — ويضيع تسعةُ أعشار المال.
   */
  it('عشر حركاتٍ متزامنة تُجمع كلُّها — لا تضيع واحدة', async () => {
    const user = await store.createUser({
      email: 'money@demo.sa',
      passwordHash: hashPassword('x'),
      displayName: 'صاحب مال',
    })

    await Promise.all(
      Array.from({ length: 10 }, () =>
        store.postLedgerEntry({
          userId: user.id,
          type: 'topup',
          amount: 100_00,
          note: 'شحن',
          listingId: null,
          depositId: null,
          orderId: null,
          actorAdminId: null,
        }),
      ),
    )

    const wallet = await store.getWallet(user.id)
    expect(wallet.balance).toBe(10 * 100_00)

    const entries = await store.listLedger({ userId: user.id })
    expect(entries).toHaveLength(10)
    // أرقام الحركات لا تتكرّر ولو تزامنت
    expect(new Set(entries.map((entry) => entry.reference)).size).toBe(10)
  })

  it('رصيدٌ لا يكفي لا يُسحب منه', async () => {
    const user = await store.createUser({
      email: 'poor@demo.sa',
      passwordHash: hashPassword('x'),
      displayName: 'رصيدٌ قليل',
    })

    await expect(
      store.postLedgerEntry({
        userId: user.id,
        type: 'withdrawal',
        amount: 50_00,
        note: 'سحب',
        listingId: null,
        depositId: null,
        orderId: null,
        actorAdminId: null,
      }),
    ).rejects.toThrow()

    expect((await store.getWallet(user.id)).balance).toBe(0)
  })
})
