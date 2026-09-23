import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

/**
 * مخطَّط قاعدة البيانات — مرآةُ نموذج المجال لا نموذجٌ ثانٍ.
 *
 * وثلاثة قرارات تحكم هذا الملفّ كلّه:
 *
 * **١. المال `bigint` لا `numeric` ولا `float`.** المبالغ هللاتٌ صحيحة منذ
 * أوّل يوم في هذه المنصّة، والعائم يُدخل كسورًا لا وجود لها في مالٍ حقيقيّ
 * (`0.1 + 0.2`). و`numeric` صحيحٌ لكنّه يعود نصًّا ويحتاج تحويلًا في كلّ قراءة.
 *
 * **٢. الحالات نصٌّ لا `enum` في القاعدة.** أنواع الإشعارات وحالات الصفقة
 * تُزاد في هذا المشروع كثيرًا، وزيادةُ قيمةٍ في `enum` بوستجرس تقتضي ترحيلًا
 * يقفل الجدول. والتحقّق قائمٌ في طبقة المجال بـ`zod` وبأنواع TypeScript.
 *
 * **٣. القيم المركّبة `jsonb`.** ما يُقرأ ويُكتب جملةً ولا يُبحث فيه — حسابات
 * التواصل، وحمولة الحدث، وشرائح الإعدادات — يبقى مستندًا. وما يُبحث به أو
 * يُجمع عليه يكون عمودًا.
 */

/* أداتان تتكرّران: مبلغٌ بالهللات، وختمٌ زمنيّ يُقرأ نصًّا */
const halalas = (name: string) => bigint(name, { mode: 'number' })
const stamp = (name: string) => timestamp(name, { withTimezone: true, mode: 'string' })

/* ------------------------------------------------------------- الهويّة */

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    reference: text('reference').notNull(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    displayName: text('display_name').notNull(),
    phone: text('phone'),
    city: text('city'),
    avatarUrl: text('avatar_url'),
    /** `{ tiktok, snapchat, instagram }` — تُقرأ جملةً ولا يُبحث فيها */
    social: jsonb('social').notNull(),
    handle: text('handle'),
    showcaseUsesHandle: boolean('showcase_uses_handle').notNull().default(false),
    bankName: text('bank_name'),
    bankIban: text('bank_iban'),
    bankAccountName: text('bank_account_name'),
    createdAt: stamp('created_at').notNull(),
  },
  (table) => [
    /*
     * البريد والمعرّف والرقم المرجعيّ: **فرادةٌ في القاعدة لا في الكود**.
     *
     * فحصُ التوفّر ثمّ الإدراج سباقٌ: يمرّ طلبان بالفحص معًا فيُدرجان معًا.
     * والقاعدة وحدها تحرس هذا حرسًا لا يُخترق.
     */
    uniqueIndex('users_email_key').on(table.email),
    uniqueIndex('users_reference_key').on(table.reference),
    uniqueIndex('users_handle_key').on(table.handle),
  ],
)

export const admins = pgTable('admins', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  createdAt: stamp('created_at').notNull(),
  lastLoginAt: stamp('last_login_at'),
})

/* -------------------------------------------------------------- الإعلانات */

