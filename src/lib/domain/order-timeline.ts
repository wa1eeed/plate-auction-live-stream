import { isFinalOrderStatus } from './types'
import type { CommissionBreakdown, DepositStatus, Order } from './types'
import type { Halalas } from './money'

/** طرفا الصفقة — وكل نصّ في هذا الملفّ يُصاغ لمن ينظر لا لمن يُحكى عنه. */
export type OrderSide = 'buyer' | 'seller'

/**
 * تفصيل مالي لصفقة — ما دُفع، وما خُصم، وما بقي.
 *
 * الصفقة ليست رقمًا واحدًا: قيمتها مبلغ، وجزءٌ منه عربونٌ حُجز داخل المنصّة،
 * وعليها عمولة. من يرى «35,000» وحدها لا يعرف كم يدفع ولا كم يقبض.
 */
export type OrderSettlement = {
  /** لمن هذا التفصيل — يقلب اتجاه العمولة والرقم الأخير */
  side: OrderSide
  /** قيمة الصفقة كاملة */
  amount: Halalas
  /** العربون المحجوز لهذه الصفقة، إن وُجد */
  deposit: Halalas
  depositStatus: DepositStatus | null
  /** ما خُصم فعلًا من العربون — لا يُخصم إلا عند اكتمال الصفقة */
  depositApplied: Halalas
  /**
   * ثمن اللوحة بعد العربون — الجزء الذي **لا عمولة فيه**.
   * وهو وحده ما يُخصم من محفظة المشتري عند الدفع منها.
   */
  price: Halalas
  /** عمولة صاحب هذا التفصيل وضريبتها، إن فُعّلت */
  commission: CommissionBreakdown | null
  /**
   * ما يخصّ صاحب الصفحة من هذه الصفقة:
   * المشتري **يسدّده** — القيمة − العربون + عمولته وضريبتها،
   * والبائع **يقبضه** — القيمة − عمولته وضريبتها.
   *
   * حقلٌ واحد باتجاهين خيرٌ من حقل بصوت المشتري يُعرض للبائع: كانت بطاقة
   * البائع تجمع عمولتنا إلى قيمة الصفقة وتسمّيها «المطلوب سداده»، فتقول له
   * إنه يقبض 9,258.75 وهو يقبض 8,741.25.
   */
  net: Halalas
  /** هل وصل المال إلى المنصّة؟ — لا يعني أنه أُفرج للبائع */
  settled: boolean
}

export function buildOrderSettlement(
  order: Pick<Order, 'amount' | 'status'>,
  deposit: { amount: Halalas; status: DepositStatus } | null,
  commission: CommissionBreakdown | null,
  side: OrderSide,
): OrderSettlement {
  // «سُدّد» يعني وصل المال إلى المنصّة — لا أنه أُفرج للبائع
  const settled = order.status !== 'awaiting_settlement' && order.status !== 'cancelled' && order.status !== 'defaulted'
  // العربون يُخصم عند الاكتمال وحده؛ قبله هو ضمان محجوز لا دفعة
  const depositApplied = deposit?.status === 'applied' ? deposit.amount : 0
  const willApply = deposit && deposit.status === 'held' ? deposit.amount : 0

  const credited = depositApplied || willApply
  const fees = commission?.total ?? 0
  // مصدر واحد للرقمين: المطلوب = الثمن + الرسوم، فلا ينحرف أحدهما عن الآخر
  const price = Math.max(0, order.amount - credited)

  return {
    side,
    amount: order.amount,
    deposit: deposit?.amount ?? 0,
    depositStatus: deposit?.status ?? null,
    depositApplied,
    price,
    commission,
    // العمولة تُضاف على من يدفع وتُطرح ممّن يقبض
    net: side === 'buyer' ? price + fees : Math.max(0, order.amount - fees),
    settled,
  }
}

// ------------------------------------------------------------- مسار الصفقة

export type OrderStepState = 'done' | 'current' | 'pending' | 'failed'

