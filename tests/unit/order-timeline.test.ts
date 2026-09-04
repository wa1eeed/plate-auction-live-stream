import { describe, expect, it } from 'vitest'
import {
  adminOrderBucket,
  buildOrderSettlement,
  buildOrderTimeline,
  currentOrderStage,
  orderBucket,
  orderMoneyMarker,
} from '@/lib/domain/order-timeline'
import { riyalsToHalalas } from '@/lib/domain/money'
import type { Order } from '@/lib/domain/types'
import { formatTimestamp } from '@/lib/utils'

const AT = '2026-09-02T09:00:00.000Z'
const DUE = '2026-09-04T09:00:00.000Z'

const order = (overrides: Partial<Order> = {}): Order =>
  ({
    id: 'ord_1',
    reference: 'S26-00001',
    listingId: 'lst_1',
    buyerId: 'usr_buyer',
    sellerId: 'usr_seller',
    amount: riyalsToHalalas(35_000),
    source: 'auction',
    status: 'awaiting_settlement',
    remindersSent: [],
    paymentDueAt: DUE,
    depositId: 'dep_1',
    createdAt: AT,
    completedAt: null,
    paidAt: null,
    escrowAmount: 0,
    transferDueAt: null,
    transferProofNote: null,
    transferProofAt: null,
    confirmDueAt: null,
    disputedAt: null,
    disputeReason: null,
    disputedBy: null,
    payoutLedgerEntryId: null,
    releasedAt: null,
    ...overrides,
  }) as Order

describe('التفصيل المالي للصفقة', () => {
  it('العربون المحجوز يُنقص المطلوب سداده قبل خصمه', () => {
    const settlement = buildOrderSettlement(
      order(),
      { amount: riyalsToHalalas(4_000), status: 'held' },
      null,
      'buyer',
    )
    // 35,000 − 4,000: المشتري يحوّل 31,000 لا 35,000
    expect(settlement.net).toBe(riyalsToHalalas(31_000))
    expect(settlement.depositApplied).toBe(0)
    expect(settlement.settled).toBe(false)
  })

  it('بعد الإتمام يصير العربون مخصومًا فعلًا', () => {
    const settlement = buildOrderSettlement(
      order({ status: 'completed', completedAt: AT }),
      { amount: riyalsToHalalas(4_000), status: 'applied' },
      null,
      'buyer',
    )
    expect(settlement.depositApplied).toBe(riyalsToHalalas(4_000))
    expect(settlement.net).toBe(riyalsToHalalas(31_000))
    expect(settlement.settled).toBe(true)
  })

  it('بلا عربون: المطلوب هو القيمة كاملة', () => {
    const settlement = buildOrderSettlement(order(), null, null, 'buyer')
    expect(settlement.net).toBe(riyalsToHalalas(35_000))
    expect(settlement.deposit).toBe(0)
  })

  it('العربون المُصادَر لا يُنقص المطلوب — خرج ولم يُحتسب من الثمن', () => {
    const settlement = buildOrderSettlement(
      order({ status: 'defaulted' }),
      { amount: riyalsToHalalas(4_000), status: 'forfeited' },
      null,
      'buyer',
    )
    expect(settlement.depositApplied).toBe(0)
    expect(settlement.net).toBe(riyalsToHalalas(35_000))
  })
})

