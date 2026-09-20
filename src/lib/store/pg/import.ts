import { sql } from 'drizzle-orm'
import { emptyDatabase, type MemoryDatabase } from '../memory-store'
import { seedDatabase } from '../seed'
import { getDb, withTransaction } from './client'
import * as t from './schema'

/**
 * استيراد بذرة الذاكرة إلى القاعدة — **مرّةً على قاعدةٍ فارغة**.
 *
 * المنصّة انتقلت من مخزنٍ يبذر نفسه في كلّ إقلاع إلى قاعدةٍ تبدأ فارغة. وذلك
 * صوابٌ لإطلاقٍ حقيقيّ — بذرةٌ تجريبية في قاعدةٍ فيها مالٌ حقيقيّ تختلط به
 * ولا تُميَّز بعدها. لكنّ منصّةً تُعرض أو تُجرَّب تحتاج ما يملؤها.
 *
 * فهذا بابٌ **صريحٌ يُفتح بقرار**: لا يجري عند الإقلاع، ولا يعمل إلّا على
 * قاعدةٍ لا مستخدمَ فيها ولا إعلان — فلا يُضاعف بياناتٍ قائمة ولا يدهس عملًا.
 */

/** هل القاعدة فارغة؟ وجودُ مستخدمٍ أو إعلانٍ واحدٍ يكفي لمنع الاستيراد. */
export async function isDatabaseEmpty(): Promise<boolean> {
  const db = getDb()
  const [row] = await db.execute<{ n: number }>(
    sql`select (select count(*) from users) + (select count(*) from listings) as n`,
  ).then((result) => result.rows as { n: number }[])
  return Number(row?.n ?? 0) === 0
}

/** يبني البذرة في الذاكرة ثمّ يكتبها في القاعدة. */
export async function importSeed(): Promise<Record<string, number>> {
  if (!(await isDatabaseEmpty())) {
    throw new Error('القاعدة ليست فارغة — الاستيراد لا يقع على بياناتٍ قائمة')
  }

  const memory = emptyDatabase()
  seedDatabase(memory)
  return importDatabase(memory)
}

/**
 * يكتب قاعدة ذاكرةٍ كاملةً في PostgreSQL — في معاملةٍ واحدة.
 *
 * ومعاملةٌ واحدة لا عشرون: استيرادٌ يسقط في منتصفه يترك قاعدةً نصفَ مملوءة،
 * وهي أسوأ من فارغة — يُظنّ العمل تامًّا ويُبنى عليه.
 */
export async function importDatabase(memory: MemoryDatabase): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}

  await withTransaction(async (tx) => {
    const put = async (
      name: string,
      table: Parameters<typeof tx.insert>[0],
      rows: readonly unknown[],
    ) => {
      if (rows.length === 0) return
      /*
       * دفعاتٌ من خمسمئة صفّ.
       *
       * بوستجرس يحدّ معاملات العبارة الواحدة بـ65535، وصفٌّ بأربعين عمودًا
       * يبلغ السقف عند ألفٍ ونصف. والخمسمئة هامشٌ آمنٌ لأعرض جداولنا.
       */
      for (let i = 0; i < rows.length; i += 500) {
        await tx.insert(table).values(rows.slice(i, i + 500) as never)
      }
      counts[name] = rows.length
    }

    await put('users', t.users, memory.users)
    /*
     * **ولا يُستورد الأدمن.** حسابه يُبنى من متغيّرات البيئة عند كلّ دخول، لا
     * من بذرة — فاستيرادُه يصطدم بفرادة البريد، أو يُدخل حسابًا بكلمةٍ من
     * بذرةٍ تجريبية إلى منصّةٍ حيّة، وكلاهما شرّ.
     */
    await put('wallets', t.wallets, [...memory.wallets.values()])
    await put('listings', t.listings, memory.listings)
    await put('bids', t.bids, memory.bids)
    await put('offers', t.offers, memory.offers)
    await put('orders', t.orders, memory.orders)
    await put('deposits', t.deposits, memory.deposits)
    await put('ledger', t.ledger, memory.ledger)
    await put('payments', t.payments, memory.payments)
    await put('platformEntries', t.platformEntries, memory.platformEntries)
    await put('disbursements', t.disbursements, memory.disbursements)
    await put('invoices', t.invoices, memory.invoices)
    await put('notifications', t.notifications, memory.notifications)
    await put('listingEvents', t.listingEvents, memory.events)
    await put('audits', t.audits, memory.audits)
    await put('faq', t.faq, memory.faq)

    /*
     * الإعدادات شرائحُ مستندات — تُكتب بمفاتيحها.
     */
    const slices = {
      brandSettings: memory.brandSettings,
      pageSettings: memory.pageSettings,
      auctionSettings: memory.auctionSettings,
      commissionSettings: memory.commissionSettings,
      paymentSettings: memory.paymentSettings,
      taxSettings: memory.taxSettings,
      mobileSettings: memory.mobileSettings,
    }
    const now = new Date().toISOString()
    await put(
      'settings',
      t.settings,
      Object.entries(slices).map(([key, value]) => ({ key, value, updatedAt: now })),
    )

    /*
     * العدّادات تنتقل معها — وإلّا أعاد أوّلُ إعلانٍ بعد الاستيراد رقمًا
     * مأخوذًا، فسقط على فرادة `reference` أو تكرّر رقمٌ في مراسلة.
     */
    const sequences = Object.entries(memory.referenceCounters).map(([key, value]) => {
      const [kind, year] = key.split(':')
      return { kind, year: Number(year), value }
    })
    /* وعدّاد ترتيب المزايدات يتبع أعلى تسلسلٍ مستورد */
    if (memory.sequence > 0) sequences.push({ kind: 'bid_sequence', year: 0, value: memory.sequence })
    await put('sequences', t.sequences, sequences)
  })

  return counts
}