export type OrderTimelineStep = {
  key: 'created' | 'paid' | 'transfer' | 'confirm' | 'released'
  /**
   * اسم المحطّة في كلمة — وهو ما يُكتب تحت النقطة في الشريط.
   *
   * الجملة الكاملة لا تُكتب تحت خمس نقاط على عرض 360px: تتكسّر إلى كلمات
   * مقطّعة فيصير الشريط أطول من الفائدة. الجملة موضعها نداء المرحلة الحالية.
   */
  short: string
  label: string
  /** وقت وقوعه — `null` لما لم يقع بعد */
  at: string | null
  state: OrderStepState
  hint: string
  /**
   * ما انقضى من مهلة هذه المرحلة (0..1) — للمرحلة الجارية وحدها.
   * يملأ الشريط ذهبًا بين المحطّتين فيُرى احتراق المهلة لا رقمها فقط.
   */
  progress?: number
}

/** نسبة ما انقضى من نافذة زمنية — تُقصّ على [0,1] فلا يتجاوز الشريط طرفيه. */
function elapsedRatio(startIso: string | null, dueIso: string | null, nowMs: number): number | undefined {
  if (!startIso || !dueIso) return undefined
  const start = Date.parse(startIso)
  const due = Date.parse(dueIso)
  if (!Number.isFinite(start) || !Number.isFinite(due) || due <= start) return undefined
  return Math.min(1, Math.max(0, (nowMs - start) / (due - start)))
}

/**
 * مراحل الصفقة من نشأتها إلى استقرار مالها.
 *
 * خمس مراحل **ثابتة** لا يتغيّر عددها بتغيّر النتيجة، وما يتغيّر حالتها —
 * فيُقرأ المسار بالشكل قبل النصّ. والمرحلة تُسمّى بمن عليه الدور: «نقل الملكية»
 * لا «البائع متأخّر».
 *
 * و`side` ليست ترفًا: النصّ نفسه لا يصلح للطرفين. «وصل مبلغك وحُجز أمانةً»
 * صادقة للمشتري كاذبة للبائع، و«نقل البائع الملكية» تُحدّث البائع عن نفسه
 * بضمير الغائب. فكان البائع يقرأ في «مبيعاتي» صفحةً مكتوبة لغيره.
 */