describe('مسار الصفقة', () => {
  const now = Date.parse('2026-09-03T09:00:00.000Z')
  const steps = (o: Order, deposit: Parameters<typeof buildOrderSettlement>[1] = null) =>
    buildOrderTimeline(o, buildOrderSettlement(o, deposit, null, 'buyer'), now, 'buyer')

  it('خمس مراحل ثابتة مهما كانت النتيجة', () => {
    const shapes = [
      steps(order()),
      steps(order({ status: 'escrow_held', paidAt: AT })),
      steps(order({ status: 'completed', completedAt: AT, paidAt: AT, releasedAt: AT })),
      steps(order({ status: 'refunded', completedAt: AT, paidAt: AT })),
      steps(order({ status: 'disputed', paidAt: AT, disputedAt: AT })),
      steps(order({ status: 'cancelled' })),
    ]
    for (const shape of shapes) {
      expect(shape.map((s) => s.key)).toEqual(['created', 'paid', 'transfer', 'confirm', 'released'])
    }
  })

  it('قبل السداد: الدور على المشتري وما بعده منتظَر', () => {
    const [created, paid, transfer, confirm, released] = steps(order(), {
      amount: riyalsToHalalas(4_000),
      status: 'held',
    })
    expect(created.state).toBe('done')
    expect(paid.state).toBe('current')
    // لا يبدأ نقل الملكية قبل وصول المال
    expect(transfer.state).toBe('pending')
    expect(confirm.state).toBe('pending')
    expect(released.state).toBe('pending')
  })

  it('بعد الحجز: الدور على البائع', () => {
    const shape = steps(order({ status: 'escrow_held', paidAt: AT }), {
      amount: riyalsToHalalas(4_000),
      status: 'applied',
    })
    expect(shape[1].state).toBe('done')
    expect(shape[1].label).toMatch(/حُجز أمانةً/)
    expect(shape[2].state).toBe('current')
  })

  it('بعد رفع الإثبات: الدور على الإدارة لا على طرف', () => {
    const shape = steps(
      order({ status: 'ownership_transferred', paidAt: AT, transferProofAt: AT, confirmDueAt: DUE }),
    )
    expect(shape[2].state).toBe('done')
    expect(shape[3].state).toBe('current')
    expect(shape[3].label).toMatch(/الإدارة/)
    // ولا يُوعَد المشتري بإفراج يقع بسكوته
    expect(shape[3].hint).not.toMatch(/تلقائيًا بانقضاء/)
  })

  it('الإفراج يُنهي المسار كلّه منجزًا', () => {
    const shape = steps(
      order({
        status: 'completed',
        paidAt: AT,
        transferProofAt: AT,
        releasedAt: AT,
        completedAt: AT,
      }),
      { amount: riyalsToHalalas(4_000), status: 'applied' },
    )
    expect(shape.every((s) => s.state === 'done')).toBe(true)
    expect(shape[4].label).toMatch(/ذهب المبلغ إلى البائع/)
  })

  it('الاسترداد يُعلَّم إخفاقًا لا إنجازًا', () => {
    const shape = steps(order({ status: 'refunded', paidAt: AT, completedAt: AT }))
    expect(shape[1].state).toBe('done')
    expect(shape[4].state).toBe('failed')
    expect(shape[4].label).toMatch(/عاد المبلغ إلى محفظتك/)
  })

  it('الاعتراض يُظهر سببه في موضع التأكيد', () => {
    const shape = steps(
      order({ status: 'disputed', paidAt: AT, transferProofAt: AT, disputedAt: AT, disputeReason: 'لم تُنقل' }),
    )
    expect(shape[3].state).toBe('failed')
    expect(shape[3].hint).toBe('لم تُنقل')
  })

  it('تجاوز مهلة السداد يُعلَّم إخفاقًا', () => {
    const overdue = steps(order({ paymentDueAt: '2026-09-02T10:00:00.000Z' }))
    expect(overdue.find((s) => s.key === 'paid')!.state).toBe('failed')
  })

  it('مصدر الصفقة يُذكر في أول مرحلة', () => {
    expect(steps(order({ source: 'auction' }))[0].label).toMatch(/رست/)
    expect(steps(order({ source: 'fixed' }))[0].label).toMatch(/اشتريت/)
    expect(steps(order({ source: 'offer' }))[0].label).toMatch(/عرضك/)
  })
})