export const listings = pgTable(
  'listings',
  {
    id: text('id').primaryKey(),
    reference: text('reference').notNull().unique(),
    sellerId: text('seller_id').notNull(),

    // اللوحة — حقولٌ مسطّحة لأنّ البحث يقع عليها حرفًا ورقمًا
    plateType: text('plate_type').notNull(),
    plateFormat: text('plate_format').notNull(),
    arabicLetters: text('arabic_letters').notNull(),
    latinLetters: text('latin_letters').notNull(),
    plateNumbers: text('plate_numbers').notNull(),
    emblem: text('emblem').notNull(),
    customEmblemUrl: text('custom_emblem_url'),
    description: text('description'),

    saleType: text('sale_type').notNull(),
    status: text('status').notNull(),

    price: halalas('price').notNull(),
    startingPrice: halalas('starting_price').notNull(),
    minimumIncrement: halalas('minimum_increment').notNull(),
    /*
     * السعر الاحتياطي عمودٌ كغيره — وحجبُه مسؤولية طبقة الخدمة لا القاعدة.
     * وهو المكان الصحيح: القاعدة تحفظ، والخدمة تقرّر من يرى.
     */
    reservePrice: halalas('reserve_price').notNull(),
    minimumOffer: halalas('minimum_offer').notNull(),

    // لقطة الحوكمة وقت النشر — لا تُقرأ من الإعدادات بعد ذلك
    durationSeconds: integer('duration_seconds').notNull(),
    extensionTriggerSeconds: integer('extension_trigger_seconds').notNull(),
    extensionDurationSeconds: integer('extension_duration_seconds').notNull(),
    extensionResetsTimer: boolean('extension_resets_timer').notNull(),
    allowCustomBid: boolean('allow_custom_bid').notNull(),
    depositAmount: halalas('deposit_amount').notNull(),
    paymentWindowHours: integer('payment_window_hours').notNull(),
    escrowTransferWindowHours: integer('escrow_transfer_window_hours').notNull(),
    escrowReviewWindowHours: integer('escrow_review_window_hours').notNull(),
    escrowDisputeWindowHours: integer('escrow_dispute_window_hours').notNull(),
    escrowReleaseUndoWindowHours: integer('escrow_release_undo_window_hours').notNull(),
    forfeitPercent: integer('forfeit_percent').notNull(),
    forfeitUndoWindowHours: integer('forfeit_undo_window_hours').notNull(),
    refundDepositOnLoss: boolean('refund_deposit_on_loss').notNull(),

    startsAt: stamp('starts_at'),
    endsAt: stamp('ends_at'),
    endedAt: stamp('ended_at'),
    highestBidId: text('highest_bid_id'),
    soldToUserId: text('sold_to_user_id'),
    soldAmount: halalas('sold_amount').notNull(),
    viewCount: integer('view_count').notNull().default(0),
    createdAt: stamp('created_at').notNull(),
    updatedAt: stamp('updated_at').notNull(),
  },
  (table) => [
    index('listings_seller_idx').on(table.sellerId),
    /* السوق يقرأ المعروض مرتّبًا بنهايته — وهو أكثر استعلامٍ في المنصّة */
    index('listings_status_ends_idx').on(table.status, table.endsAt),
  ],
)

export const bids = pgTable(
  'bids',
  {
    id: text('id').primaryKey(),
    listingId: text('listing_id').notNull(),
    bidderId: text('bidder_id').notNull(),
    amount: halalas('amount').notNull(),
    status: text('status').notNull(),
    /** ترتيبٌ من الخادم — به يُفصل بين مزايدتين في المللي ثانية نفسها */
    serverSequence: integer('server_sequence').notNull(),
    /**
     * مفتاح الطلب من العميل — حارسُ التكرار.
     *
     * شبكةٌ متقطّعة تُعيد الطلب نفسه، فيصل مرّتين. وكان يُحرَس بخريطةٍ في
     * الذاكرة؛ وفي القاعدة **فرادةٌ على (المزايد، المفتاح)** — حرسٌ لا يُخترق
     * ولو وصل الطلبان إلى خادمين.
     */
    clientRequestId: text('client_request_id'),
    createdAt: stamp('created_at').notNull(),
    cancelledAt: stamp('cancelled_at'),
    cancellationReason: text('cancellation_reason'),
  },
  (table) => [
    index('bids_listing_idx').on(table.listingId, table.serverSequence),
    index('bids_bidder_idx').on(table.bidderId),
    uniqueIndex('bids_request_key').on(table.bidderId, table.clientRequestId),
  ],
)