export function buildOrderTimeline(
  order: Pick<
    Order,
    | 'source'
    | 'status'
    | 'buyerId'
    | 'sellerId'
    | 'createdAt'
    | 'paymentDueAt'
    | 'completedAt'
    | 'paidAt'
    | 'transferDueAt'
    | 'transferProofAt'
    | 'confirmDueAt'
    | 'releasedAt'
    | 'disputedAt'
    | 'disputeReason'
    | 'disputedBy'
  >,
  settlement: Pick<OrderSettlement, 'deposit' | 'depositStatus' | 'depositApplied' | 'commission'>,
  nowMs: number,
  side: OrderSide,
): OrderTimelineStep[] {
  const buyer = side === 'buyer'
  const cancelled = order.status === 'cancelled'
  const defaulted = order.status === 'defaulted'
  const closed = cancelled || defaulted
  const refunded = order.status === 'refunded'
  const released = order.status === 'completed'
  const disputed = order.status === 'disputed'
  const paid = order.paidAt !== null
  const transferred = order.transferProofAt !== null
  const overdue = !paid && order.paymentDueAt !== null && Date.parse(order.paymentDueAt) <= nowMs
  // مهلة النقل انقضت والمال لا يزال محجوزًا: للمشتري أن يطلب استرداده
  const transferOverdue =
    paid && !transferred && order.transferDueAt !== null && Date.parse(order.transferDueAt) <= nowMs
  const forfeited = settlement.depositStatus === 'forfeited'
  const hasFees = (settlement.commission?.total ?? 0) > 0
  // من رفع الاعتراض؟ — «اعتراضك» غير «اعتراض الطرف الآخر»، والفرق يغيّر الموقف
  const disputeIsMine =
    order.disputedBy !== null && order.disputedBy === (buyer ? order.buyerId : order.sellerId)

  const step = (
    key: OrderTimelineStep['key'],
    short: string,
    label: string,
    at: string | null,
    state: OrderStepState,
    hint: string,
    progress?: number,
  ): OrderTimelineStep => ({ key, short, label, at, state, hint, progress })

  // ---- (١) النشأة: من أين جاءت الصفقة
  const created = buyer
    ? order.source === 'auction'
      ? step('created', 'طلب', 'رست اللوحة عليك', order.createdAt, 'done', 'أُغلق المزاد بأعلى مزايدة وسُجّلت الصفقة باسمك')
      : order.source === 'offer'
        ? step('created', 'طلب', 'قَبِل البائع عرضك', order.createdAt, 'done', 'صار عرضك صفقة قائمة باسمك')
        : step('created', 'طلب', 'اشتريت اللوحة بسعرها المعروض', order.createdAt, 'done', 'سُجّلت الصفقة باسمك في المنصّة')
    : order.source === 'auction'
      ? step('created', 'طلب', 'رست لوحتك على أعلى مزايد', order.createdAt, 'done', 'أُغلق المزاد وخرجت لوحتك من السوق')
      : order.source === 'offer'
        ? step('created', 'طلب', 'قَبِلتَ عرض المشتري', order.createdAt, 'done', 'بقبولك صار العرض صفقة، وخرجت لوحتك من السوق')
        : step('created', 'طلب', 'بِيعت لوحتك بسعرها المعروض', order.createdAt, 'done', 'اشتراها المشتري مباشرةً، وخرجت لوحتك من السوق')

  // ---- (٢) السداد: وصول المال إلى المنصّة لا إلى البائع
  const paidStep = paid
    ? step(
        'paid',
        'سداد',
        buyer ? 'وصل مبلغك وحُجز أمانةً' : 'وصل مبلغ المشتري وحُجز أمانةً',
        order.paidAt,
        'done',
        buyer
          ? settlement.depositApplied > 0
            ? 'خُصم عربونك من القيمة، والباقي محفوظ لدى المنصّة'
            : 'محفوظ لدى المنصّة، ولا يخرج للبائع قبل نقل الملكية'
          : 'محجوز لصالحك، ويصل البائع بعد نقل الملكية وتحقّق الإدارة',
      )
    : closed
      ? step(
          'paid',
          'سداد',
          buyer ? (cancelled ? 'أُلغيت قبل سدادك' : 'لم يقع سدادك') : 'لم يصل السداد',
          order.paymentDueAt,
          'failed',
          buyer
            ? cancelled
              ? 'لم يخرج منك مبلغ هذه الصفقة'
              : 'انتهت المهلة فأُغلقت الصفقة'
            : 'لم يصلك مبلغ، ولوحتك باقية باسمك',
        )
      : overdue
        ? step(
            'paid',
            'سداد',
            buyer ? 'انتهت مهلة سدادك' : 'انتهت مهلة سداد المشتري',
            order.paymentDueAt,
            'failed',
            buyer
              ? settlement.deposit > 0
                ? 'سدّد الآن — وقد تُلغى الصفقة ويُصادر عربونك'
                : 'سدّد الآن — وقد تُلغى الصفقة'
              : 'لا تنقل الملكية — وللإدارة إلغاؤها أو إعادة إرسائها',
          )
        : step(
            'paid',
            'سداد',
            buyer ? 'سدادك' : 'سداد المشتري',
            order.paymentDueAt,
            'current',
            buyer
              ? 'يُحجز مبلغك أمانةً حتى تُنقل اللوحة باسمك'
              : 'لا تنقل الملكية قبل أن يصل مبلغه',
            elapsedRatio(order.createdAt, order.paymentDueAt, nowMs),
          )

  // ---- (٣) نقل الملكية: دور البائع وحده
  const transferStep = transferred
    ? step(
        'transfer',
        'نقل',
        buyer ? 'نقل البائع الملكية' : 'نقلتَ الملكية ورفعتَ إثباتها',
        order.transferProofAt,
        'done',
        buyer ? 'راجِع الإثبات وتحقّق في أبشر قبل التأكيد' : 'سُجّل إثباتك، والدور الآن على المشتري',
      )
    : closed
      ? step('transfer', 'نقل', 'نقل الملكية', null, 'failed', buyer ? 'لم تبلغه الصفقة' : 'لا تنقلها — أُغلقت الصفقة ولوحتك باسمك')
      : refunded
        ? step(
            'transfer',
            'نقل',
            'لم تُنقل الملكية',
            null,
            'failed',
            buyer ? 'عاد مبلغك إليك وأُغلقت الصفقة' : 'عاد المبلغ إلى المشتري وأُغلقت الصفقة',
          )
        : !paid
          ? step(
              'transfer',
              'نقل',
              'نقل الملكية',
              order.transferDueAt,
              'pending',
              buyer ? 'يبدأ بعد وصول مبلغك' : 'يبدأ دورك بعد وصول مبلغ المشتري',
            )
          : transferOverdue
            ? step(
                'transfer',
                'نقل',
                'انتهت مهلة النقل',
                order.transferDueAt,
                'failed',
                buyer
                  ? 'لم يرفع البائع إثباتًا — لك أن تطلب استرداد مبلغك'
                  : 'انقلها الآن — وللمشتري أن يطلب استرداد مبلغه',
              )
            : step(
                'transfer',
                'نقل',
                'نقل الملكية',
                order.transferDueAt,
                'current',
                buyer
                  ? 'ينقلها البائع ويرفع إثباتها، ومبلغك محجوز حتى ذلك'
                  : 'انقلها عبر القنوات الرسمية وارفع إثباتها لتتحقّق منها الإدارة',
                elapsedRatio(order.paidAt, order.transferDueAt, nowMs),
              )

  // ---- (٤) التأكيد: إذن المشتري بالإفراج، أو اعتراضه
  const confirmStep = disputed
    ? step(
        'confirm',
        'تأكيد',
        disputeIsMine ? 'اعتراضك قيد المراجعة' : buyer ? 'اعتراض البائع قيد المراجعة' : 'اعتراض المشتري قيد المراجعة',
        order.disputedAt,
        'failed',
        order.disputeReason ?? (buyer ? 'توقّف تحويل المبلغ وهو محجوز حتى تفصل الإدارة' : 'توقّف تحويل المبلغ وهو محجوز حتى تفصل الإدارة'),
      )
    : refunded
      ? step(
          'confirm',
          'تحقّق',
          transferred ? 'لم يثبت النقل' : 'تحقّق الإدارة',
          order.completedAt,
          'failed',
          buyer ? 'عاد مبلغك إلى رصيدك' : 'قرّرت الإدارة إعادة المبلغ إلى المشتري',
        )
      : released
        ? /*
           * صفقة أُفرجت بعد اعتراض تُنسب إلى فصل الإدارة لا إلى مراجعة عادية:
           * محو الخصومة من السجلّ يُربك من يقرؤه بعد شهر.
           */
          order.disputedAt !== null
          ? step('confirm', 'تحقّق', 'حسمت الإدارة الاعتراض', order.releasedAt ?? order.completedAt, 'done', buyer ? 'قرّرت الإدارة إتمام الصفقة وتحويل المبلغ للبائع' : 'قرّرت الإدارة إتمام الصفقة وتحويل المبلغ لك')
          : step(
              'confirm',
              'تحقّق',
              'تحقّقت الإدارة من النقل',
              order.releasedAt ?? order.completedAt,
              'done',
              'راجعت الإدارة إثبات النقل قبل تحويل المبلغ',
            )
        : closed
          ? step('confirm', 'تحقّق', 'تحقّق الإدارة', null, 'failed', 'لم تبلغه الصفقة')
          : transferred
            ? step(
                'confirm',
                'تحقّق',
                'تحقّق الإدارة من النقل',
                order.confirmDueAt,
                'current',
                buyer
                  ? 'لا مطلوب منك — تراجع الإدارة الإثبات ثم تحوّل المبلغ للبائع. ولك أن ترفع استفسارًا في أي وقت قبل التحويل'
                  : 'تراجع الإدارة إثباتك ثم تُفرج لك المبلغ',
                elapsedRatio(order.transferProofAt, order.confirmDueAt, nowMs),
              )
            : step(
                'confirm',
                'تحقّق',
                'تحقّق الإدارة',
                order.confirmDueAt,
                'pending',
                buyer ? 'يبدأ بعد رفع البائع إثبات النقل' : 'يبدأ بعد رفعك إثبات النقل',
              )

  // ---- (٥) استقرار المال: أين رسا في النهاية
  const releasedStep = released
    ? step(
        'released',
        'تم',
        buyer ? 'ذهب المبلغ إلى البائع' : 'وصل عائدك إلى محفظتك',
        order.releasedAt ?? order.completedAt,
        'done',
        buyer
          ? 'اكتملت الصفقة، واللوحة باسمك'
          : hasFees
            ? 'قيمة الصفقة بعد عمولة المنصّة وضريبتها'
            : 'قيمة الصفقة كاملةً في رصيدك المتاح',
      )
    : refunded
      ? step(
          'released',
          buyer ? 'عاد إليك' : 'عاد للمشتري',
          buyer ? 'عاد المبلغ إلى محفظتك' : 'عاد المبلغ إلى المشتري',
          order.completedAt,
          'failed',
          buyer ? (hasFees ? 'عاد إلى رصيدك ما دفعته ورسومه' : 'عاد إلى رصيدك ما دفعته') : 'لا عائد لك عن هذه الصفقة',
        )
      : closed
        ? step(
            'released',
            'أُغلقت',
            cancelled ? 'أُغلقت الصفقة دون إتمام' : 'أُغلقت الصفقة لعدم السداد',
            order.completedAt,
            'failed',
            buyer
              ? forfeited
                ? 'صودر من عربونك بقواعد الإعلان — التفصيل في محفظتك'
                : cancelled
                  ? 'لم يخرج منك مال ولم تنتقل اللوحة إليك'
                  : 'انتهت المهلة ولم يصل مبلغك'
              : forfeited
                ? 'العربون المصادَر يعود للمنصّة، ولا عائد لك عنها'
                : 'لم يصلك مال، ولوحتك باقية باسمك',
          )
        : disputed
          ? step(
              'released',
              'تحويل',
              'التحويل متوقّف',
              null,
              'pending',
              buyer
                ? 'إمّا أن يذهب للبائع وإمّا أن يعود إليك — والإدارة تقرّر'
                : 'إمّا أن يصلك وإمّا أن يعود للمشتري — والإدارة تقرّر',
            )
          : step(
              'released',
              'تحويل',
              buyer ? 'تحويل المبلغ للبائع' : 'إيداع عائدك',
              null,
              'pending',
              transferred
                ? buyer
                  ? 'يقع بقرار الإدارة بعد تحقّقها من النقل'
                  : 'يصل محفظتك بقرار الإدارة بعد تحقّقها من إثباتك'
                : buyer
                  ? 'بعد نقل الملكية وتحقّق الإدارة'
                  : 'بعد نقل الملكية وتحقّق الإدارة',
            )

  return [created, paidStep, transferStep, confirmStep, releasedStep]
}