describe('المرحلة الراهنة ولمن الدور', () => {
  const now = Date.parse('2026-09-03T09:00:00.000Z')
  const stage = (o: Order, side: 'buyer' | 'seller') =>
    currentOrderStage(
      buildOrderTimeline(o, buildOrderSettlement(o, null, null, side), now, side),
      o,
      side,
    )

  it('قبل السداد: الدور على المشتري لا على البائع', () => {
    const o = order()
    expect(stage(o, 'buyer').audience).toBe('you')
    expect(stage(o, 'seller').audience).toBe('other')
    // ولا مهلة ضمان بعد — مهلة السداد شأن المحطّة نفسها
    expect(stage(o, 'buyer').deadline).toBeNull()
  })

  it('بعد الحجز: الدور على البائع، ومهلته مهلة النقل', () => {
    const o = order({ status: 'escrow_held', paidAt: AT, transferDueAt: DUE })
    expect(stage(o, 'seller').audience).toBe('you')
    expect(stage(o, 'buyer').audience).toBe('other')
    expect(stage(o, 'seller').deadline).toBe(DUE)
    expect(stage(o, 'seller').step.key).toBe('transfer')
  })

  /*
   * الإفراج قرار إدارة: لا يُطالَب المشتري بتأكيد ولا يُفرج المال بسكوته.
   */
  it('بعد رفع الإثبات: لا دور على طرف — الإدارة تتحقّق', () => {
    const o = order({
      status: 'ownership_transferred',
      paidAt: AT,
      transferProofAt: AT,
      confirmDueAt: DUE,
    })
    expect(stage(o, 'buyer').audience).toBe('other')
    expect(stage(o, 'seller').audience).toBe('other')
    expect(stage(o, 'buyer').step.key).toBe('confirm')
  })

  /*
   * الحالات النهائية لا دور فيها لأحد.
   *
   * ولو قال الحساب «الدور عليك» في صفقة اكتملت أو رُدّت لبحث صاحبها عن زرّ
   * لا وجود له.
   */
  it('الحالات المغلقة: لا دور على أحد ولا مهلة', () => {
    for (const status of ['completed', 'refunded', 'cancelled', 'disputed'] as const) {
      const o = order({ status, paidAt: AT, completedAt: AT, confirmDueAt: DUE })
      for (const side of ['buyer', 'seller'] as const) {
        expect(stage(o, side).audience, status).toBe('other')
        expect(stage(o, side).deadline, status).toBeNull()
      }
    }
  })

  it('بلا محطّة جارية تُبرَز المُخفقة لا الأخيرة', () => {
    const o = order({ status: 'disputed', paidAt: AT, transferProofAt: AT, disputedAt: AT })
    expect(stage(o, 'buyer').step.key).toBe('confirm')
  })
})