export const offers = pgTable(
  'offers',
  {
    id: text('id').primaryKey(),
    listingId: text('listing_id').notNull(),
    buyerId: text('buyer_id').notNull(),
    amount: halalas('amount').notNull(),
    message: text('message'),
    status: text('status').notNull(),
    createdAt: stamp('created_at').notNull(),
    respondedAt: stamp('responded_at'),
  },
  (table) => [
    index('offers_listing_idx').on(table.listingId),
    index('offers_buyer_idx').on(table.buyerId),
  ],
)

/* --------------------------------------------------------------- الصفقات */

export const orders = pgTable(
  'orders',
  {
    id: text('id').primaryKey(),
    reference: text('reference').notNull().unique(),
    listingId: text('listing_id').notNull(),
    buyerId: text('buyer_id').notNull(),
    sellerId: text('seller_id').notNull(),
    amount: halalas('amount').notNull(),
    source: text('source').notNull(),
    status: text('status').notNull(),
    paymentDueAt: stamp('payment_due_at'),
    depositId: text('deposit_id'),
    paidAt: stamp('paid_at'),
    escrowAmount: halalas('escrow_amount').notNull().default(0),
    transferDueAt: stamp('transfer_due_at'),
    transferProofNote: text('transfer_proof_note'),
    transferProofAt: stamp('transfer_proof_at'),
    confirmDueAt: stamp('confirm_due_at'),
    disputedAt: stamp('disputed_at'),
    disputeReason: text('dispute_reason'),
    disputedBy: text('disputed_by'),
    payoutLedgerEntryId: text('payout_ledger_entry_id'),
    releasedAt: stamp('released_at'),
    /** علامات التذكيرات المُرسَلة — `['24h','6h','overdue']` */
    remindersSent: jsonb('reminders_sent').notNull().default([]),
    /** حارسُ التكرار في الشراء المباشر — كما في المزايدة */
    clientRequestId: text('client_request_id'),
    createdAt: stamp('created_at').notNull(),
    completedAt: stamp('completed_at'),
  },
  (table) => [
    index('orders_buyer_idx').on(table.buyerId),
    index('orders_seller_idx').on(table.sellerId),
    index('orders_listing_idx').on(table.listingId),
    /* المسح الدوريّ يبحث عن المتأخّر — حالةٌ وموعد */
    index('orders_status_due_idx').on(table.status, table.paymentDueAt),
    uniqueIndex('orders_request_key').on(table.buyerId, table.clientRequestId),
  ],
)

/* ---------------------------------------------------------------- المال */

export const wallets = pgTable('wallets', {
  userId: text('user_id').primaryKey(),
  balance: halalas('balance').notNull().default(0),
  held: halalas('held').notNull().default(0),
  updatedAt: stamp('updated_at').notNull(),
})

export const ledger = pgTable(
  'ledger',
  {
    id: text('id').primaryKey(),
    reference: text('reference').notNull().unique(),
    userId: text('user_id').notNull(),
    type: text('type').notNull(),
    direction: text('direction').notNull(),
    /** موجبٌ دائمًا — الاتّجاه في `direction` لا في الإشارة */
    amount: halalas('amount').notNull(),
    balanceAfter: halalas('balance_after').notNull(),
    heldAfter: halalas('held_after').notNull(),
    listingId: text('listing_id'),
    depositId: text('deposit_id'),
    orderId: text('order_id'),
    note: text('note'),
    actorAdminId: text('actor_admin_id'),
    createdAt: stamp('created_at').notNull(),
  },
  (table) => [index('ledger_user_idx').on(table.userId, table.createdAt)],
)