/**
 * أين المال الآن.
 *
 * سؤال الطرفين الأوّل في صفقة ضمان ليس «أين وصلنا» بل **«أين مالي»**. والمسار
 * وحده لا يجيبه: خمس محطّات لا تقول إن المبلغ محبوس لدى المنصّة لا عند أحدهما.
 */
export type OrderMoneyMarker = {
  /** المحطّة التي يقف عندها المال في الشريط */
  index: number
  /** كلمة أو كلمتان — يركب بها الشريط */
  short: string
  label: string
  tone: 'pending' | 'held' | 'done' | 'failed'
}

export function orderMoneyMarker(
  order: Pick<Order, 'status' | 'paidAt'>,
  side: OrderSide,
): OrderMoneyMarker | null {
  const buyer = side === 'buyer'

  if (order.status === 'completed') {
    return {
      index: 4,
      short: buyer ? 'للبائع' : 'وصلك',
      label: buyer ? 'ذهب المبلغ إلى البائع' : 'وصلك المبلغ في محفظتك',
      tone: 'done',
    }
  }
  if (order.status === 'refunded') {
    return {
      index: 0,
      short: buyer ? 'عاد إليك' : 'عاد للمشتري',
      label: buyer ? 'عاد المبلغ إلى محفظتك' : 'عاد المبلغ إلى المشتري',
      tone: 'failed',
    }
  }
  // ملغاة أو متخلّفة: لا مال في الطريق أصلًا
  if (order.status === 'cancelled' || order.status === 'defaulted') return null

  if (order.paidAt) {
    return {
      index: 2,
      short: 'أمانة',
      label: 'المبلغ محجوز أمانةً لدى المنصّة',
      tone: 'held',
    }
  }
  return {
    index: 0,
    short: buyer ? 'معك' : 'لم يصل',
    label: buyer ? 'المبلغ لم يغادر محفظتك بعد' : 'لم يصل مبلغ المشتري بعد',
    tone: 'pending',
  }
}