describe('صوت الطرفين', () => {
  const now = Date.parse('2026-09-03T09:00:00.000Z')
  const voices = (o: Order) => ({
    buyer: buildOrderTimeline(o, buildOrderSettlement(o, null, null, 'buyer'), now, 'buyer'),
    seller: buildOrderTimeline(o, buildOrderSettlement(o, null, null, 'seller'), now, 'seller'),
  })

  /*
   * العيب الذي أنتج هذا الملفّ: `buildOrderTimeline` لم تكن تعرف لمن تتحدّث،
   * فكان البائع يقرأ في «مبيعاتي» صفحةً مكتوبة للمشتري.
   */
  it('البائع لا يُقال له «اشتريت» ولا «رست عليك»', () => {
    for (const source of ['auction', 'offer', 'fixed'] as const) {
      const { buyer, seller } = voices(order({ source }))
      expect(seller[0].label).not.toMatch(/اشتريت|رست اللوحة عليك|عرضك/)
      expect(seller[0].label).not.toBe(buyer[0].label)
    }
  })

  it('المال يُنسب إلى صاحبه: «مبلغك» للمشتري و«مبلغ المشتري» للبائع', () => {
    const { buyer, seller } = voices(order({ status: 'escrow_held', paidAt: AT }))
    expect(buyer[1].label).toMatch(/مبلغك/)
    expect(seller[1].label).toMatch(/مبلغ المشتري/)
    expect(seller[1].label).not.toMatch(/مبلغك/)
  })

  it('البائع لا يُحدَّث عن نفسه بضمير الغائب', () => {
    const transferred = order({ status: 'ownership_transferred', paidAt: AT, transferProofAt: AT })
    const { buyer, seller } = voices(transferred)
    expect(buyer[2].label).toMatch(/نقل البائع/)
    expect(seller[2].label).toMatch(/نقلتَ/)
    // ولا يُطلب منه أن يراجع إثبات نفسه
    expect(seller[2].hint).not.toMatch(/راجِع/)
  })

  it('محطّة التحقّق واحدة للطرفين — فالدور فيها لغيرهما', () => {
    const { buyer, seller } = voices(order({ status: 'ownership_transferred', paidAt: AT, transferProofAt: AT }))
    expect(buyer[3].label).toBe('تحقّق الإدارة من النقل')
    expect(seller[3].label).toBe(buyer[3].label)
    // والمشتري يُطمأن أنه غير مطالَب بشيء
    expect(buyer[3].hint).toMatch(/لا مطلوب منك/)
  })

  it('الإفراج: «للبائع» عند المشتري و«لك» عند البائع', () => {
    const done = order({ status: 'completed', paidAt: AT, transferProofAt: AT, releasedAt: AT, completedAt: AT })
    const { buyer, seller } = voices(done)
    expect(buyer[4].label).toBe('ذهب المبلغ إلى البائع')
    expect(seller[4].label).toBe('وصل عائدك إلى محفظتك')
  })

  it('اسم المحطّة كلمة واحدة — وهي نفسها للطرفين لأنها تسمّي المرحلة لا الفاعل', () => {
    const { buyer, seller } = voices(order({ status: 'escrow_held', paidAt: AT }))
    expect(buyer.map((s) => s.short)).toEqual(['طلب', 'سداد', 'نقل', 'تحقّق', 'تحويل'])
    expect(seller.map((s) => s.short)).toEqual(buyer.map((s) => s.short))
    // وقصيرة فعلًا: خمس كلمات طويلة تحت خمس نقاط تتكسّر على 360px
    for (const step of buyer) expect(step.short.length).toBeLessThanOrEqual(6)
  })

  it('المحطّة الأخيرة تسمّي النتيجة لا المرحلة', () => {
    const at = { paidAt: AT, completedAt: AT }
    expect(voices(order({ ...at, status: 'completed', releasedAt: AT })).buyer[4].short).toBe('تم')
    expect(voices(order({ ...at, status: 'refunded' })).buyer[4].short).toBe('عاد إليك')
    expect(voices(order({ status: 'cancelled' })).buyer[4].short).toBe('أُغلقت')
  })

  it('نسبة احتراق المهلة تُحسب للمرحلة الجارية وحدها وتبقى في [0,1]', () => {
    // بدأت 02/09 وتنتهي 04/09، والآن 03/09 — أي منتصف المهلة
    const midway = buildOrderTimeline(order(), buildOrderSettlement(order(), null, null, 'buyer'), now, 'buyer')
    expect(midway[1].progress).toBeCloseTo(0.5, 2)
    expect(midway[0].progress).toBeUndefined()
    // وقُبيل انقضائها تبلغ حافّتها
    const nearly = buildOrderTimeline(
      order(),
      buildOrderSettlement(order(), null, null, 'buyer'),
      Date.parse('2026-09-04T04:12:00.000Z'),
      'buyer',
    )
    expect(nearly[1].progress).toBeCloseTo(0.9, 2)
    // وبانقضائها تتعثّر المحطّة، فالشريط لا يمتلئ بل يحمرّ
    const late = buildOrderTimeline(
      order(),
      buildOrderSettlement(order(), null, null, 'buyer'),
      Date.parse('2026-09-30T09:00:00.000Z'),
      'buyer',
    )
    expect(late[1].state).toBe('failed')
    expect(late[1].progress).toBeUndefined()
  })
})