export const deposits = pgTable(
  'deposits',
  {
    id: text('id').primaryKey(),
    reference: text('reference').notNull().unique(),
    listingId: text('listing_id').notNull(),
    userId: text('user_id').notNull(),
    amount: halalas('amount').notNull(),
    status: text('status').notNull(),
    forfeitedAmount: halalas('forfeited_amount').notNull().default(0),
    createdAt: stamp('created_at').notNull(),
    resolvedAt: stamp('resolved_at'),
    resolvedByAdminId: text('resolved_by_admin_id'),
    reason: text('reason'),
  },
  (table) => [
    index('deposits_user_idx').on(table.userId),
    /*
     * عربونٌ واحدٌ لكلّ مزايدٍ على إعلان — فرادةٌ في القاعدة.
     *
     * الحجز يقع مع أوّل مزايدة، ومزايدةٌ ثانية تجد عربونها محجوزًا. وسباقُ
     * طلبين متزامنين يُنتج حجزين لولا هذا الحارس.
     */
    uniqueIndex('deposits_listing_user_key').on(table.listingId, table.userId),
  ],
)

export const payments = pgTable(
  'payments',
  {
    id: text('id').primaryKey(),
    reference: text('reference').notNull().unique(),
    userId: text('user_id').notNull(),
    orderId: text('order_id'),
    amount: halalas('amount').notNull(),
    method: text('method').notNull(),
    status: text('status').notNull(),
    orderPrice: halalas('order_price'),
    buyerCommission: halalas('buyer_commission'),
    buyerVat: halalas('buyer_vat'),
    tapChargeId: text('tap_charge_id'),
    tapMode: text('tap_mode'),
    tapStatus: text('tap_status'),
    transferNote: text('transfer_note'),
    /** يربط الدفعة بقيدها — وبه يُمنع الشحن المزدوج */
    ledgerEntryId: text('ledger_entry_id'),
    failureReason: text('failure_reason'),
    createdAt: stamp('created_at').notNull(),
    updatedAt: stamp('updated_at').notNull(),
    settledAt: stamp('settled_at'),
    settledByAdminId: text('settled_by_admin_id'),
  },
  (table) => [
    index('payments_user_idx').on(table.userId),
    uniqueIndex('payments_charge_key').on(table.tapChargeId),
  ],
)

export const platformEntries = pgTable(
  'platform_entries',
  {
    id: text('id').primaryKey(),
    reference: text('reference').notNull().unique(),
    paymentId: text('payment_id'),
    type: text('type').notNull(),
    amount: halalas('amount').notNull(),
    userId: text('user_id'),
    orderId: text('order_id'),
    listingId: text('listing_id'),
    depositId: text('deposit_id'),
    settled: boolean('settled').notNull().default(false),
    ledgerEntryId: text('ledger_entry_id'),
    note: text('note').notNull(),
    createdAt: stamp('created_at').notNull(),
    settledAt: stamp('settled_at'),
    /** المُبطَل لا يُحذف — يُوسَم ويخرج من مجموع الإيراد */
    reversedAt: stamp('reversed_at'),
    reversalReason: text('reversal_reason'),
  },
  (table) => [index('platform_entries_type_idx').on(table.type, table.settled)],
)

export const disbursements = pgTable(
  'disbursements',
  {
    id: text('id').primaryKey(),
    reference: text('reference').notNull().unique(),
    kind: text('kind').notNull(),
    status: text('status').notNull(),
    orderId: text('order_id').notNull(),
    orderReference: text('order_reference').notNull(),
    listingId: text('listing_id').notNull(),
    plateLabel: text('plate_label').notNull(),
    beneficiaryId: text('beneficiary_id').notNull(),
    beneficiaryName: text('beneficiary_name').notNull(),
    beneficiaryReference: text('beneficiary_reference').notNull(),
    grossAmount: halalas('gross_amount').notNull(),
    commissionAmount: halalas('commission_amount').notNull(),
    vatAmount: halalas('vat_amount').notNull(),
    amount: halalas('amount').notNull(),
    /* الآيبان **لقطةٌ وقت الإصدار** — فلا يتحوّل المال إلى حسابٍ بُدّل بعده */
    bankName: text('bank_name'),
    bankIban: text('bank_iban'),
    bankAccountName: text('bank_account_name'),
    note: text('note'),
    createdAt: stamp('created_at').notNull(),
    createdByAdminId: text('created_by_admin_id'),
    paidAt: stamp('paid_at'),
    paidByAdminId: text('paid_by_admin_id'),
    paymentReference: text('payment_reference'),
    ledgerEntryId: text('ledger_entry_id'),
    cancelledAt: stamp('cancelled_at'),
    cancelledByAdminId: text('cancelled_by_admin_id'),
    cancelReason: text('cancel_reason'),
  },
  (table) => [index('disbursements_status_idx').on(table.status)],
)