/**
 * المرحلة التي عليها الدور الآن — وعلى مَن.
 *
 * الواجهة تحتاج جوابًا واحدًا لا مسحًا للمصفوفة في كل موضع: أيّ محطّة نُبرزها،
 * وهل الدور على من ينظر أم على غيره.
 */
/**
 * على مَن الدور في هذه الحالة — والجواب واحد لا يتكرّر في موضعين.
 *
 * المشتري يسدّد، ثم البائع ينقل الملكية ويرفع إثباتها، ثم **الإدارة تتحقّق
 * وتُفرج**. فما بعد رفع الإثبات لا دور فيه لطرف: لا يُطالَب المشتري بتأكيد،
 * ولا يُفرج المال بسكوته — يُفرج بقرارٍ من الإدارة بعد تحقّقها.
 */
export function orderTurn(status: Order['status']): OrderSide | null {
  return status === 'awaiting_settlement' ? 'buyer' : status === 'escrow_held' ? 'seller' : null
}

/**
 * أي قسم تنتمي إليه الصفقة في صفحة صاحبها.
 *
 * والتقسيم **بالدور** لا بالمرحلة: من يفتح «مشترياتي» يسأل «هل عليّ شيء؟» لا
 * «في أي مرحلة أنا؟». وثلاثة أقسام ثابتة لا تزيد بزيادة الحالات — وتاب لكل حالة
 * يعني ثمانية تابات أكثرها فارغ، وصفقةٌ تنتظر صاحبها تختبئ في تابٍ لا يفتحه.
 */