describe('حالات لا تُقال فيها الجملة المعتادة', () => {
  const now = Date.parse('2026-09-03T09:00:00.000Z')
  const voices = (o: Order, deposit: Parameters<typeof buildOrderSettlement>[1] = null) => ({
    buyer: buildOrderTimeline(o, buildOrderSettlement(o, deposit, null, 'buyer'), now, 'buyer'),
    seller: buildOrderTimeline(o, buildOrderSettlement(o, deposit, null, 'seller'), now, 'seller'),
  })

  /*
   * صفقة أُفرجت بقرار إدارة بعد اعتراض: قول «أذن المشتري بالإفراج» فيها كذبٌ
   * يمحو خصومةً وقعت، ويُربك من يقرأ سجلّه بعد شهر.
   */
  it('الإفراج بعد اعتراض يُنسب إلى الإدارة لا إلى إذن المشتري', () => {
    const { buyer, seller } = voices(
      order({
        status: 'completed',
        paidAt: AT,
        transferProofAt: AT,
        disputedAt: AT,
        disputedBy: 'usr_buyer',
        releasedAt: AT,
        completedAt: AT,
      }),
    )
    expect(buyer[3].label).toBe('حسمت الإدارة الاعتراض')
    expect(buyer[3].hint).toMatch(/الإدارة/)
    expect(seller[3].hint).toMatch(/تحويل المبلغ لك/)
    // ولا يُقال إن المشتري أذن
    expect(buyer[3].hint).not.toMatch(/أكّدت|انتهت مهلتك/)
  })

  it('«اعتراضك» غير «اعتراض الطرف الآخر» — والفرق يغيّر الموقف', () => {
    const byBuyer = voices(
      order({ status: 'disputed', paidAt: AT, transferProofAt: AT, disputedAt: AT, disputedBy: 'usr_buyer' }),
    )
    expect(byBuyer.buyer[3].label).toBe('اعتراضك قيد المراجعة')
    expect(byBuyer.seller[3].label).toBe('اعتراض المشتري قيد المراجعة')

    const bySeller = voices(
      order({ status: 'disputed', paidAt: AT, transferProofAt: AT, disputedAt: AT, disputedBy: 'usr_seller' }),
    )
    expect(bySeller.seller[3].label).toBe('اعتراضك قيد المراجعة')
    expect(bySeller.buyer[3].label).toBe('اعتراض البائع قيد المراجعة')
  })

  it('انقضاء مهلة النقل يُعلَن، ويُذكر لكلٍّ ما يملكه عندها', () => {
    const overdue = order({
      status: 'escrow_held',
      paidAt: AT,
      transferDueAt: '2026-09-02T12:00:00.000Z',
    })
    const { buyer, seller } = voices(overdue)
    expect(buyer[2].state).toBe('failed')
    expect(buyer[2].hint).toMatch(/تطلب استرداد مبلغك/)
    expect(seller[2].hint).toMatch(/انقلها الآن/)
  })

  /*
   * البائع في صفقة متخلّفة يسأل سؤالًا واحدًا: هل لوحتي باقية باسمي؟
   */
  it('الصفقة المُغلقة تطمئن البائع على لوحته لا على ماله', () => {
    const { seller } = voices(order({ status: 'defaulted' }))
    expect(seller[4].hint).toMatch(/لوحتك باقية باسمك/)
  })

  it('العربون المُصادَر يُذكر لمن خسره ولمن لم يقبضه', () => {
    const forfeited = voices(order({ status: 'defaulted' }), {
      amount: riyalsToHalalas(4_000),
      status: 'forfeited',
    })
    expect(forfeited.buyer[4].hint).toMatch(/صودر من عربونك/)
    expect(forfeited.seller[4].hint).toMatch(/لا عائد لك/)
  })

  it('البائع لا يُدعى إلى نقل ملكية لم يصل مقابلها', () => {
    const { seller } = voices(order())
    expect(seller[1].hint).toBe('لا تنقل الملكية قبل أن يصل مبلغه')
  })
})

describe('كوم الصفقات', () => {
  const now = Date.parse('2026-09-03T09:00:00.000Z')

  /*
   * التقسيم بالدور لا بالمرحلة: ثلاث كوم ثابتة لا تزيد بزيادة الحالات.
   */
  it('كل حالة مفتوحة تقع عند صاحب دورها، والطرف الآخر يراها «ماشية»', () => {
    const cases = [
      ['awaiting_settlement', 'buyer'],
      ['escrow_held', 'seller'],
    ] as const
    for (const [status, turn] of cases) {
      const other = turn === 'buyer' ? 'seller' : 'buyer'
      expect(orderBucket(order({ status }), turn), status).toBe('you')
      expect(orderBucket(order({ status }), other), status).toBe('running')
    }
  })

  it('ما دام الدور على الإدارة فالصفقة «تحت الإجراء» عند الطرفين', () => {
    for (const status of ['disputed', 'ownership_transferred'] as const) {
      for (const side of ['buyer', 'seller'] as const) {
        expect(orderBucket(order({ status }), side), status).toBe('running')
      }
    }
  })

  it('الحالات النهائية كلّها «خلصت»', () => {
    for (const status of ['completed', 'refunded', 'cancelled', 'defaulted'] as const) {
      for (const side of ['buyer', 'seller'] as const) {
        expect(orderBucket(order({ status }), side), status).toBe('done')
      }
    }
  })

  /*
   * والأدمن محوره الاستثناء: لا يعمل على صفقة تمشي بلا يده.
   */
  it('الأدمن يرى في كومته ما تعثّر وحده', () => {
    const bucket = (o: Order, overdue = false) => adminOrderBucket(o, { overdue }, now)

    expect(bucket(order({ status: 'disputed' }))).toBe('you')
    expect(bucket(order({ status: 'awaiting_settlement' }), true)).toBe('you')
    expect(
      bucket(order({ status: 'escrow_held', transferDueAt: '2026-09-02T09:00:00.000Z' })),
    ).toBe('you')

    // وما مشى في موعده لا يشغله
    expect(bucket(order({ status: 'awaiting_settlement' }))).toBe('running')
    expect(
      bucket(order({ status: 'escrow_held', transferDueAt: '2026-09-30T09:00:00.000Z' })),
    ).toBe('running')
    // والإفراج قرارها، فما نُقلت ملكيته ينتظرها لا يمضي بلا يدها
    expect(bucket(order({ status: 'ownership_transferred' }))).toBe('you')
    expect(bucket(order({ status: 'completed' }))).toBe('done')
  })
})

