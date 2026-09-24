import { beforeEach, describe, expect, it } from 'vitest'
import { emptyDatabase, MemoryStore, type MemoryDatabase } from '@/lib/store/memory-store'
import { seedDatabase } from '@/lib/store/seed'
import { resetStoreForTests } from '@/lib/store'
import {
  accountDeletionBlockers,
  DISABLED_ACCOUNT_MESSAGE,
  reactivateUser,
  requestAccountDeletion,
} from '@/lib/server/account-service'

let db: MemoryDatabase
let store: MemoryStore

/** مستخدمٌ نظيف — يُنشأ ولا يُبحث عنه: كلُّ مستخدمي البذرة لهم إعلانات. */
let n = 0
async function clean(): Promise<string> {
  n += 1
  const user = await store.createUser({
    email: `clean${n}@demo.sa`,
    passwordHash: 'x',
    displayName: `نظيف ${n}`,
    phone: null,
  })
  return user.id
}

beforeEach(() => {
  db = emptyDatabase()
  seedDatabase(db)
  store = new MemoryStore(db)
  resetStoreForTests(store)
})

/**
 * **حذفُ الحساب تعطيلٌ لا محو — وآبل تشترط وجودَه داخل التطبيق.**
 *
 * ومحوُ الصفّ محوٌ لتاريخٍ ماليّ تقابله صفقاتٌ وقيودُ محفظةٍ وفواتير: فتصير
 * طلباتٌ بلا مشترٍ، وقيودٌ بلا صاحب، وفاتورةٌ ضريبية بلا طرف. وهذه ليست
 * بيانات المستخدم وحده — الطرف الآخر شريكٌ فيها.
 */
describe('حذفُ الحساب — تعطيلٌ بشروطه', () => {
  it('حسابٌ بلا التزامات يُعطَّل، ويُقيَّد سببُه أنّه بطلب صاحبه', async () => {
    const id = await clean()
    expect(await accountDeletionBlockers(id)).toEqual([])

    const user = await requestAccountDeletion(id)

    expect(user.disabledAt).not.toBeNull()
    expect(user.disabledReason).toBe('self_requested')
  })

  it('وتعطيلُ ما هو معطَّل لا يرمي ولا يبدّل لحظتَه', async () => {
    const id = await clean()
    const first = await requestAccountDeletion(id)
    const again = await requestAccountDeletion(id)
    expect(again.disabledAt).toBe(first.disabledAt)
  })

  /*
   * **العوائقُ حمايةٌ للطرف الآخر لا للمنصّة.**
   *
   * فمن باع وقبض ولم ينقل الملكيّة، تعطيلُه يترك المشتري بمالٍ محجوزٍ
   * وبائعٍ لا يُبلَغ. ولو سقط هذا الحارس لَوقع ذلك بضغطة زرّ.
   */
  it('وصفقةٌ لم يستقرّ مالُها تمنع — بائعًا كان أو مشتريًا', async () => {
    const order = db.orders.find((o) => o.status === 'awaiting_settlement')!

    for (const side of [order.buyerId, order.sellerId]) {
      const blockers = await accountDeletionBlockers(side)
      expect(blockers.some((b) => b.kind === 'open_orders'), side).toBe(true)
      await expect(requestAccountDeletion(side)).rejects.toThrow(/صفقة/)
    }
  })

  it('وإعلانٌ قائم يمنع — ولو كان مسودّة', async () => {
    const id = await clean()
    await store.createListing({
      sellerId: id,
      plate: { letters: 'ا ب ج', digits: '1234', kind: 'private' },
      title: 'لوحة',
      description: null,
      saleType: 'direct',
      price: 100_000,
      reservePrice: null,
      startsAt: null,
      endsAt: null,
      status: 'draft',
    } as never)

    const blockers = await accountDeletionBlockers(id)
    expect(blockers.some((b) => b.kind === 'live_listings')).toBe(true)
  })

  it('ومالٌ محجوزٌ في صفقةٍ جارية يمنع — فالحجزُ عهدةٌ لا رصيد', async () => {
    const id = await clean()
    await store.postLedgerEntry({
      userId: id, type: 'topup', amount: 50_000, note: null,
      listingId: null, depositId: null, orderId: null, actorAdminId: null,
    })
    /* والحجزُ ينقل من الرصيد إلى المحجوز — لا يزيد المال */
    await store.postLedgerEntry({
      userId: id, type: 'deposit_hold', amount: 50_000, note: null,
      listingId: null, depositId: null, orderId: null, actorAdminId: null,
    })

    const blockers = await accountDeletionBlockers(id)
    expect(blockers.some((b) => b.kind === 'held_funds')).toBe(true)
  })

  it('ورصيدٌ متاحٌ يمنع — فتعطيلُه حبسٌ لمال صاحبه', async () => {
    const id = await clean()
    await store.postLedgerEntry({
      userId: id, type: 'topup', amount: 50_000, note: null,
      listingId: null, depositId: null, orderId: null, actorAdminId: null,
    })

    const blockers = await accountDeletionBlockers(id)
    expect(blockers.some((b) => b.kind === 'wallet_balance')).toBe(true)
    await expect(requestAccountDeletion(id)).rejects.toThrow(/رصيد/)
  })

  /*
   * وبين عرض العوائق وضغط التأكيد قد تُفتح صفقة — فالفحصُ **عند الفعل** هو
   * الحارس، لا الذي تقرؤه الواجهة عند الفتح.
   */
  it('والفحصُ يقع عند التنفيذ لا عند العرض وحده', async () => {
    const order = db.orders.find((o) => o.status === 'awaiting_settlement')!
    await expect(requestAccountDeletion(order.buyerId)).rejects.toMatchObject({ status: 409 })
  })

  describe('إعادةُ التفعيل', () => {
    it('الإدارة تعيده، ويُقيَّد في سجلّ التدقيق', async () => {
      const id = await clean()
      await requestAccountDeletion(id)
      const before = db.audits.length

      const user = await reactivateUser(id, db.admins[0].id)

      expect(user.disabledAt).toBeNull()
      expect(user.disabledReason).toBeNull()
      expect(db.audits.length).toBe(before + 1)
      expect(db.audits.at(-1)?.action).toBe('user.reactivate')
    })

    it('وإعادةُ تفعيل العامل لا ترمي ولا تُقيَّد', async () => {
      const id = await clean()
      const before = db.audits.length
      await reactivateUser(id, db.admins[0].id)
      expect(db.audits.length).toBe(before)
    })
  })

  it('والرسالةُ واحدةٌ في كلّ موضع — لا نصّان لحالةٍ واحدة', () => {
    expect(DISABLED_ACCOUNT_MESSAGE).toMatch(/معطَّل/)
    expect(DISABLED_ACCOUNT_MESSAGE).toMatch(/خدمة العملاء/)
  })
})