export type OrderBucket = 'you' | 'running' | 'done'

export function orderBucket(order: Pick<Order, 'status'>, side: OrderSide): OrderBucket {
  if (isFinalOrderStatus(order.status)) return 'done'
  return orderTurn(order.status) === side ? 'you' : 'running'
}

/**
 * قسم الصفقة في لوحة الإدارة — ومحورها **الاستثناء** لا الدور.
 *
 * الأدمن لا يعمل على الصفقات السليمة: تمشي بلا يده. وما يخصّه ما تعثّر —
 * اعتراضٌ يفصل فيه، أو مهلةٌ انقضت فيقرّر مصادرةً أو إعادة إرساء أو استردادًا.
 * وخلط هذه بمئة صفقة سليمة هو عين التشتّت.
 */
export function adminOrderBucket(
  order: Pick<Order, 'status' | 'transferDueAt' | 'disputedAt'>,
  flags: { overdue: boolean },
  nowMs: number,
): OrderBucket {
  if (isFinalOrderStatus(order.status)) return 'done'
  if (order.status === 'disputed') return 'you'
  // نُقلت الملكية: الإفراج قرار الإدارة، فلا تمضي الصفقة بلا يدها
  if (order.status === 'ownership_transferred') return 'you'
  // استفسارٌ مرفوع لم يُغلق — ولو كانت الصفقة تمضي في مسارها
  if (order.disputedAt !== null) return 'you'
  if (order.status === 'awaiting_settlement' && flags.overdue) return 'you'
  // مهلة نقل انقضت والمال محبوس: للإدارة أن تسترد أو تنبّه البائع
  if (
    order.status === 'escrow_held' &&
    order.transferDueAt !== null &&
    Date.parse(order.transferDueAt) <= nowMs
  ) {
    return 'you'
  }
  return 'running'
}

/**
 * ما ينتظره الأدمن في هذه الصفقة — نصًّا لا حالةً.
 *
 * جدولٌ يعرض «اعتراض قيد المراجعة» و«المبلغ محجوز» في عمود واحد يقول للمشغّل
 * *أين* الصفقة ولا يقول *ماذا يفعل*. وقسمٌ اسمه «بانتظار قرارك» يجمع ثلاثة
 * قرارات مختلفة بلا تمييز يزيد التشتّت لا يرفعه.
 */
export type AdminOrderTask = {
  /** ما المطلوب من الأدمن — أو ممّن يُنتظر إن لم يكن الدور عليه */
  title: string
  /** تفصيل سطرٍ واحد يكفي للقرار */
  detail: string
  tone: 'act' | 'wait' | 'done'
}