describe('أين المال الآن', () => {
  it('قبل السداد: لم يغادر المشتري', () => {
    expect(orderMoneyMarker(order(), 'buyer')?.tone).toBe('pending')
    expect(orderMoneyMarker(order(), 'seller')?.short).toBe('لم يصل')
  })

  it('بعد السداد وقبل الإفراج: أمانة لدى المنصّة لا عند أحدهما', () => {
    for (const status of ['escrow_held', 'ownership_transferred', 'disputed'] as const) {
      for (const side of ['buyer', 'seller'] as const) {
        const marker = orderMoneyMarker(order({ status, paidAt: AT }), side)
        expect(marker?.tone, status).toBe('held')
        expect(marker?.short, status).toBe('أمانة')
      }
    }
  })

  it('بعد الإفراج: عند البائع — ويقرأ كلٌّ ذلك بلغته', () => {
    const done = order({ status: 'completed', paidAt: AT, releasedAt: AT })
    expect(orderMoneyMarker(done, 'seller')?.short).toBe('وصلك')
    expect(orderMoneyMarker(done, 'buyer')?.short).toBe('للبائع')
  })

  it('الاسترداد يُعيد المال إلى أوّل المسار', () => {
    const back = orderMoneyMarker(order({ status: 'refunded', paidAt: AT }), 'buyer')
    expect(back?.index).toBe(0)
    expect(back?.tone).toBe('failed')
  })

  it('صفقة لم يتحرّك فيها مال لا علامة لها', () => {
    expect(orderMoneyMarker(order({ status: 'cancelled' }), 'buyer')).toBeNull()
    expect(orderMoneyMarker(order({ status: 'defaulted' }), 'seller')).toBeNull()
  })
})

describe('التفصيل المالي بحسب الطرف', () => {
  const commission = {
    base: riyalsToHalalas(875),
    vat: riyalsToHalalas(131),
    total: riyalsToHalalas(1_006),
  }

  /*
   * العيب: بطاقة البائع كانت تجمع العمولة إلى قيمة الصفقة وتسمّيها «المطلوب
   * سداده» — فتقول لمن يقبض إنه يدفع، وبرقم أكبر من قيمة صفقته.
   */
  it('العمولة تُضاف على من يدفع وتُطرح ممّن يقبض', () => {
    const buyer = buildOrderSettlement(order(), null, commission, 'buyer')
    const seller = buildOrderSettlement(order(), null, commission, 'seller')
    expect(buyer.net).toBe(riyalsToHalalas(36_006))
    expect(seller.net).toBe(riyalsToHalalas(33_994))
    expect(seller.net).toBeLessThan(seller.amount)
  })

  it('عربون المشتري لا يُنقص ما يقبضه البائع', () => {
    const seller = buildOrderSettlement(
      order(),
      { amount: riyalsToHalalas(4_000), status: 'held' },
      null,
      'seller',
    )
    expect(seller.net).toBe(riyalsToHalalas(35_000))
  })

  it('الجانب مصرَّح به في التفصيل فلا يُعرض تفصيل طرف لطرف', () => {
    expect(buildOrderSettlement(order(), null, null, 'buyer').side).toBe('buyer')
    expect(buildOrderSettlement(order(), null, null, 'seller').side).toBe('seller')
  })
})

