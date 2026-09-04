import { describe, expect, it } from 'vitest'
import { createSeededMemoryStore } from '@/lib/store'

/**
 * جداول الإدارة تُقرأ من أعلاها: ما وقع الآن أوّلًا.
 *
 * وكان بعضها يعكس **ترتيب الإدخال** لا الزمن — يصحّ ما دامت الصفوف تُضاف
 * لحظةَ وقوعها، ويختلّ في كل بيانات مؤرَّخة في الماضي: بذرةً أو استيرادًا أو
 * ترحيلًا. فخرجت الفواتير وأوامر الصرف من الأقدم إلى الأحدث.
 */
const descending = (dates: string[]) =>
  dates.every((value, i) => i === 0 || dates[i - 1] >= value)

describe('ترتيب جداول الإدارة', () => {
  it('كلّها من الأحدث إلى الأقدم', async () => {
    const store = createSeededMemoryStore()

    const table: Record<string, string[]> = {
      'الفواتير الضريبية': (await store.listInvoices()).map((row) => row.issuedAt),
      'أوامر الصرف': (await store.listDisbursements()).map((row) => row.createdAt),
      الصفقات: (await store.listAllOrders()).map((row) => row.createdAt),
      'الحركات المالية': (await store.listLedger()).map((row) => row.createdAt),
      العرابين: (await store.listDeposits()).map((row) => row.createdAt),
      الإعلانات: (await store.listListings()).map((row) => row.createdAt),
      المستخدمون: (await store.listUsers()).map((row) => row.createdAt),
    }

    /*
     * المدفوعات وسجلّ التدقيق خارج الجدول: البذرة لا تُنشئ منهما صفًّا،
     * فلا شيء يُرتَّب. وتأكيدُ ترتيبٍ على جدول فارغ يمرّ دائمًا فيُطمئن بلا
     * سبب — وترتيبهما مضمون بالفرز نفسه في `memory-store`.
     */
    for (const [name, dates] of Object.entries(table)) {
      expect(dates.length, `${name}: البذرة لا تملأ الجدول فلا يختبر ترتيبه`).toBeGreaterThan(1)
      expect(descending(dates), `${name}: مرتّب من الأقدم`).toBe(true)
    }
  })
})

describe('سلامة سلسلة الفواتير', () => {
  /*
   * لا تتعلّق بترتيب ما وصل.
   *
   * كانت تُقرأ بالتسلسل المُعطى، فارتبطت سلامةُ دفترٍ ضريبيّ بترتيب جدولٍ في
   * الواجهة: رُتِّب الجدول بالتاريخ فأعلنت اللوحة السلسلة **مكسورة** وهي
   * سليمة — إنذارٌ كاذب في أخطر ما تعرضه.
   */
  it('سليمة مهما اختلّ ترتيب المُدخَل', async () => {
    const { verifyInvoiceChain } = await import('@/lib/server/invoice-service')
    const store = createSeededMemoryStore()
    const rows = await store.listInvoices()
    expect(rows.length, 'البذرة بلا فواتير فلا سلسلة تُختبر').toBeGreaterThan(1)

    for (const order of [rows, rows.slice().reverse(), rows.slice().sort((a, b) => a.reference.localeCompare(b.reference))]) {
      expect(verifyInvoiceChain(order).ok).toBe(true)
    }
  })

  it('وتُكشف مكسورةً إن عُبث بفاتورة', async () => {
    const { verifyInvoiceChain } = await import('@/lib/server/invoice-service')
    const store = createSeededMemoryStore()
    const rows = await store.listInvoices()

    const tampered = rows.map((row, i) => (i === 0 ? { ...row, totalAmount: row.totalAmount + 1 } : row))
    const result = verifyInvoiceChain(tampered)
    expect(result.ok).toBe(false)
  })
})
