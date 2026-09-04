import { beforeEach, describe, expect, it } from 'vitest'
import { emptyDatabase, MemoryStore, type MemoryDatabase } from '@/lib/store/memory-store'
import { seedDatabase } from '@/lib/store/seed'
import { resetStoreForTests } from '@/lib/store'
import { parseReference, referenceYear } from '@/lib/domain/reference'
import { hashPassword } from '@/lib/server/crypto'
import { getListingDetail } from '@/lib/server/market-service'

let db: MemoryDatabase
let store: MemoryStore

beforeEach(() => {
  db = emptyDatabase()
  seedDatabase(db)
  store = new MemoryStore(db)
  resetStoreForTests(store)
})

describe('أرقام الإعلانات', () => {
  const yy = referenceYear(Date.now())

  it('البذرة تعطي أرقامًا متتابعة فريدة بصيغة L{سنة}-{تسلسل}', () => {
    const refs = db.listings.map((l) => l.reference)
    expect(new Set(refs).size).toBe(refs.length)
    for (const ref of refs) expect(ref).toMatch(new RegExp(`^L${yy}-\\d{5}$`))
    expect(parseReference(refs[0])!.sequence).toBe(1)
  })

  it('الإعلان الجديد يأخذ الرقم التالي بعد البذرة — لا يُعاد استعمال رقم', async () => {
    const before = db.listings.length
    const { id: _id, reference: _ref, ...rest } = db.listings[0]
    const created = await store.createListing({ ...rest, plateNumbers: '7777' })
    expect(parseReference(created.reference)!.sequence).toBe(before + 1)
  })

  it('الأرقام تبقى فريدة مع إنشاء متزامن — وهذا ما تعنيه منصّة متعدّدة المستخدمين', async () => {
    const { id: _id, reference: _ref, ...rest } = db.listings[0]
    const created = await Promise.all(
      Array.from({ length: 25 }, () => store.createListing({ ...rest })),
    )
    const refs = created.map((l) => l.reference)
    expect(new Set(refs).size).toBe(25)
  })

  it('الحذف لا يُعيد استعمال الرقم', async () => {
    const { id: _id, reference: _ref, ...rest } = db.listings[0]
    const first = await store.createListing({ ...rest })
    await store.deleteListing(first.id)
    const second = await store.createListing({ ...rest })
    expect(parseReference(second.reference)!.sequence).toBe(
      parseReference(first.reference)!.sequence + 1,
    )
  })

  it('الرقم لا يتغيّر بتعديل الإعلان', async () => {
    const listing = db.listings[0]
    const updated = await store.updateListing(listing.id, { plateNumbers: '1111' })
    expect(updated.reference).toBe(listing.reference)
  })

  it('يظهر في حمولة الإعلان العامة', async () => {
    const listing = db.listings.find((l) => l.status === 'active')!
    const detail = await getListingDetail(listing.id, null)
    expect(detail?.reference).toBe(listing.reference)
  })
})

describe('أرقام العضوية', () => {
  it('البذرة تعطي أرقامًا متتابعة فريدة بصيغة U{سنة}-{تسلسل}', () => {
    const refs = db.users.map((u) => u.reference)
    expect(new Set(refs).size).toBe(refs.length)
    for (const ref of refs) expect(ref).toMatch(new RegExp(`^U${referenceYear(Date.now())}-\\d{5}$`))
  })

  it('المستخدم الجديد يأخذ الرقم التالي', async () => {
    const before = db.users.length
    const created = await store.createUser({
      email: 'new@demo.sa',
      passwordHash: await hashPassword('demo1234'),
      displayName: 'مستخدم جديد',
      phone: null,
    })
    expect(parseReference(created.reference)!.sequence).toBe(before + 1)
  })

  it('التسجيل المتزامن لا ينتج رقمين متطابقين', async () => {
    const hash = await hashPassword('demo1234')
    const created = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        store.createUser({
          email: `bulk${index}@demo.sa`,
          passwordHash: hash,
          displayName: `مستخدم ${index}`,
          phone: null,
        }),
      ),
    )
    expect(new Set(created.map((u) => u.reference)).size).toBe(20)
  })

  it('بريد مكرّر يُرفض ولا يستهلك رقمًا', async () => {
    const hash = await hashPassword('demo1234')
    const key = `user:${referenceYear(Date.now())}`
    const before = db.referenceCounters[key]
    await expect(
      store.createUser({
        email: db.users[0].email,
        passwordHash: hash,
        displayName: 'مكرّر',
        phone: null,
      }),
    ).rejects.toThrow()
    expect(db.referenceCounters[key]).toBe(before)
  })

  it('رقم العضوية لا يظهر في حمولة الإعلان العامة', async () => {
    const listing = db.listings.find((l) => l.status === 'active')!
    const detail = await getListingDetail(listing.id, null)
    expect(Object.keys(detail!.seller)).not.toContain('reference')
  })
})