describe('صيغة التاريخ', () => {
  /** `Intl` يحشر علامات اتجاه بين المقاطع — تُهمَل عند المطابقة لا عند العرض. */
  const plain = (text: string) => text.replace(/[\u200e\u200f]/g, '')

  it('رقمية بالشرطة المائلة بلا اسم شهر', () => {
    const text = plain(formatTimestamp('2026-09-04T08:55:00.000Z'))
    // يوم/شهر/سنة · ساعة:دقيقة — والأرقام لاتينية للقراءة السريعة
    expect(text).toBe('04/09/2026 · 11:55 ص')
    // ولا اسم شهر: يطول ويختلف عرضه فتهتزّ أعمدة الجداول — و«ص»/«م» ثابتة
    expect(text.replace(/ [صم]$/, '')).not.toMatch(/\p{Script=Arabic}/u)
  })

  it('لا تختصر إلى «اليوم» أو «أمس» — الأسطر تُقارن ببعضها', () => {
    const now = new Date().toISOString()
    // الساعة باثنتي عشرة بعلامة صباحٍ ومساء — «18:40» تُترجَم في الذهن قبل أن تُفهم
    expect(plain(formatTimestamp(now))).toMatch(/^\d{2}\/\d{2}\/\d{4} · \d{2}:\d{2} [صم]$/)
    const yesterday = new Date(Date.now() - 86_400_000).toISOString()
    expect(formatTimestamp(yesterday)).not.toMatch(/أمس/)
  })

  it('بلا تاريخ تُرجع شرطة لا نصًّا مضلّلًا', () => {
    expect(formatTimestamp(null)).toBe('—')
  })
})

describe('العمولة داخل المطلوب سداده', () => {
  const commission = {
    base: riyalsToHalalas(875),
    vat: riyalsToHalalas(131),
    total: riyalsToHalalas(1_006),
  }

  it('تُضاف العمولة وضريبتها إلى المطلوب لا تُعرض وحدها', () => {
    const settlement = buildOrderSettlement(
      order(),
      { amount: riyalsToHalalas(4_000), status: 'held' },
      commission,
      'buyer',
    )
    // 35,000 − 4,000 + 1,006
    expect(settlement.net).toBe(riyalsToHalalas(32_006))
  })

  it('بلا عربون: القيمة كاملة مع العمولة', () => {
    const settlement = buildOrderSettlement(order(), null, commission, 'buyer')
    expect(settlement.net).toBe(riyalsToHalalas(36_006))
  })

  it('عمولة صفرية لا تغيّر شيئًا', () => {
    const zero = { base: 0, vat: 0, total: 0 }
    expect(buildOrderSettlement(order(), null, zero, 'buyer').net).toBe(riyalsToHalalas(35_000))
  })
})

describe('العمولة معطّلة', () => {
  /*
   * تعطيل عمولة البائع يُخرج المال كاملًا، فلا يبقى في الحساب أثرٌ لخصمٍ لم يقع.
   *
   * الأسطر الرقمية كانت تختفي بصفر العمولة وحدها — `commission.base > 0` —
   * والجُمل حولها تبقى تقول «بعد خصم عمولة المنصّة وضريبتها». فيقرأ البائع
   * خصمًا لم يقع، ويبحث عن أثره في كشف حسابه فلا يجده.
   */
  it('صافي البائع = قيمة الصفقة كاملة، والتفصيل بلا سطر عمولة', () => {
    const settled = order({ status: 'completed', paidAt: AT, releasedAt: AT, completedAt: AT })
    const settlement = buildOrderSettlement(settled, null, null, 'seller')

    expect(settlement.commission).toBeNull()
    expect(settlement.net).toBe(settled.amount)
  })

  it('وعمولةٌ مفعّلة تنقص العائد — فالفرق بينهما في الرقم لا في الصياغة وحدها', () => {
    const settled = order({ status: 'completed', paidAt: AT, releasedAt: AT, completedAt: AT })
    const fee = { base: riyalsToHalalas(875), vat: riyalsToHalalas(131.25), total: riyalsToHalalas(1_006.25) }
    const settlement = buildOrderSettlement(settled, null, fee, 'seller')

    expect(settlement.commission).toEqual(fee)
    expect(settlement.net).toBe(settled.amount - fee.total)
  })
})