export function adminOrderTask(
  order: Pick<
    Order,
    | 'status'
    | 'disputedAt'
    | 'disputeReason'
    | 'disputedBy'
    | 'buyerId'
    | 'transferProofNote'
    | 'transferDueAt'
    | 'paymentDueAt'
  >,
  flags: { overdue: boolean },
  nowMs: number,
): AdminOrderTask {
  if (order.status === 'disputed') {
    const from = order.disputedBy === order.buyerId ? 'المشتري' : 'البائع'
    return {
      title: `افصل في اعتراض ${from}`,
      detail: order.disputeReason ?? 'بلا سبب مذكور — راجع الطرفين',
      tone: 'act',
    }
  }

  if (order.status === 'ownership_transferred') {
    return {
      title: 'تحقّق من نقل الملكية ثم حوّل المبلغ',
      detail: order.transferProofNote
        ? `إثبات البائع: ${order.transferProofNote}`
        : 'رفع البائع الإثبات — راجعه في أبشر قبل تحويل المبلغ',
      tone: 'act',
    }
  }

  if (order.status === 'awaiting_settlement') {
    if (flags.overdue) {
      return {
        title: 'انتهت مهلة السداد — صادر العربون أو ألغِ الصفقة',
        detail: 'للمشتري عربونٌ قد يُصادَر، ولك إعادة الإرساء على المزايد التالي',
        tone: 'act',
      }
    }
    return { title: 'بانتظار سداد المشتري', detail: 'المهلة تجري ولا مطلوب منك', tone: 'wait' }
  }

  if (order.status === 'escrow_held') {
    const late =
      order.transferDueAt !== null && Date.parse(order.transferDueAt) <= nowMs
    return late
      ? {
          title: 'تأخّر البائع عن نقل الملكية',
          detail: 'المبلغ محجوز ومهلة النقل انتهت — نبّه البائع أو أعد المبلغ للمشتري',
          tone: 'act',
        }
      : { title: 'بانتظار نقل البائع للملكية', detail: 'المبلغ محجوز والمهلة تجري', tone: 'wait' }
  }

  if (order.status === 'completed') {
    return { title: 'وصل المبلغ للبائع', detail: 'انتهت ولا إجراء عليها', tone: 'done' }
  }
  if (order.status === 'refunded') {
    return { title: 'عاد المبلغ للمشتري', detail: 'انتهت ولا إجراء عليها', tone: 'done' }
  }
  return {
    title: order.status === 'defaulted' ? 'أُغلقت لعدم السداد' : 'ملغاة',
    detail: 'أُغلقت ولا إجراء عليها',
    tone: 'done',
  }
}

export function currentOrderStage(
  steps: OrderTimelineStep[],
  order: Pick<Order, 'status' | 'paymentDueAt' | 'transferDueAt' | 'confirmDueAt'>,
  side: OrderSide,
): { step: OrderTimelineStep; audience: 'you' | 'other'; deadline: string | null } {
  const step =
    steps.find((row) => row.state === 'current') ??
    steps.find((row) => row.state === 'failed') ??
    steps[steps.length - 1]

  const turn = orderTurn(order.status)

  return { step, audience: turn === side ? 'you' : 'other', deadline: orderDeadline(order) }
}

/**
 * موعد المرحلة الجارية — مصدرٌ واحد لعدّادها ولترتيبها.
 *
 * ومهلة السداد كانت ساقطةً منه: `awaiting_settlement` تُرجع `null`، فتُعرض
 * الصفقة التي على صاحبها أن يسدّد بلا عدّاد أصلًا — وهي أحوج المراحل إليه،
 * لأنّ انقضاءها يُتبَع باقتطاعٍ من العربون وإعادة إرساء.
 *
 * ومنه تُرتَّب القائمة أيضًا، فيوافق ما يُقرأ أوّلًا ما يُعدّ أوّلًا — ولو
 * قُرئ موعدٌ ورُتّب بغيره لبدا الترتيب عشوائيًّا.
 */
export function orderDeadline(
  order: Pick<Order, 'status' | 'paymentDueAt' | 'transferDueAt' | 'confirmDueAt'>,
): string | null {
  if (order.status === 'awaiting_settlement') return order.paymentDueAt
  if (order.status === 'escrow_held') return order.transferDueAt
  if (order.status === 'ownership_transferred') return order.confirmDueAt
  return null
}
