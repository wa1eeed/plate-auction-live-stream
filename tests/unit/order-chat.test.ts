import { beforeEach, describe, expect, it } from 'vitest'
import { emptyDatabase, MemoryStore, type MemoryDatabase } from '@/lib/store/memory-store'
import { seedDatabase } from '@/lib/store/seed'
import { resetStoreForTests } from '@/lib/store'
import { buyNow, ServiceError } from '@/lib/server/market-service'
import {
  MAX_MESSAGE_LENGTH,
  listChat,
  sendChatMessage,
} from '@/lib/server/order-chat-service'

/**
 * **محادثةُ الصفقة — ثاني فجوةٍ كشفها الربط.**
 *
 * فالويبُ ما احتاجها: الطرفانِ يخرجان إلى واتساب. وشاشةُ المحادثة في التطبيق
 * كانت ترسم بياناتٍ ساكنة، فلا جدولَ لها ولا مسار.
 */
describe('محادثةُ الصفقة', () => {
  let db: MemoryDatabase
  let store: MemoryStore
  let orderId: string
  let buyerId: string
  let sellerId: string
  let stranger: string

  beforeEach(async () => {
    db = emptyDatabase()
    seedDatabase(db)
    store = new MemoryStore(db)
    resetStoreForTests(store)

    const listing = (await store.listListings({ status: ['active'] })).find(
      (l) => l.saleType === 'fixed',
    )!
    sellerId = listing.sellerId
    buyerId = db.users.find((u) => u.id !== sellerId)!.id
    stranger = db.users.find((u) => u.id !== buyerId && u.id !== sellerId)!.id

    const { order } = await buyNow({
      listingId: listing.id,
      buyerId,
      clientRequestId: 'chat-1',
    })
    orderId = order.id
  })

  it('الطرفانِ يكتبان ويقرآن سجلًّا واحدًا', async () => {
    await sendChatMessage(orderId, buyerId, { kind: 'text', body: 'متى ننقلها؟' })
    await sendChatMessage(orderId, sellerId, { kind: 'text', body: 'بكرة الصباح' })

    const seenByBuyer = await listChat(orderId, buyerId)
    const seenBySeller = await listChat(orderId, sellerId)

    expect(seenByBuyer.map((m) => m.body)).toEqual(['متى ننقلها؟', 'بكرة الصباح'])
    /* والسجلُّ واحدٌ لا سجلَّان — فما يراه هذا يراه ذاك */
    expect(seenBySeller.map((m) => m.id)).toEqual(seenByBuyer.map((m) => m.id))
    expect(seenByBuyer[0].senderId).toBe(buyerId)
  })

  /**
   * **ولا يُقرأ ما بين غيرِك برقمِ صفقة.**
   *
   * فالرقمُ يُخمَّن، والمحادثةُ تحمل ما اتُّفق عليه من سعرٍ وموعدٍ ومكان.
   */
  it('والغريبُ لا يقرأ ولا يكتب', async () => {
    await sendChatMessage(orderId, buyerId, { kind: 'text', body: 'سرٌّ بيننا' })

    await expect(listChat(orderId, stranger)).rejects.toMatchObject({
      status: 403,
      code: 'NOT_YOUR_ORDER',
    })
    await expect(
      sendChatMessage(orderId, stranger, { kind: 'text', body: 'دسٌّ' }),
    ).rejects.toMatchObject({ status: 403 })

    /* ولا تُدسّ رسالتُه في السجلّ */
    expect(await listChat(orderId, buyerId)).toHaveLength(1)
  })

  it('وصفقةٌ لا توجد تردّ ٤٠٤ لا ٤٠٣', async () => {
    await expect(listChat('ord_لا_يوجد', buyerId)).rejects.toMatchObject({
      status: 404,
      code: 'ORDER_NOT_FOUND',
    })
  })

  /** **ورسالةٌ فارغةٌ تُردّ** — فسطرٌ فارغٌ في السجلّ لا يُقرأ ولا يُمحى. */
  it('ولا تُقبل رسالةٌ فارغةٌ ولا طويلةٌ بلا حدّ', async () => {
    for (const body of ['', '   ', null]) {
      await expect(
        sendChatMessage(orderId, buyerId, { kind: 'text', body }),
      ).rejects.toMatchObject({ code: 'EMPTY_MESSAGE' })
    }

    await expect(
      sendChatMessage(orderId, buyerId, {
        kind: 'text',
        body: 'ا'.repeat(MAX_MESSAGE_LENGTH + 1),
      }),
    ).rejects.toMatchObject({ code: 'MESSAGE_TOO_LONG' })

    expect(await listChat(orderId, buyerId)).toHaveLength(0)
  })

  /**
   * **والنصُّ يُشذَّب قبل أن يُحفظ** — فمسافاتُ النهاية تُزحزح الرسالةَ في
   * الفقاعة ولا تحمل معنى.
   */
  it('والنصُّ يُشذَّب', async () => {
    const message = await sendChatMessage(orderId, buyerId, {
      kind: 'text',
      body: '  تمّ  ',
    })
    expect(message.body).toBe('تمّ')
  })

  /** **ومرفقٌ بلا مفتاحٍ رسالةٌ كاذبة** — فقاعةٌ تُرسم لصورةٍ لا تُحمَّل. */
  it('ونوعٌ غيرُ نصٍّ يشترط مفتاحَ وسيط', async () => {
    await expect(
      sendChatMessage(orderId, buyerId, { kind: 'image', body: null }),
    ).rejects.toMatchObject({ code: 'MISSING_MEDIA' })

    const sent = await sendChatMessage(orderId, sellerId, {
      kind: 'image',
      mediaKey: 'media/absher-proof.png',
      fileName: 'absher-proof.png',
      fileSize: 48_201,
    })
    expect(sent.kind).toBe('image')
    expect(sent.mediaKey).toBe('media/absher-proof.png')
    expect(sent.body).toBeNull()
  })

  /**
   * **وصفقةٌ أُغلقت لا مراسلةَ فيها.**
   *
   * فالمحادثةُ أداةُ إتمامٍ لا بابُ مراسلةٍ دائم — ومن أراد مخاطبةَ الطرف
   * الآخر بعد انتهائها فالإدارةُ بينهما.
   */
  it('والمُلغاةُ تُقرأ ولا تُكتب', async () => {
    await sendChatMessage(orderId, buyerId, { kind: 'text', body: 'قبل الإلغاء' })
    await store.updateOrder(orderId, { status: 'cancelled' })

    await expect(
      sendChatMessage(orderId, buyerId, { kind: 'text', body: 'بعده' }),
    ).rejects.toMatchObject({ status: 409, code: 'ORDER_CLOSED' })

    /* والقراءةُ تبقى — فالسجلُّ حجّةٌ بعد الإغلاق أكثرَ منه قبله */
    expect(await listChat(orderId, sellerId)).toHaveLength(1)
  })

  it('والخطأُ يحمل رسالةً عربيّةً تُقرأ', async () => {
    const error: unknown = await listChat(orderId, stranger).catch((e) => e)
    expect((error as ServiceError).message).toMatch(/[؀-ۿ]/)
  })
})