export const invoices = pgTable(
  'invoices',
  {
    id: text('id').primaryKey(),
    reference: text('reference').notNull().unique(),
    uuid: text('uuid').notNull(),
    kind: text('kind').notNull(),
    orderId: text('order_id').notNull(),
    listingId: text('listing_id').notNull(),
    orderReference: text('order_reference').notNull(),
    customerId: text('customer_id').notNull(),
    customerName: text('customer_name').notNull(),
    customerReference: text('customer_reference').notNull(),
    /* بيانات المنشأة لقطةٌ كذلك: فاتورةٌ صدرت تبقى كما صدرت */
    sellerName: text('seller_name').notNull(),
    sellerVatNumber: text('seller_vat_number').notNull(),
    sellerCrNumber: text('seller_cr_number').notNull(),
    sellerAddress: text('seller_address').notNull(),
    description: text('description').notNull(),
    netAmount: halalas('net_amount').notNull(),
    vatRate: integer('vat_rate').notNull(),
    vatAmount: halalas('vat_amount').notNull(),
    totalAmount: halalas('total_amount').notNull(),
    issuedAt: stamp('issued_at').notNull(),
    /** سلسلةٌ لا تنقطع: كلّ فاتورة تحمل بصمة سابقتها */
    previousHash: text('previous_hash').notNull(),
    hash: text('hash').notNull(),
    qr: text('qr').notNull(),
  },
  (table) => [index('invoices_customer_idx').on(table.customerId)],
)

/* ------------------------------------------------------- الإشعارات والأجهزة */

export const notifications = pgTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    href: text('href'),
    listingId: text('listing_id'),
    readAt: stamp('read_at'),
    createdAt: stamp('created_at').notNull(),
  },
  (table) => [index('notifications_user_idx').on(table.userId, table.createdAt)],
)

export const userDevices = pgTable(
  'user_devices',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    platform: text('platform').notNull(),
    /** المفتاح الطبيعيّ: الجهاز الواحد لا يُسجَّل مرّتين */
    pushToken: text('push_token').notNull(),
    webKeys: jsonb('web_keys'),
    appVersion: text('app_version'),
    notificationsEnabled: boolean('notifications_enabled').notNull().default(true),
    createdAt: stamp('created_at').notNull(),
    lastSeenAt: stamp('last_seen_at').notNull(),
  },
  (table) => [
    uniqueIndex('user_devices_token_key').on(table.pushToken),
    index('user_devices_user_idx').on(table.userId),
  ],
)

/* ----------------------------------------------------------- السجلّات */

export const listingEvents = pgTable(
  'listing_events',
  {
    id: text('id').primaryKey(),
    listingId: text('listing_id').notNull(),
    eventType: text('event_type').notNull(),
    /** الحمولة كاملةً بمبلغها — للتدقيق. وما يغادر الخادم يُحجب في الخدمة */
    payload: jsonb('payload').notNull(),
    createdAt: stamp('created_at').notNull(),
  },
  (table) => [index('listing_events_listing_idx').on(table.listingId, table.createdAt)],
)

export const audits = pgTable(
  'audits',
  {
    id: text('id').primaryKey(),
    actorId: text('actor_id'),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    beforeData: jsonb('before_data'),
    afterData: jsonb('after_data'),
    createdAt: stamp('created_at').notNull(),
  },
  (table) => [index('audits_created_idx').on(table.createdAt)],
)

