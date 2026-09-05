import { beforeEach, describe, expect, it } from 'vitest'
import { emptyDatabase, MemoryStore, type MemoryDatabase } from '@/lib/store/memory-store'
import { seedDatabase } from '@/lib/store/seed'
import { resetStoreForTests } from '@/lib/store'
import {
  DEFAULT_PAGE_SETTINGS,
  HOW_IT_WORKS_STEPS,
  TRUST_FEATURES,
  type SaleType,
} from '@/lib/domain/types'

let db: MemoryDatabase
let store: MemoryStore

beforeEach(() => {
  db = emptyDatabase()
  seedDatabase(db)
  store = new MemoryStore(db)
  resetStoreForTests(store)
})

describe('صفحات المنصّة', () => {
  it('تبدأ بالنصوص الافتراضية ومنشورةً', async () => {
    const pages = await store.getPageSettings()
    expect(pages.about.title).toBe('من نحن')
    expect(pages.terms.title).toBe('الشروط والأحكام')
    expect(pages.about.published).toBe(true)
    expect(pages.terms.published).toBe(true)
    expect(pages.about.sections.length).toBeGreaterThan(0)
  })

  /*
   * العدد ثابتٌ لأنّ لكلّ خطوةٍ أيقونتها.
   *
   * الأيقونات تبقى في الشيفرة والنصّ يأتي من الإدارة، والترتيب هو الرابط
   * بينهما — فخطوةٌ زائدة تخرج بلا رمز، وناقصةٌ تترك رمزًا بلا خطوة.
   */
  it('عدد الخطوات والبطاقات يطابق عدد الأيقونات في التصميم', () => {
    expect(DEFAULT_PAGE_SETTINGS.howItWorks.sellerSteps).toHaveLength(HOW_IT_WORKS_STEPS)
    expect(DEFAULT_PAGE_SETTINGS.howItWorks.buyerSteps).toHaveLength(HOW_IT_WORKS_STEPS)
    expect(DEFAULT_PAGE_SETTINGS.trust.features).toHaveLength(TRUST_FEATURES)
  })

  it('التعديل يُحفظ ويُختم بوقته وصاحبه', async () => {
    const before = await store.getPageSettings()
    const updated = await store.updatePageSettings({
      about: { ...before.about, title: 'عن السوق', published: false },
      updatedByAdminId: 'adm_1',
    })

    expect(updated.about.title).toBe('عن السوق')
    expect(updated.about.published).toBe(false)
    expect(updated.updatedByAdminId).toBe('adm_1')
    expect(updated.updatedAt).not.toBe(before.updatedAt)
    // وما لم يُمسّ يبقى
    expect(updated.terms.title).toBe(before.terms.title)
  })
})

describe('ظهور الأسئلة حسب طريقة البيع', () => {
  it('كلّ طريقة تُرجع ما اختير لها وحده', async () => {
    const all = await store.listFaq({ publishedOnly: true })
    expect(all.length).toBeGreaterThan(0)

    for (const saleType of ['auction', 'fixed', 'offers'] as SaleType[]) {
      const scoped = await store.listFaq({ publishedOnly: true, saleType })
      for (const item of scoped) {
        expect(item.showOnSaleTypes, `«${item.question}» ليست لهذه الطريقة`).toContain(saleType)
      }
      expect(scoped.length).toBeLessThanOrEqual(all.length)
    }
  })

  /*
   * العربون سؤال المزاد وحده.
   *
   * وهو ما لم تكن الراية الواحدة تفرّق فيه: كانت تُنزل سؤال العربون أسفل لوحةٍ
   * تُشترى بضغطة، ولا عربون فيها أصلًا.
   */
  it('سؤال العربون لا يظهر أسفل البيع المباشر', async () => {
    const fixed = await store.listFaq({ publishedOnly: true, saleType: 'fixed' })
    expect(fixed.some((item) => item.category === 'deposit')).toBe(false)

    const auction = await store.listFaq({ publishedOnly: true, saleType: 'auction' })
    expect(auction.some((item) => item.category === 'deposit')).toBe(true)
  })

  it('ما لا طريقة له يبقى في صفحة الأسئلة وحدها', async () => {
    const [item] = await store.listFaq({ publishedOnly: true })
    await store.updateFaq(item.id, { showOnSaleTypes: [] })

    for (const saleType of ['auction', 'fixed', 'offers'] as SaleType[]) {
      const scoped = await store.listFaq({ publishedOnly: true, saleType })
      expect(scoped.some((row) => row.id === item.id)).toBe(false)
    }
    const all = await store.listFaq({ publishedOnly: true })
    expect(all.some((row) => row.id === item.id)).toBe(true)
  })
})