/* ------------------------------------------------------ الأسئلة والإعدادات */

export const faq = pgTable('faq', {
  id: text('id').primaryKey(),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  category: text('category').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  published: boolean('published').notNull().default(true),
  showOnSaleTypes: jsonb('show_on_sale_types').notNull().default([]),
  createdAt: stamp('created_at').notNull(),
  updatedAt: stamp('updated_at').notNull(),
})

/**
 * واجهةُ الرئيسية — ستوريز وبنرات.
 *
 * **جدولان لا جدولٌ واحد بعمود «نوع».** يشتركان في نافذة الظهور والترتيب،
 * ويفترقان في كلّ ما عداها: البنر مستطيلٌ بنسبةٍ مفروضة يُرسم في مكانه،
 * والستوري ملءُ الشاشة يحتمل فدّيو بغلافه ومدّةَ عرض. وجدولٌ واحد يعني
 * أعمدةً فارغةً في نصف الأسطر، وتحقّقًا يقول «هذا الحقل لهذا النوع وحده»
 * — وهو نوعٌ يُحرَس باليد بدل أن تحرسه القاعدة.
 *
 * والصورةُ **مفتاحٌ لا بايتات**: شعارُ المنصّة يسكن `settings` بـ`base64`
 * لأنّه كيلوباياتٌ تُقرأ مع كلّ صفحة، وستوري فدّيو عشرةُ ميغابايت — وقاعدةٌ
 * تحمل الفدّيو تُنسخ احتياطيًّا معه كلَّ ليلة.
 */
const liveWindow = {
  published: boolean('published').notNull().default(false),
  startsAt: stamp('starts_at'),
  endsAt: stamp('ends_at'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: stamp('created_at').notNull(),
  updatedAt: stamp('updated_at').notNull(),
}

export const banners = pgTable(
  'banners',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    imageKey: text('image_key').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    alt: text('alt').notNull().default(''),
    linkUrl: text('link_url'),
    ...liveWindow,
  },
  /* الرئيسية تقرؤها مرتَّبةً مرشَّحةً في كلّ طلب — فالفهرس على ما يُرشَّح به */
  (table) => [index('banners_live_idx').on(table.published, table.sortOrder)],
)

export const stories = pgTable(
  'stories',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    mediaKey: text('media_key').notNull(),
    mediaKind: text('media_kind').notNull(),
    posterKey: text('poster_key'),
    alt: text('alt').notNull().default(''),
    linkUrl: text('link_url'),
    durationSeconds: integer('duration_seconds').notNull().default(6),
    ...liveWindow,
  },
  (table) => [index('stories_live_idx').on(table.published, table.sortOrder)],
)

/**
 * الإعدادات مستنداتٌ لا جداول.
 *
 * كلُّ شريحةٍ منها تُقرأ وتُكتب **جملةً**، ولا يُبحث في حقولها ولا يُجمع
 * عليها. فجدولٌ بعمودٍ لكلّ حقل يعني ترحيلًا مع كلّ حقلٍ يُضاف — وقد أُضيفت
 * `mobileSettings` كاملةً في يومٍ واحد.
 */
export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: stamp('updated_at').notNull(),
})

/**
 * عدّادات الأرقام المرجعية — `U26-00001` وأخواتها.
 *
 * ويُقرأ العدّاد بـ`FOR UPDATE` داخل المعاملة نفسها التي تُدرج الصفّ، فلا
 * يأخذ طلبان الرقم نفسه. وهو ما كان يحرسه قفلُ الذاكرة في التنفيذ السابق.
 */
export const sequences = pgTable(
  'sequences',
  {
    kind: text('kind').notNull(),
    year: integer('year').notNull(),
    value: integer('value').notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.kind, table.year] })],
)
