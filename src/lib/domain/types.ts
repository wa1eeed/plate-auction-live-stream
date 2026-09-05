import type { Halalas } from './money'

// ---------------------------------------------------------------- اللوحات

export type PlateType = 'private' | 'transport' | 'motorcycle'

/**
 * نوع الإصدار — شكل اللوحة نفسها لا صنف مركبتها.
 *
 * محورٌ مستقلّ عن `PlateType`: تلك تقول «خصوصي» أو «نقل خاص»، وهذه تقول أيّ
 * قالبٍ صُبّت فيه. ولوحةٌ خصوصية قد تصدر طويلةً أو اعتيادية أو رياضية.
 *
 *   · `long`     الطويلة — صفّان وشعارٌ أوسط وشريط الدولة يمينًا
 *   · `standard` الاعتيادية — أقرب إلى المربّع، صفّان بلا شعارٍ أوسط
 *   · `sport`    الرياضية — صفٌّ واحد **لاتينيّ فقط**، والدولة في خانةٍ وسطى
 */
export type PlateFormat = 'long' | 'standard' | 'sport'

export const PLATE_FORMATS: readonly PlateFormat[] = ['standard', 'long', 'sport']

export const PLATE_FORMAT_LABELS: Record<PlateFormat, string> = {
  standard: 'لوحة اعتيادية',
  long: 'لوحة طويلة',
  sport: 'لوحة رياضية',
}

export const PLATE_FORMAT_HINTS: Record<PlateFormat, string> = {
  standard: 'مستطيلة قريبة من المربّع — صفّان: العربي أعلى واللاتيني أسفله.',
  long: 'الطويلة المعتادة — صفّان وشعار في الوسط.',
  sport: 'قصيرة بصفٍّ واحد، بحروف وأرقام إنجليزية فقط بلا عربية.',
}

/** الرياضية بلا عربية — يُخفى حقلاها في النموذج ولا يُرسمان في اللوحة. */
export const isLatinOnlyFormat = (format: PlateFormat): boolean => format === 'sport'

export const PLATE_TYPES: readonly PlateType[] = ['private', 'transport', 'motorcycle']

export const PLATE_TYPE_LABELS: Record<PlateType, string> = {
  private: 'خصوصي',
  transport: 'نقل خاص',
  motorcycle: 'دراجة نارية',
}

/** الحد الأقصى لعدد الحروف حسب نوع اللوحة. */
export const PLATE_TYPE_MAX_LETTERS: Record<PlateType, number> = {
  private: 3,
  transport: 3,
  motorcycle: 2,
}

export type PlateEmblem =
  | 'none'
  | 'palm-swords-black'
  | 'palm-swords-gold'
  | 'vision-2030'
  | 'dereyah'
  | 'madaen'
  | 'custom'

export const PLATE_EMBLEMS: readonly PlateEmblem[] = [
  'palm-swords-black',
  'palm-swords-gold',
  'vision-2030',
  'dereyah',
  'madaen',
  'none',
  'custom',
]

export const PLATE_EMBLEM_LABELS: Record<PlateEmblem, string> = {
  'palm-swords-black': 'النخلة والسيفان (الافتراضي)',
  'palm-swords-gold': 'النخلة والسيفان — ذهبي',
  'vision-2030': 'رؤية السعودية 2030',
  dereyah: 'الدرعية',
  madaen: 'مدائن صالح',
  none: 'بدون شعار وسطي',
  custom: 'شعار مخصص (رفع صورة)',
}

/**
 * `fill` تملأ حاوية بأبعاد محدّدة وتحافظ على نسبتها داخلها.
 * تُستعمل حيث يجب أن تتساوى ارتفاعات البطاقات مهما اختلف نوع اللوحة.
 */
export type PlateSize = 'thumbnail' | 'card' | 'stage' | 'fullscreen' | 'fill'

export type Plate = {
  plateType: PlateType
  /** نوع الإصدار — الطويلة افتراضًا لما أُنشئ قبل وجود الخيار */
  plateFormat: PlateFormat
  arabicLetters: string
  latinLetters: string
  plateNumbers: string
  emblem: PlateEmblem
  customEmblemUrl: string | null
}

// ---------------------------------------------------------------- طرق البيع

/**
 * طرق عرض اللوحة في السوق:
 *  - `auction`: مزاد بمزايدات وعدّاد وسعر احتياطي.
 *  - `fixed`  : بيع مباشر بسعر ثابت — الشراء بضغطة واحدة.
 *  - `offers` : استقبال عروض من المشترين، والبائع يقبل أو يرفض.
 */
export type SaleType = 'auction' | 'fixed' | 'offers'

export const SALE_TYPES: readonly SaleType[] = ['auction', 'fixed', 'offers']

export const SALE_TYPE_LABELS: Record<SaleType, string> = {
  auction: 'مزاد',
  fixed: 'بيع مباشر',
  offers: 'استقبال عروض',
}

export const SALE_TYPE_HINTS: Record<SaleType, string> = {
  auction: 'مزايدات تصاعدية بمدة محددة، مع تمديد تلقائي وسعر احتياطي مخفي.',
  fixed: 'سعر ثابت معلن، ويشتري أول من يضغط «اشترِ الآن».',
  offers: 'يرسل المشترون عروضهم وتختار أنت العرض المناسب.',
}

/**
 * حالة الإعلان:
 *  draft → مسودة عند البائع.
 *  scheduled → منشور ومزاده يبدأ لاحقًا.
 *  active → معروض للتداول (مزاد جارٍ أو بيع مباشر أو استقبال عروض).
 *  sold → بيع/رسا على مشترٍ.
 *  reserve_not_met → انتهى المزاد دون بلوغ السعر الاحتياطي.
 *  no_bids → انتهى المزاد بلا أي مزايدة.
 *  cancelled → ألغاه البائع.
 */
export type ListingStatus =
  | 'draft'
  | 'scheduled'
  | 'active'
  | 'sold'
  | 'reserve_not_met'
  | 'no_bids'
  /** ألغاه **البائع** انسحابًا — ملكه، يعيد عرضه متى شاء */
  | 'cancelled'
  /**
   * أوقفته **الإدارة** لمخالفة.
   *
   * حالة مستقلّة عن `cancelled` عمدًا: لو جمعتهما حالةٌ واحدة لصار كل ما
   * يملكه البائع على إلغائه — إعادة عرض وحذف — مملوكًا له على إيقاف الإدارة،
   * فيُبطل المخالفُ إجراءَ الردع بضغطتين.
   */
  | 'suspended'

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  draft: 'مسودة',
  scheduled: 'مجدول',
  active: 'معروض',
  sold: 'مُباع',
  reserve_not_met: 'لم يبلغ السعر الاحتياطي',
  no_bids: 'انتهى دون مزايدات',
  cancelled: 'ملغاة',
  suspended: 'موقوف من الإدارة',
}

export const CLOSED_LISTING_STATUSES: readonly ListingStatus[] = [
  'sold',
  'reserve_not_met',
  'no_bids',
  'cancelled',
  'suspended',
]

export function isClosedListing(status: ListingStatus): boolean {
  return CLOSED_LISTING_STATUSES.includes(status)
}

/**
 * ما يستطيع **البائع** إعادة عرضه.
 *
 * كلّ مغلق إلا اثنين: `sold` صفقة تمّت، و`suspended` قرار إدارة لا يرفعه
 * صاحب المخالفة.
 */
export function canSellerRelist(status: ListingStatus): boolean {
  return isClosedListing(status) && status !== 'sold' && status !== 'suspended'
}

// ---------------------------------------------------------------- الكيانات

export type User = {
  id: string
  /**
   * رقم العضوية — `U26-00001`.
   *
   * `id` معرّف داخلي عشوائي لا يُملى في مكالمة ولا يُكتب في رسالة دعم.
   * والمنصّة متعدّدة المستخدمين، فيحتاج كلٌّ رقمًا يُعرّفه به.
   */
  reference: string
  email: string
  displayName: string
  phone: string | null
  city: string | null
  avatarUrl: string | null
  /**
   * حسابات التواصل — لبثّ المزادات لاحقًا.
   *
   * تُخزَّن **بلا `@`** وبحروف صغيرة: المستخدم يكتبها كيفما شاء، والتخزين
   * شكل واحد كي لا يتكرّر الحساب نفسه بصيغتين. والعرض يضيف `@` مجدّدًا.
   */
  social: SocialHandles
  /**
   * حساب الإيداع — إليه تُصرف عوائد البيع وما يُعاد من صفقات.
   *
   * فارغٌ حتى يملأه صاحبه: المنصّة لا تخمّن آيبانًا، وأمر صرفٍ بلا حساب يقف
   * عند المحاسب بلافتة «بيانات ناقصة» بدل أن يُحوَّل إلى رقم مظنون.
   */
  payout: PayoutAccount
  /**
   * معرّفه العلنيّ — في رابط معرضه، وبديلًا عن اسمه إن شاء.
   *
   * `/u/usr_17c8063b77a146f1a137` رابطٌ لا يُملى في مجلس ولا يُكتب في بطاقة،
   * و`/u/waleed` يُملى. وهو اختياريّ: من لم يختره بقي رابطه بمعرّفه الداخليّ
   * ولم يُجبَر على انتقاء اسمٍ لا يريده.
   *
   * ويُخزَّن بحروف صغيرة كي لا يتنازع اثنان على الاسم نفسه بصيغتين.
   */
  handle: string | null
  /**
   * ما يُعرَض في المعرض: اسمه أو معرّفه.
   *
   * من يبيع لوحاتٍ لعملائه قد لا يريد اسمه الكامل في صفحةٍ تُنشَر في مجموعة —
   * والاختيار له لا للمنصّة.
   */
  showcaseUsesHandle: boolean
  createdAt: string
}

/** ما يُقبل معرّفًا علنيًّا — حروف لاتينية وأرقام وشرطة سفلية، ٣ إلى ٣٠. */
export const HANDLE_PATTERN = /^[a-z0-9_]{3,30}$/

/**
 * أسماءٌ لا تُترك لمن سبق إليها.
 *
 * المعرّف يقع في `/u/<x>` مباشرةً، فمن أخذ `admin` أو `market` صار رابطه
 * يُقرأ صفحةً من صفحات المنصّة — ومن أخذ `support` انتحل جهةً لا يملكها.
 */
export const RESERVED_HANDLES = new Set([
  'admin', 'account', 'api', 'market', 'login', 'register', 'logout', 'checkout',
  'faq', 'brand', 'support', 'help', 'settings', 'u', 'me', 'new', 'null',
])

/** حسابات التواصل الثلاثة — `null` يعني لم يُدخله صاحبه. */
export type SocialHandles = {
  tiktok: string | null
  snapchat: string | null
  instagram: string | null
}

export const EMPTY_SOCIAL: SocialHandles = { tiktok: null, snapchat: null, instagram: null }

export type SocialPlatform = keyof SocialHandles

export const SOCIAL_PLATFORMS: readonly SocialPlatform[] = ['tiktok', 'snapchat', 'instagram']

export const SOCIAL_LABELS: Record<SocialPlatform, string> = {
  tiktok: 'تيك توك',
  snapchat: 'سناب شات',
  instagram: 'إنستقرام',
}

/** رابط الحساب على المنصّة — للفتح المباشر من لوحة الإدارة. */
export const SOCIAL_URL: Record<SocialPlatform, (handle: string) => string> = {
  tiktok: (handle) => `https://www.tiktok.com/@${handle}`,
  snapchat: (handle) => `https://www.snapchat.com/add/${handle}`,
  instagram: (handle) => `https://www.instagram.com/${handle}`,
}

/**
 * يُطبّع المُدخل إلى الشكل المخزَّن.
 *
 * يقبل ما يلصقه الناس فعلًا: `@name` و`name` ورابطًا كاملًا — ويُخرج الاسم
 * وحده. ما ليس اسم حساب صالحًا يعود `null` بدل أن يُخزَّن نصًّا لا يُفتح.
 */
export function normalizeSocialHandle(input: string | null | undefined): string | null {
  if (!input) return null
  let value = input.trim()
  if (!value) return null

  // رابط كامل: نأخذ آخر جزء ذي معنى من المسار
  const urlMatch = value.match(/^https?:\/\/[^\s/]+\/(?:add\/)?@?([^/?#\s]+)/i)
  if (urlMatch) value = urlMatch[1]

  value = value.replace(/^@+/, '').trim().toLowerCase()
  // حروف وأرقام وشرطة سفلية ونقطة فقط — وهو القاسم المشترك بين المنصّات الثلاث
  return /^[a-z0-9._]{2,30}$/.test(value) ? value : null
}

export type Listing = {
  id: string
  /**
   * رقم الإعلان — `L26-00043`، مستقلّ عن أرقام اللوحة المطبوعة عليها.
   *
   * سُمّي «رقم الإعلان» لا «رقم اللوحة» عمدًا: خلطهما يجعل «اللوحة 4040»
   * جملة غامضة.
   */
  reference: string
  sellerId: string
  plateType: PlateType
  plateFormat: PlateFormat
  arabicLetters: string
  latinLetters: string
  plateNumbers: string
  emblem: PlateEmblem
  customEmblemUrl: string | null
  description: string | null
  saleType: SaleType
  status: ListingStatus

  /** بيع مباشر: السعر المعلن. مزاد: غير مستخدم. */
  price: Halalas
  /** مزاد: السعر الافتتاحي والحد الأدنى للزيادة */
  startingPrice: Halalas
  minimumIncrement: Halalas
  /** سرّي: لا يغادر الخادم إطلاقًا */
  reservePrice: Halalas
  /** استقبال عروض: أقل عرض مقبول (0 = بلا حد) */
  minimumOffer: Halalas

  durationSeconds: number
  extensionTriggerSeconds: number
  extensionDurationSeconds: number
  extensionResetsTimer: boolean
  allowCustomBid: boolean

  /** العربون المطلوب لدخول المزاد — 0 يعني مزادًا بلا عربون */
  depositAmount: Halalas
  /** مهلة سداد الفائز بالساعات، تبدأ من لحظة رسوّ المزاد */
  paymentWindowHours: number
  /**
   * لقطة إعدادات الضمان وقت النشر.
   *
   * تُنسخ كما يُنسخ `forfeitPercent`: تغيير الإعدادات لاحقًا لا يُقصّر مهلة
   * صفقة جارية ولا يُطيلها — القواعد التي بدأ عليها الطرفان هي التي تحكمهما.
   */
  escrowTransferWindowHours: number
  /** مهلة مراجعة الإدارة لإثبات النقل — تُقاس بها تأخّرها لا صمت المشتري */
  escrowReviewWindowHours: number
  escrowDisputeWindowHours: number
  escrowReleaseUndoWindowHours: number
  /**
   * كم يُصادَر من عربون الفائز إذا انقضت المهلة — نسبة 0–100.
   * لقطة من قواعد المزاد وقت النشر، فتغيير الإعدادات لا يمسّ عربونًا محجوزًا.
   */
  forfeitPercent: number
  /** مهلة التراجع عن المصادرة بالساعات — لقطة كذلك */
  forfeitUndoWindowHours: number
  /** فكّ حجز عرابين الخاسرين تلقائيًا فور انتهاء المزاد */
  refundDepositOnLoss: boolean

  startsAt: string | null
  endsAt: string | null
  endedAt: string | null
  highestBidId: string | null
  soldToUserId: string | null
  soldAmount: Halalas
  viewCount: number
  createdAt: string
  updatedAt: string
}

export type BidStatus = 'accepted' | 'cancelled'

export type Bid = {
  id: string
  listingId: string
  bidderId: string
  amount: Halalas
  status: BidStatus
  serverSequence: number
  createdAt: string
  cancelledAt: string | null
  cancellationReason: string | null
}

export type OfferStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn'

export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  pending: 'بانتظار الرد',
  accepted: 'مقبول',
  declined: 'مرفوض',
  withdrawn: 'مسحوب',
}

export type Offer = {
  id: string
  listingId: string
  buyerId: string
  amount: Halalas
  message: string | null
  status: OfferStatus
  createdAt: string
  respondedAt: string | null
}

/**
 * مراحل الصفقة.
 *
 * القاعدة الحاكمة للتسمية: **المرحلة المفتوحة تُسمّى بمن عليه الدور، والنهائية
 * تُسمّى بموضع المال** — لا بالملام. فلا تتضخّم الحالات بتمييز من أخطأ، ويُقرأ
 * المسار بلمحة: من ينتظر ماذا، وأين استقرّ المال.
 */
export type OrderStatus =
  /** الدور على المشتري: يسدّد */
  | 'awaiting_settlement'
  /** وصل المال وحُجز أمانةً — الدور على البائع لينقل الملكية ويرفع إثباتها */
  | 'escrow_held'
  /** وصل إثبات النقل — الدور على الإدارة لتتحقّق ثم تحوّل المبلغ */
  | 'ownership_transferred'
  /** اعتراض — الدور على الإدارة، ولا مؤقّت يجري */
  | 'disputed'
  /** وصل المال إلى البائع */
  | 'completed'
  /** عاد المال إلى المشتري */
  | 'refunded'
  /** أُغلقت قبل السداد */
  | 'cancelled'
  /** لم يُسدَّد خلال المهلة */
  | 'defaulted'

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  awaiting_settlement: 'بانتظار السداد',
  escrow_held: 'المبلغ محجوز — بانتظار نقل الملكية',
  ownership_transferred: 'نُقلت الملكية — بانتظار تحقّق الإدارة',
  disputed: 'اعتراض قيد المراجعة',
  completed: 'اكتملت — وصل المبلغ للبائع',
  refunded: 'عاد المبلغ للمشتري',
  cancelled: 'ملغي',
  defaulted: 'أُغلقت لعدم السداد',
}

/** المراحل التي ما زالت الصفقة فيها حيّة ولم يستقرّ مالها. */
export const OPEN_ORDER_STATUSES: readonly OrderStatus[] = [
  'awaiting_settlement',
  'escrow_held',
  'ownership_transferred',
  'disputed',
]

/** المراحل التي وصل فيها المال إلى المنصّة ولم يخرج بعد. */
export const ESCROW_ORDER_STATUSES: readonly OrderStatus[] = [
  'escrow_held',
  'ownership_transferred',
  'disputed',
]

export function isEscrowHeld(status: OrderStatus): boolean {
  return ESCROW_ORDER_STATUSES.includes(status)
}

/** لا انتقال بعدها — استقرّ المال. */
export function isFinalOrderStatus(status: OrderStatus): boolean {
  return status === 'completed' || status === 'refunded' || status === 'cancelled' || status === 'defaulted'
}

/**
 * أمر شراء يوثّق الصفقة داخل المنصّة.
 * المنصّة لا تنفّذ أي تحويل مالي: السداد ونقل الملكية يتمّان خارجها،
 * والبائع هو من يعلّم الصفقة مكتملة.
 */
export type Order = {
  id: string
  /** رقم الصفقة — `S26-00001` */
  reference: string
  listingId: string
  buyerId: string
  sellerId: string
  amount: Halalas
  /** كيف تمّت الصفقة */
  source: 'auction' | 'fixed' | 'offer'
  status: OrderStatus
  /** نهاية مهلة السداد — بعدها يجوز للإدارة إعلان التخلّف ومصادرة العربون */
  paymentDueAt: string | null
  /** العربون المرتبط بهذه الصفقة، إن وُجد */
  depositId: string | null

  // ------------------------------------------------------------- الضمان

  /** لحظة وصول المال إلى المنصّة — بها يبدأ الضمان */
  paidAt: string | null
  /** ما حُجز أمانةً: قيمة الصفقة. يُثبَّت لحظة التحصيل فلا يُعاد حسابه */
  escrowAmount: Halalas
  /** نهاية مهلة البائع لنقل الملكية — انقضاؤها يفتح للمشتري طلب الاسترداد */
  transferDueAt: string | null
  /** ما كتبه البائع إثباتًا للنقل، ولحظة رفعه */
  transferProofNote: string | null
  transferProofAt: string | null
  /*
   * نهاية مهلة **الإدارة** للتحقّق من النقل — بانقضائها تُذكَّر ولا يتحرّك مال.
   *
   * والاسم من زمن كان التأكيد فيه على المشتري ومهلته تُفرج المال بسكوته. وقد
   * صار التحويل قرار إدارة، فبقي الحقل وتبدّل معناه: يُقاس به تأخّر الإدارة لا
   * صمت المشتري. ويبقى الاسم كما هو لأنه مكتوبٌ في بيانات قائمة.
   */
  confirmDueAt: string | null
  /** الاعتراض: لحظته وسببه ومن رفعه */
  disputedAt: string | null
  disputeReason: string | null
  disputedBy: string | null
  /** قيد العائد في محفظة البائع — وجوده يمنع الإفراج مرّتين */
  payoutLedgerEntryId: string | null
  releasedAt: string | null
  /**
   * علامات التذكيرات المُرسَلة قبل انقضاء المهلة (`24h` · `6h` · `overdue`).
   * وجودها يمنع تكرار التذكير في كل مسح.
   */
  remindersSent: string[]
  createdAt: string
  completedAt: string | null
}

import type { OrderSettlement, OrderTimelineStep } from './order-timeline'

export type ListingEventType =
  | 'listing_published'
  | 'bid_placed'
  | 'bid_cancelled'
  | 'time_extended'
  | 'auction_ended'
  | 'offer_placed'
  | 'offer_accepted'
  | 'offer_declined'
  | 'listing_sold'
  | 'listing_cancelled'

export type ListingEvent = {
  id: string
  listingId: string
  eventType: ListingEventType
  payload: Record<string, unknown>
  createdAt: string
}

export type AuditLog = {
  id: string
  actorId: string | null
  action: string
  entityType: string
  entityId: string
  beforeData: Record<string, unknown> | null
  afterData: Record<string, unknown> | null
  createdAt: string
}

// ---------------------------------------------------------------- الحمولات العامة

export type PublicReserveState = 'unknown' | 'not_met' | 'met'

export type PublicSeller = {
  id: string
  displayName: string
  city: string | null
  memberSince: string
}

export type PublicBid = {
  id: string
  bidderName: string
  amount: Halalas
  status: BidStatus
  createdAt: string
  isMine: boolean
}

/** بطاقة إعلان في السوق — بلا سعر احتياطي ولا بيانات تواصل. */
export type ListingCard = {
  id: string
  /** رقم الإعلان المعروض — يُبحث به ويُقتبَس في المراسلة */
  reference: string
  plate: Plate
  saleType: SaleType
  status: ListingStatus
  /** السعر المعروض حاليًا: سعر البيع المباشر أو أعلى مزايدة أو السعر الافتتاحي */
  displayPrice: Halalas
  /** تسمية السعر المعروض */
  priceLabel: string
  bidCount: number
  offerCount: number
  endsAt: string | null
  remainingMs: number
  sellerName: string
  createdAt: string
}

/** تفاصيل إعلان كاملة للعرض العام. */
export type ListingDetail = {
  id: string
  reference: string
  plate: Plate
  description: string | null
  saleType: SaleType
  status: ListingStatus
  seller: PublicSeller
  isMine: boolean

  price: Halalas
  startingPrice: Halalas
  minimumIncrement: Halalas
  minimumOffer: Halalas
  nextBidAmount: Halalas
  highestAmount: Halalas | null
  highestBidderName: string | null
  iAmHighest: boolean
  bidCount: number
  reserveState: PublicReserveState

  durationSeconds: number
  extensionTriggerSeconds: number
  extensionDurationSeconds: number
  allowCustomBid: boolean

  /** العربون المطلوب للمزايدة — 0 يعني بلا عربون */
  depositAmount: Halalas
  paymentWindowHours: number
  /** حالة عربون الزائر نفسه على هذا الإعلان */
  myDepositStatus: DepositStatus | null
  /** رصيد الزائر المتاح — لتعرف الواجهة إن كان يكفي العربون قبل المحاولة */
  myAvailableBalance: Halalas | null

  /**
   * عمولة المنصّة على هذه الصفقة كما تُحسب الآن.
   *
   * تُعرض **قبل** المزايدة والشراء: رسم يُكتشف بعد الالتزام يُفسد الثقة أكثر
   * ممّا يجمع من إيراد. ويُحسب على السعر القائم، فيتغيّر مع كل مزايدة.
   */
  commission: {
    /** ما يدفعه المشتري فوق ثمن اللوحة */
    buyer: CommissionBreakdown
    /** ما يُقتطع من البائع من حصيلته */
    seller: CommissionBreakdown
    vatPercent: number
    vatEnabled: boolean
  }

  startsAt: string | null
  endsAt: string | null
  endedAt: string | null
  remainingMs: number
  viewCount: number

  soldAmount: Halalas
  soldToMe: boolean
  /**
   * صفقة الزائر على هذه اللوحة إن كان طرفها — مشتريًا أو بائعًا.
   *
   * تجعل صفحة الإعلان تعرض مسار صفقته حيث ينظر إليها فعلًا، بدل أن يُحال إلى
   * «مشترياتي» ليعرف أين وصلت.
   */
  myOrder: { order: AccountOrder; side: 'buyer' | 'seller' } | null

  /** كشف المزايدات كاملًا (يشمل الملغاة موسومة) */
  ledger: PublicBid[]
  /** عروضي على هذا الإعلان — للمشتري فقط */
  myOffers: Offer[]
  serverTime: string
}

/** ملخّص إعلان في صفحات الحساب. */
export type AccountListing = Listing & {
  bidCount: number
  offerCount: number
  pendingOfferCount: number
  highestAmount: Halalas | null
  highestBidderName: string | null
  reserveGap: Halalas
  reserveMet: boolean
}

export type AccountBid = {
  listingId: string
  plate: Plate
  saleType: SaleType
  listingStatus: ListingStatus
  myHighest: Halalas
  currentHighest: Halalas | null
  isHighest: boolean
  endsAt: string | null
  remainingMs: number
}

export type AccountOffer = Offer & {
  plate: Plate
  listingStatus: ListingStatus
  counterpartName: string
}

export type AccountOrder = Order & {
  plate: Plate
  counterpartName: string
  /** التفصيل المالي: كم خُصم من العربون وكم بقي للسداد */
  settlement: OrderSettlement
  /** مراحل الصفقة من نشأتها إلى إغلاقها */
  timeline: OrderTimelineStep[]
}

// ================================================================ المحفظة

/**
 * المحفظة رصيدان لا رصيد واحد:
 *  `balance` كل ما يملكه المستخدم، و`held` ما هو محجوز كعرابين في مزادات جارية.
 *  ما يستطيع استعماله فعلًا هو الفرق بينهما — وهذا ما تحرسه `availableBalance`.
 *
 * المنصّة لا تنفّذ تحويلات مالية: الشحن والسحب يوثّقهما الأدمن بعد تمامهما خارجها.
 */
export type Wallet = {
  userId: string
  balance: Halalas
  held: Halalas
  updatedAt: string
}

/** الرصيد القابل للاستعمال = الكلي ناقص المحجوز. */
export function availableBalance(wallet: Pick<Wallet, 'balance' | 'held'>): Halalas {
  return Math.max(0, wallet.balance - wallet.held)
}

export type LedgerDirection = 'credit' | 'debit'

export type LedgerEntryType =
  | 'topup'
  | 'withdrawal'
  | 'deposit_hold'
  | 'deposit_release'
  | 'deposit_forfeit'
  | 'deposit_applied'
  | 'sale_proceeds'
  | 'purchase_payment'
  | 'purchase_refund'
  | 'commission'
  | 'vat'
  | 'adjustment'

export const LEDGER_ENTRY_LABELS: Record<LedgerEntryType, string> = {
  topup: 'شحن رصيد',
  withdrawal: 'سحب رصيد',
  deposit_hold: 'حجز عربون',
  deposit_release: 'عربون عاد للمحفظة',
  deposit_forfeit: 'مصادرة عربون',
  deposit_applied: 'خصم العربون من الصفقة',
  sale_proceeds: 'عائد بيع',
  purchase_payment: 'سداد شراء',
  purchase_refund: 'ردّ سداد',
  commission: 'عمولة المنصّة',
  vat: 'ضريبة القيمة المضافة',
  adjustment: 'تسوية إدارية',
}

/**
 * اتجاه كل نوع في كشف الحساب.
 * الحجز وفكّه لا يغيّران الرصيد الكلي — يحرّكان المحجوز فقط — ولذلك يظهران
 * في الكشف بلا أثر على عمودَي المدين والدائن.
 */
export const LEDGER_ENTRY_DIRECTION: Record<LedgerEntryType, LedgerDirection | 'neutral'> = {
  topup: 'credit',
  withdrawal: 'debit',
  deposit_hold: 'neutral',
  deposit_release: 'neutral',
  deposit_forfeit: 'debit',
  deposit_applied: 'debit',
  sale_proceeds: 'credit',
  purchase_payment: 'debit',
  purchase_refund: 'credit',
  commission: 'debit',
  vat: 'debit',
  adjustment: 'credit',
}

/** قيد واحد في كشف حساب المستخدم — لا يُعدَّل ولا يُحذف بعد كتابته. */
export type LedgerEntry = {
  id: string
  /** رقم الحركة — `W26-00001`، يُقتبَس في المراسلة عن قيد بعينه */
  reference: string
  userId: string
  type: LedgerEntryType
  direction: LedgerDirection | 'neutral'
  /** موجب دائمًا؛ الاتجاه يحدّده `direction` */
  amount: Halalas
  /** الرصيد والمحجوز بعد هذا القيد — يجعل الكشف قابلًا للتدقيق سطرًا بسطر */
  balanceAfter: Halalas
  heldAfter: Halalas
  listingId: string | null
  depositId: string | null
  orderId: string | null
  note: string | null
  /** الأدمن الذي نفّذ القيد، إن كان قيدًا إداريًا */
  actorAdminId: string | null
  createdAt: string
}

// ================================================================ العرابين

export type DepositStatus = 'held' | 'released' | 'forfeited' | 'applied'

export const DEPOSIT_STATUS_LABELS: Record<DepositStatus, string> = {
  held: 'محجوز',
  // «مُفكّ» وصف إجراء داخلي؛ صاحب المال يسأل أين صار لا ما فُعل به
  released: 'متاح في المحفظة',
  forfeited: 'مُصادَر',
  applied: 'خُصم من الصفقة',
}

/**
 * عربون مزايد في مزاد واحد.
 * يُحجز عند أول مزايدة، ويُفكّ عند الخسارة، ويُصادَر أو يُخصم من الصفقة عند الفوز.
 */
export type Deposit = {
  id: string
  /** رقم العربون — `D26-00001` */
  reference: string
  listingId: string
  userId: string
  amount: Halalas
  status: DepositStatus
  /**
   * ما صودر فعلًا — قد يكون جزءًا من `amount` حسب نسبة المصادرة في قواعد
   * المزاد. الباقي يعود إلى الرصيد المتاح في العملية نفسها.
   */
  forfeitedAmount: Halalas
  createdAt: string
  resolvedAt: string | null
  resolvedByAdminId: string | null
  reason: string | null
}

// ================================================================ الأسئلة الشائعة

export type FaqCategory = 'general' | 'bidding' | 'deposit' | 'payment' | 'selling'

export const FAQ_CATEGORIES: readonly FaqCategory[] = [
  'general',
  'bidding',
  'deposit',
  'payment',
  'selling',
]

export const FAQ_CATEGORY_LABELS: Record<FaqCategory, string> = {
  general: 'عام',
  bidding: 'المزايدة',
  deposit: 'العربون',
  payment: 'السداد',
  selling: 'البيع',
}

export type FaqItem = {
  id: string
  question: string
  answer: string
  category: FaqCategory
  /** ترتيب العرض تصاعديًا */
  sortOrder: number
  published: boolean
  /**
   * طرق البيع التي يظهر السؤال أسفل صفحاتها — فارغةٌ تعني صفحة الأسئلة وحدها.
   *
   * كان الحقل رايةً واحدة: «يظهر أسفل صفحة المزاد». والصفحة ثلاثٌ لا واحدة —
   * مزادٌ وبيعٌ مباشر وسوم — وأسئلتها تفترق: من يسأل عن العربون والتمديد
   * مزايدٌ، ومن يسأل «متى يصلني المبلغ؟» يشتري مباشرة. فراية واحدة تُنزل
   * سؤال المزاد على صفحةٍ لا مزاد فيها.
   */
  showOnSaleTypes: SaleType[]
  createdAt: string
  updatedAt: string
}

// ================================================================ الإدارة

/**
 * حساب إداري منفصل تمامًا عن `User`.
 *
 * الفصل مقصود: لا حقل «دور» على المستخدم، فلا يتسرّب إلى أي حمولة عامة،
 * ولا يصير رفع صلاحية مستخدم عاديًا خطأً واردًا. وجلسة الأدمن بكوكي مستقلّ
 * فيمكن فتح لوحة الإدارة وحساب مستخدم عادي في المتصفّح نفسه معًا.
 */
export type AdminAccount = {
  id: string
  email: string
  displayName: string
  createdAt: string
  lastLoginAt: string | null
}

// ================================================================ حمولات الإدارة

export type AdminUserRow = {
  id: string
  reference: string
  displayName: string
  /** معرّفه العلنيّ — يُعرَض إلى جانب رقم عضويته */
  handle: string | null
  /*
   * البريد يبقى في السطر لأنّ **البحث** يجري عليه — والدعم يُسأل به.
   * وعرضُه في البطاقة شيءٌ آخر: انظر صفحة القائمة.
   */
  email: string
  phone: string | null
  city: string | null
  createdAt: string
  balance: Halalas
  held: Halalas
  available: Halalas
  listingCount: number
  activeListingCount: number
  bidCount: number
  purchaseCount: number
  saleCount: number
  /** صفقات تجاوزت مهلة السداد ولم تُسوَّ */
  overdueCount: number
}

export type AdminMetrics = {
  users: number
  listings: number
  activeListings: number
  liveAuctions: number
  bids: number
  orders: number
  openOrders: number
  overdueOrders: number
  defaultedOrders: number
  grossSales: Halalas
  walletBalance: Halalas
  heldDeposits: Halalas
  forfeitedDeposits: Halalas
  /** حوالات بنكية أبلغ بها المستخدمون وتنتظر تحقّق الإدارة */
  paymentsUnderReview: number
  paymentsUnderReviewAmount: Halalas
  /** ما تحمله المنصّة أمانةً في صفقات جارية — ليس مالها */
  escrowHeld: Halalas
  escrowOrders: number
  /** إيراد محصَّل لكل يوم من آخر سبعة — أقدمها أوّلًا */
  revenueByDay: { day: string; amount: Halalas }[]
}

/** القيم الافتراضية لإعدادات العربون والسداد في إعلان جديد. */
export const LISTING_DEFAULTS = {
  /** بلا عربون افتراضيًا — البائع هو من يفعّله */
  depositAmount: 0,
  /** 48 ساعة مهلة سداد: كافية للتحويل البنكي ونقل الملكية دون تعطيل اللوحة */
  paymentWindowHours: 48,
  forfeitDepositOnDefault: true,
  refundDepositOnLoss: true,
} as const

// ================================================================ المدفوعات

export type PaymentMethod = 'tap' | 'bank_transfer' | 'wallet'

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  tap: 'بطاقة عبر Tap',
  bank_transfer: 'حوالة بنكية',
  wallet: 'رصيد المحفظة',
}

/**
 * حالة عملية الدفع.
 *
 *  initiated             أُنشئت وبانتظار توجّه المستخدم للبوابة.
 *  awaiting_transfer     حوالة بنكية: عُرضت البيانات وننتظر تحويل المستخدم.
 *  under_review          المستخدم أبلغ بالتحويل وننتظر تحقّق الإدارة منه.
 *  paid                  تأكّد الدفع وأُضيف الرصيد.
 *  failed                رُفض أو فشل.
 *  cancelled             ألغاها المستخدم أو انقضت.
 */
export type PaymentStatus =
  | 'initiated'
  | 'awaiting_transfer'
  | 'under_review'
  | 'paid'
  | 'failed'
  | 'cancelled'

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  initiated: 'بانتظار الدفع',
  awaiting_transfer: 'بانتظار التحويل',
  under_review: 'قيد المراجعة',
  paid: 'مدفوعة',
  failed: 'فاشلة',
  cancelled: 'ملغاة',
}

export const OPEN_PAYMENT_STATUSES: readonly PaymentStatus[] = [
  'initiated',
  'awaiting_transfer',
  'under_review',
]

export function isClosedPayment(status: PaymentStatus): boolean {
  return !OPEN_PAYMENT_STATUSES.includes(status)
}

export type TapMode = 'test' | 'live'

export type Payment = {
  id: string
  userId: string
  /**
   * الصفقة التي تُسدَّد بهذه العملية — `null` لشحن رصيد.
   *
   * بدونه لا يُعرف عمّاذا دُفع: شحنٌ للمحفظة أم سدادُ لوحة بعينها.
   */
  orderId: string | null
  amount: Halalas
  method: PaymentMethod
  status: PaymentStatus
  /** رقم مرجعي قصير يذكره المستخدم في حوالته ويبحث به الأدمن */
  reference: string

  /**
   * تفصيل المبلغ **مجمَّدًا لحظة الإنشاء** — لعمليات الصفقات وحدها (`null` للشحن).
   *
   * الإيراد يُقيَّد بهذه القيم لا بإعادة حسابها لحظة التأكيد: بين بدء الحوالة
   * وتأكيدها قد تتغيّر نسبة العمولة أو تُعطَّل، فيصير المُقيَّد غير ما دفعه
   * المشتري فعلًا.
   */
  orderPrice: Halalas | null
  buyerCommission: Halalas | null
  buyerVat: Halalas | null

  /** Tap: معرّف عملية الشحن وبيئتها ورمز آخر خطأ */
  tapChargeId: string | null
  tapMode: TapMode | null
  tapStatus: string | null

  /** الحوالة البنكية: ما أدخله المستخدم إثباتًا لتحويله */
  transferNote: string | null

  /** القيد الناتج عند النجاح — وجوده يمنع إضافة الرصيد مرتين */
  ledgerEntryId: string | null
  failureReason: string | null

  createdAt: string
  updatedAt: string
  settledAt: string | null
  settledByAdminId: string | null
}

/**
 * إعدادات الدفع — سجلّ واحد يضبطه الأدمن.
 *
 * **لا تحتوي مفاتيح Tap السرّية إطلاقًا.** المفاتيح من متغيّرات البيئة وحدها،
 * والأدمن يختار البيئة العاملة لا المفتاح. مفتاح سرّي في قاعدة البيانات يعني
 * تسريبه بأي نسخة احتياطية أو استعلام.
 */
export type PaymentSettings = {
  tapEnabled: boolean
  tapMode: TapMode
  bankTransferEnabled: boolean
  bankName: string
  bankAccountName: string
  bankIban: string
  bankAccountNumber: string
  /** تعليمات إضافية تظهر للمستخدم مع بيانات الحساب */
  bankInstructions: string
  updatedAt: string
  updatedByAdminId: string | null
}

export const DEFAULT_PAYMENT_SETTINGS: Omit<PaymentSettings, 'updatedAt' | 'updatedByAdminId'> = {
  // كلاهما معطّل ابتداءً: لا تُفعَّل بوابة دفع بلا قرار واعٍ من الإدارة
  tapEnabled: false,
  tapMode: 'test',
  bankTransferEnabled: false,
  bankName: '',
  bankAccountName: '',
  bankIban: '',
  bankAccountNumber: '',
  bankInstructions: '',
}

/** ما يراه المستخدم من إعدادات الدفع — بلا أي بيانات إدارية. */
export type PublicPaymentOptions = {
  tapEnabled: boolean
  /** يظهر للمستخدم شارة «وضع تجريبي» فلا يظنّ أنه يدفع فعلًا */
  tapMode: TapMode
  bankTransferEnabled: boolean
  bank: {
    name: string
    accountName: string
    iban: string
    accountNumber: string
    instructions: string
  } | null
}

// ================================================================ الإشعارات

/**
 * أنواع الإشعارات.
 *
 * كل نوع يقابل لحظة يحتاج فيها المستخدم أن يعرف شيئًا **ليتصرّف**، لا مجرّد
 * أن يُخبَر. «تجاوزك مزايد» أهمّها على الإطلاق: مزاد بلا هذا التنبيه يخسر فيه
 * المزايد لوحته وهو لا يدري أنه خرج من السباق.
 */
export type NotificationType =
  | 'outbid'
  | 'auction_won'
  | 'auction_lost'
  | 'reserve_not_met'
  | 'offer_sent'
  | 'offer_received'
  | 'offer_accepted'
  | 'offer_declined'
  | 'listing_sold'
  | 'payment_confirmed'
  | 'payment_failed'
  | 'deposit_released'
  | 'deposit_forfeited'
  | 'order_defaulted'
  | 'commission_charged'
  | 'commission_due'
  | 'payment_due_soon'
  | 'payment_overdue'
  /** مراحل الضمان */
  | 'order_escrow_held'
  | 'order_awaiting_transfer'
  | 'order_awaiting_confirmation'
  | 'order_disputed'
  | 'order_released'
  | 'order_refunded'
  /** أُعيد عرض لوحة زايد عليها — دعوة لا إلزام */
  | 'listing_relisted'
  /** أوقفت الإدارة إعلانه أو رفعت الإيقاف */
  | 'listing_suspended'
  | 'listing_reinstated'

/** الأنواع التي تستدعي تصرّفًا فوريًا — تُبرز في الواجهة. */
export const URGENT_NOTIFICATIONS: readonly NotificationType[] = [
  'outbid',
  'auction_won',
  'offer_received',
  'deposit_forfeited',
  'order_defaulted',
  'commission_due',
  'payment_due_soon',
  'payment_overdue',
  'order_awaiting_transfer',
  'order_awaiting_confirmation',
  'order_disputed',
]

export type Notification = {
  id: string
  userId: string
  type: NotificationType
  title: string
  body: string
  /** وجهة الضغط — إشعار بلا وجهة يخبر ولا يُمكّن من التصرّف */
  href: string | null
  listingId: string | null
  readAt: string | null
  createdAt: string
}

export type NotificationSummary = {
  items: Notification[]
  unread: number
}

// ================================================================ حوكمة المزاد

export type DepositMode = 'fixed' | 'percent'

/**
 * إعدادات المزاد المركزية — سجلّ واحد تضبطه الإدارة.
 *
 * **لماذا مركزية لا لكل بائع؟** العربون ومهلة السداد والتمديد التلقائي قواعد
 * حوكمة تمسّ ثقة السوق كلّه: بائع يضع عربونًا صفرًا يفتح مزاده للعبث، وآخر
 * يضع مهلة ساعة يوقع المشتري في مخالفة. توحيدها يجعل القاعدة واحدة على الجميع،
 * ويُبقي للبائع ما يخصّ لوحته وحدها: السعر الافتتاحي والزيادة والاحتياطي والمدّة.
 */
export type AuctionSettings = {
  /** كيف يُحسب العربون: مبلغ ثابت أو نسبة من السعر الافتتاحي */
  depositMode: DepositMode
  depositFixed: Halalas
  /** نسبة مئوية 0–50 */
  depositPercent: number
  /** حدّان يمنعان عربونًا تافهًا أو مانعًا للمزايدة */
  depositMin: Halalas
  depositMax: Halalas

  /** مهلة سداد الفائز بالساعات */
  paymentWindowHours: number

  /**
   * كم يُصادَر من عربون المتخلّف — نسبة مئوية 0–100.
   * صفر يعطّل المصادرة أصلًا، و100 يصادر كل المبلغ. ما دون 100 يعود للمزايد.
   */
  forfeitPercent: number
  /** مهلة التراجع عن المصادرة بالساعات — صفر يعني بلا تراجع */
  forfeitUndoWindowHours: number

  /**
   * مهلة البائع لنقل الملكية ورفع إثباتها، تبدأ من لحظة وصول المال.
   * انقضاؤها **لا ينقل مالًا** — يفتح للمشتري حقّ طلب الاسترداد.
   */
  escrowTransferWindowHours: number
  /**
   * مهلة تأكيد المشتري بعد رفع الإثبات، وبانقضائها يُفرَج تلقائيًا للبائع.
   * وهو **الانتقال الوحيد الذي يحرّك مالًا بلا فعل بشري**، فيسبقه تذكير.
   */
  escrowReviewWindowHours: number
  /** سقف زمني للاعتراض؛ بانقضائه يُنبَّه الأدمن أنه تجاوز مدّته */
  escrowDisputeWindowHours: number
  /** مهلة إبطال إفراج خاطئ — مرآة `forfeitUndoWindowHours` */
  escrowReleaseUndoWindowHours: number

  /** التمديد التلقائي */
  extensionTriggerSeconds: number
  extensionDurationSeconds: number
  extensionResetsTimer: boolean

  /** السماح للمزايد بإدخال مبلغ أعلى يدويًا */
  allowCustomBid: boolean

  updatedAt: string
  updatedByAdminId: string | null
}

export const DEFAULT_AUCTION_SETTINGS: Omit<AuctionSettings, 'updatedAt' | 'updatedByAdminId'> = {
  depositMode: 'percent',
  depositFixed: 500_000,
  // 5% من السعر الافتتاحي: نسبة تضمن الجدّية ولا تمنع المزايدة
  depositPercent: 5,
  depositMin: 100_000,
  depositMax: 5_000_000,
  paymentWindowHours: 48,
  forfeitPercent: 100,
  forfeitUndoWindowHours: 24,
  escrowTransferWindowHours: 72,
  // ثلاثة أيام: يكفي المشتري للتحقّق من نقل الملكية، ولا يُجمّد مال البائع طويلًا
  escrowReviewWindowHours: 72,
  escrowDisputeWindowHours: 168,
  escrowReleaseUndoWindowHours: 24,
  extensionTriggerSeconds: 300,
  extensionDurationSeconds: 300,
  extensionResetsTimer: true,
  allowCustomBid: true,
}

/**
 * يحسب عربون إعلان من الإعدادات المركزية.
 * يُحسب عند النشر لا عند كل مزايدة: تغيير الإعدادات لاحقًا يجب ألّا يغيّر
 * عربونًا محجوزًا على مزاد جارٍ.
 */
export function computeDeposit(
  settings: Pick<
    AuctionSettings,
    'depositMode' | 'depositFixed' | 'depositPercent' | 'depositMin' | 'depositMax'
  >,
  openingPrice: Halalas,
): Halalas {
  if (settings.depositMode === 'fixed') return Math.max(0, Math.round(settings.depositFixed))
  const raw = Math.round((openingPrice * settings.depositPercent) / 100)
  return Math.min(settings.depositMax, Math.max(settings.depositMin, raw))
}

// ================================================== العمولة والقيمة المضافة

export type CommissionMode = 'percent' | 'fixed'

/**
 * إعداد عمولة طرف واحد — البائع أو المشتري.
 *
 * لكل طرف إعداده المستقلّ لأنّ ما يُعقل على أحدهما لا يُعقل على الآخر: عمولة
 * البائع نسبة من ثمن لوحته، وعمولة المشتري كثيرًا ما تكون رسمًا ثابتًا.
 */
export type CommissionSide = {
  enabled: boolean
  mode: CommissionMode
  /** نسبة مئوية من قيمة الصفقة */
  percent: number
  /** مبلغ ثابت بالهللات */
  fixed: Halalas
  /** حدّان يمنعان عمولة تافهة أو مُجحفة — صفر في `max` يعني بلا سقف */
  min: Halalas
  max: Halalas
}

/**
 * إعدادات العمولة — سجلّ واحد تضبطه الإدارة على كل طرق البيع.
 *
 * تُحتسب لحظة **اكتمال** الصفقة لا لحظة إنشائها: صفقة لم تكتمل لا عمولة عليها.
 */
export type CommissionSettings = {
  seller: CommissionSide
  buyer: CommissionSide
  /**
   * القيمة المضافة تُطبَّق على **العمولة وحدها** لا على قيمة اللوحة: المنصّة
   * تبيع خدمة وساطة لا تبيع اللوحة، فوعاء الضريبة هو أجر الوساطة.
   */
  vatEnabled: boolean
  /** نسبة مئوية — 15 في السعودية */
  vatPercent: number
  updatedAt: string
  updatedByAdminId: string | null
}

const NO_COMMISSION: CommissionSide = {
  enabled: false,
  mode: 'percent',
  percent: 2.5,
  fixed: 50_000,
  min: 0,
  max: 0,
}

export const DEFAULT_COMMISSION_SETTINGS: Omit<
  CommissionSettings,
  'updatedAt' | 'updatedByAdminId'
> = {
  // معطّلة ابتداءً: لا تُقتطع عمولة من أحد بلا قرار واعٍ من الإدارة
  seller: { ...NO_COMMISSION },
  buyer: { ...NO_COMMISSION },
  vatEnabled: false,
  vatPercent: 15,
}

/** تفصيل عمولة طرف واحد — الأساس والضريبة ومجموعهما. */
export type CommissionBreakdown = {
  /** العمولة قبل الضريبة */
  base: Halalas
  /** الضريبة على العمولة — صفر إن كانت معطّلة */
  vat: Halalas
  /** ما يُقتطع فعلًا من الطرف */
  total: Halalas
}

export const ZERO_COMMISSION: CommissionBreakdown = { base: 0, vat: 0, total: 0 }

/**
 * يحسب عمولة طرف واحد من قيمة الصفقة.
 *
 * الترتيب مقصود: الحدّان يُطبَّقان على **الأساس** قبل الضريبة، لأن السقف
 * وعدٌ للعميل بأقصى ما يدفعه أجرًا — والضريبة فوقه التزام نظامي لا أجر.
 */
export function computeCommissionSide(
  side: CommissionSide,
  amount: Halalas,
  vat: { enabled: boolean; percent: number },
): CommissionBreakdown {
  if (!side.enabled || amount <= 0) return ZERO_COMMISSION

  const raw =
    side.mode === 'fixed'
      ? Math.round(side.fixed)
      : Math.round((amount * side.percent) / 100)

  let base = Math.max(0, raw)
  if (side.min > 0) base = Math.max(base, side.min)
  if (side.max > 0) base = Math.min(base, side.max)
  // لا تتجاوز العمولة قيمة الصفقة نفسها مهما كانت الإعدادات
  base = Math.min(base, amount)
  if (base <= 0) return ZERO_COMMISSION

  const vatAmount = vat.enabled ? Math.round((base * vat.percent) / 100) : 0
  return { base, vat: vatAmount, total: base + vatAmount }
}

/** عمولتا الطرفين معًا لصفقة واحدة. */
export function computeCommission(
  settings: Pick<CommissionSettings, 'seller' | 'buyer' | 'vatEnabled' | 'vatPercent'>,
  amount: Halalas,
): { seller: CommissionBreakdown; buyer: CommissionBreakdown; total: Halalas } {
  const vat = { enabled: settings.vatEnabled, percent: settings.vatPercent }
  const seller = computeCommissionSide(settings.seller, amount, vat)
  const buyer = computeCommissionSide(settings.buyer, amount, vat)
  return { seller, buyer, total: seller.total + buyer.total }
}

// ============================================================ حساب المنصّة

export type PlatformEntryType =
  | 'commission_seller'
  | 'commission_buyer'
  | 'vat_seller'
  | 'vat_buyer'
  | 'deposit_forfeit'

export const PLATFORM_ENTRY_LABELS: Record<PlatformEntryType, string> = {
  commission_seller: 'عمولة من البائع',
  commission_buyer: 'عمولة من المشتري',
  vat_seller: 'ضريبة على عمولة البائع',
  vat_buyer: 'ضريبة على عمولة المشتري',
  deposit_forfeit: 'عربون مُصادَر',
}

/**
 * قيد في حساب إيرادات المنصّة.
 *
 * وجوده يجعل المصادرة والعمولة قيدًا مزدوجًا لا خصمًا من طرف واحد: ما يخرج من
 * محفظة المستخدم يدخل هنا، فيُغلق الدفتر ويُعرف من أين جاء كل ريال.
 *
 * `settled` يفرّق بين إيراد **حُصّل** وإيراد **مستحقّ**: العمولة تُقتطع من
 * المحفظة إن كفى رصيدها، وإلا قُيّدت مستحقّة وبقيت ظاهرة للتحصيل.
 */
export type PlatformEntry = {
  id: string
  /** رقم القيد — `R26-00001`، مرجع إيراد المنصّة */
  reference: string
  /**
   * عملية الدفع التي حُصّل بها هذا الإيراد — `null` لما حُصّل من المحفظة.
   *
   * بدونه يُقرأ `settled: true` مع `ledgerEntryId: null` تناقضًا، وهو في
   * الحقيقة إيراد وصل **خارج المحفظة** إلى حساب المنصّة.
   */
  paymentId: string | null
  type: PlatformEntryType
  amount: Halalas
  /** من اقتُطع منه — أو من كان سيُقتطع منه لو كان الرصيد كافيًا */
  userId: string | null
  orderId: string | null
  listingId: string | null
  depositId: string | null
  settled: boolean
  /** قيد المحفظة المقابل، إن حُصّل فعلًا */
  ledgerEntryId: string | null
  note: string
  createdAt: string
  settledAt: string | null
  /** يُملأ عند التراجع عن المصادرة فيبطل القيد دون حذفه */
  reversedAt: string | null
  reversalReason: string | null
}

// ======================================================= الفوترة الضريبية

/**
 * بيانات المنشأة الضريبية — تُطبع على كل فاتورة وتدخل في رمز QR.
 *
 * لقطةٌ منها تُحفظ **مع كل فاتورة**: المنشأة قد تنتقل أو يتغيّر اسمها
 * النظامي، وفاتورةٌ صدرت قبل النقل تبقى شاهدةً على ما كان لا على ما صار.
 */
/**
 * أصلٌ مرفوع — شعارٌ أو أيقونة أو صورة مشاركة.
 *
 * البايتات في السجلّ لا في القرص: المنصّة تعمل بعملية واحدة بلا وحدة تخزين
 * ملحقة، وملفٌّ يُكتب في قرص الحاوية يضيع مع أوّل إعادة نشر. والحجم مقيَّد
 * عند الاستقبال فلا يُثقَل السجلّ بصورةٍ لا يحتاجها العرض.
 */
export type BrandAsset = {
  /** البايتات بترميز base64 — بلا بادئة `data:` */
  data: string
  mime: string
  /** اسم الملفّ الأصلي — يُعرض في اللوحة ليُعرف ما المرفوع */
  fileName: string
  bytes: number
  updatedAt: string
}

/** أقصى ما يُقبل رفعه لكل أصل — بالبايت قبل الترميز. */
export const BRAND_ASSET_LIMITS = {
  logo: 512 * 1024,
  icon: 256 * 1024,
  ogImage: 1024 * 1024,
} as const

export type BrandAssetKind = keyof typeof BRAND_ASSET_LIMITS

/**
 * هويّة المنصّة وما تُؤرشَف به.
 *
 * كان الاسم والوصف والنصوص مكتوبةً في الكود، فتغييرها يحتاج نشرًا. وهي أوّل
 * ما يبدّله من ينصب نسخته: اسمه، ولونه، وشعاره، وما يُقرأ عنه في نتائج البحث.
 *
 * والحقول الثلاثة الأخيرة ليست زينة: محرّكات البحث تقرأ `metaTitle` و
 * `metaDescription`، ومحرّكات الإجابة تقرأ البيانات المنظَّمة المبنيّة من
 * `legalName` و`sameAs`، وتحديد الموقع يُبنى من `geoRegion` و`geoPlace`.
 */
export type BrandSettings = {
  /** الاسم الكامل — في العنوان وفي البيانات المنظَّمة */
  name: string
  /** الاسم القصير — في الترويسة وفي `%s — الاسم` */
  shortName: string
  /**
   * ما يظهر في الترويسة والتذييل.
   *
   * شعارٌ مرفوعٌ مكتوبٌ فيه اسم المنصّة يجعل الاسم بجانبه تكرارًا، وشعارٌ رمزيّ
   * بلا اسم يترك الزائر لا يعرف أين هو. فالاختيار لصاحب النسخة لا حكمٌ واحد
   * يُفرَض على الشكلين.
   */
  brandDisplay: 'logoAndName' | 'logoOnly' | 'nameOnly'

  // ---- نصّ الواجهة الأولى
  heroBadge: string
  heroTitle: string
  heroHighlight: string
  heroBody: string

  // ---- الهوية البصرية
  /** اللون الأساسي بصيغة `#RRGGBB` — يشتقّ منه تدرّج الذهبي كلّه */
  primaryColor: string
  logo: BrandAsset | null
  icon: BrandAsset | null
  ogImage: BrandAsset | null

  // ---- ما تقرؤه محرّكات البحث
  metaTitle: string
  metaDescription: string
  keywords: string[]

  // ---- ما تقرؤه محرّكات الإجابة والتوليد
  legalName: string
  /** روابط الحسابات الرسمية — تربط الكيان بمواضعه الأخرى */
  sameAs: string[]
  /** رمز المنطقة ISO 3166-2 — مثل `SA-01` */
  geoRegion: string
  /** المدينة والبلد كما تُقرأ */
  geoPlace: string
  googleSiteVerification: string

  updatedAt: string
  updatedByAdminId: string | null
}

export const DEFAULT_BRAND_SETTINGS: Omit<BrandSettings, 'updatedAt' | 'updatedByAdminId'> = {
  name: 'سوق تداول لوحات المركبات',
  shortName: 'سوق اللوحات',
  brandDisplay: 'logoAndName',
  heroBadge: 'سوق تداول لوحات المركبات',
  heroTitle: 'لوحتك تسوى أكثر',
  heroHighlight: 'بِعها بسعرها الصح',
  heroBody:
    'اعرض لوحتك بيع مباشر، أو بمزاد، أو استقبل عليها عروض — ومن نفس الحساب زايد على لوحات غيرك. المزايدات توصلك لحظة بلحظة، وما يزايد عليك إلا اللي دافع عربونه، وسعرك الاحتياطي ما يشوفه أحد غيرك.',
  primaryColor: '#D6A84B',
  logo: null,
  icon: null,
  ogImage: null,
  metaTitle: 'سوق تداول لوحات المركبات',
  metaDescription:
    'سوق ويب لتداول لوحات المركبات السعودية: اعرض لوحتك للبيع المباشر أو بمزاد أو استقبل العروض، وزايد على لوحات غيرك — بحساب واحد يبيع ويشتري.',
  keywords: ['لوحات مركبات', 'مزاد لوحات', 'بيع لوحات سيارات', 'لوحات مميزة', 'السعودية'],
  legalName: '',
  sameAs: [],
  geoRegion: 'SA',
  geoPlace: 'السعودية',
  googleSiteVerification: '',
}

/* ------------------------------------------------------- صفحات المنصّة */

/**
 * نصوص الصفحات التعريفية — تُحرَّر من الإدارة لا من الملفّ.
 *
 * «من نحن» و«الشروط والأحكام» ممّا يتبدّل بتبدّل المُشغِّل: اسمه وكيانه وما
 * يلتزم به. وكانت مثلها «كيف يعمل السوق» وقسمُ الطمأنينة في الواجهة مكتوبةً
 * في ملفّات TSX، فكلّ حرفٍ فيها يحتاج نشرةً جديدة — ومن يشغّل المنصّة ليس هو
 * من يبني نسختها.
 *
 * والقوالب تبقى في الشيفرة: الأيقونات ومواضعها وترتيب البطاقات تصميمٌ لا
 * محتوى، فلا تُترك لحقلٍ نصّي يُفسد الصفحة بخطأٍ مطبعيّ.
 */
export type PageSection = { heading: string; body: string }

export type PageStep = { title: string; body: string }

/** صفحةٌ حرّة الأقسام — «من نحن» و«الشروط والأحكام». */
export type EditableDoc = {
  title: string
  intro: string
  sections: PageSection[]
  /** غير المنشورة تُخفى من التذييل وتردّ 404 — تُكتب على مهل ثمّ تُنشر */
  published: boolean
}

export type PageSettings = {
  about: EditableDoc
  terms: EditableDoc
  /**
   * «كيف يعمل السوق» — قالبها ثابت ونصّها محرَّر.
   *
   * الخطوات أربعٌ لكلّ طرف لأنّ لكلّ خطوةٍ أيقونتها في التصميم، فلا تُزاد
   * ولا تُنقص من النصّ. والقواعد قائمةٌ حرّة: لا أيقونة لها ولا عدد.
   */
  howItWorks: {
    title: string
    intro: string
    sellerTitle: string
    sellerSteps: PageStep[]
    buyerTitle: string
    buyerSteps: PageStep[]
    reserveTitle: string
    reserveBody: string
    rulesTitle: string
    rules: string[]
    settlementTitle: string
    settlementBody: string
  }
  /** قسم «بِع واشترِ وأنت مطمئن» في الواجهة — ستّ بطاقات بأيقوناتٍ ثابتة */
  trust: {
    title: string
    body: string
    features: PageStep[]
  }
  updatedAt: string
  updatedByAdminId: string | null
}

/** عدد الخطوات والبطاقات ثابتٌ لأنّ لكلٍّ أيقونتها في التصميم. */
export const HOW_IT_WORKS_STEPS = 4
export const TRUST_FEATURES = 6

export const DEFAULT_PAGE_SETTINGS: Omit<PageSettings, 'updatedAt' | 'updatedByAdminId'> = {
  about: {
    title: 'من نحن',
    intro: 'سوق سعودي لتداول لوحات المركبات، يجمع البائع والمشتري في مكان واحد ويحفظ المال بينهما حتى تكتمل الصفقة.',
    published: true,
    sections: [
      {
        heading: 'ما الذي نفعله',
        body: 'نتيح لك أن تعرض لوحتك للبيع المباشر أو بمزاد أو تستقبل عليها عروضًا، ومن الحساب نفسه تزايد على لوحات غيرك. كل لوحة إعلان مستقل بسعره وقواعده ووقته.',
      },
      {
        heading: 'لماذا نحفظ المال بيننا',
        body: 'حين تسدّد يبقى مبلغك عندنا لا يصل البائع، حتى ينقل اللوحة باسمك ويرفع إثبات النقل وتتحقّق الإدارة منه. فإن لم يتم النقل عاد المبلغ إليك كاملًا. هذه هي الخطوة التي تجعل الشراء من غريبٍ ممكنًا.',
      },
      {
        heading: 'ما نلتزم به',
        body: 'قاعدة واحدة على الجميع لا تختلف من بائع لآخر، وكشفٌ مفتوح لكل مزايدة بوقتها ومبلغها حتى الملغاة منها، وسعرك الاحتياطي سرٌّ لا يغادر خوادمنا.',
      },
    ],
  },
  terms: {
    title: 'الشروط والأحكام',
    intro: 'باستخدامك المنصّة فأنت توافق على ما يلي. اقرأها قبل أن تعرض لوحة أو تزايد.',
    published: true,
    sections: [
      {
        heading: 'الحساب',
        body: 'الحساب لشخص واحد ولا يُشارَك، وأنت مسؤول عمّا يقع فيه. وبيانات الحساب تبقى بيننا ولا تُعرض لمستخدم آخر؛ ولا يظهر للطرف الآخر إلّا ما يلزم لإتمام الصفقة.',
      },
      {
        heading: 'العرض والمزايدة',
        body: 'المزايدة وقبول العرض التزام بيعي داخل السوق لا وعدًا يُتراجع عنه. ولا تُقبل مزايدة دون المبلغ المطلوب، ولا يزايد البائع على إعلانه.',
      },
      {
        heading: 'العربون',
        body: 'يُحجز العربون من محفظتك عند المزايدة ويعود إليك كاملًا إن لم ترسُ عليك اللوحة. وإن رست عليك ولم تسدّد في المهلة جاز اقتطاع نسبةٍ منه.',
      },
      {
        heading: 'السداد ونقل الملكية',
        body: 'يُسدَّد الثمن عبر المنصّة ويبقى محفوظًا لديها حتى تنقل الملكية عبر القنوات الرسمية ويُرفع إثباتها وتتحقّق الإدارة. ولا يخرج المال إلّا بقرارها.',
      },
      {
        heading: 'العمولة',
        body: 'تُقتطع عمولة المنصّة من حصيلة البائع عند الإفراج لا من محفظته، وتُعرض قيمتها في نموذج العرض قبل النشر.',
      },
      {
        heading: 'الاعتراض',
        body: 'لك أن تفتح تذكرة استفسار أو اعتراض في أيّ وقت قبل تحويل المبلغ، فيتوقّف التحويل حتى تفصل الإدارة.',
      },
      {
        heading: 'ما ليست عليه المنصّة',
        body: 'صور اللوحات في السوق تمثيل بصري لا وثيقة رسمية ولا تمثيلًا حكوميًّا. والمنصّة وسيطٌ يحفظ المال ويوثّق الخطوات، ولا تنقل الملكية بنفسها.',
      },
    ],
  },
  howItWorks: {
    title: 'كيف يعمل السوق',
    intro: 'سوق لتداول لوحات المركبات: كل لوحة إعلان مستقل، وصاحب الحساب الواحد يبيع ويشتري.',
    sellerTitle: 'إذا كنت بائعًا',
    sellerSteps: [
      { title: 'أضف لوحتك', body: 'أدخل الحروف والأرقام واختر الشعار — تُحفظ كمسودة أولًا.' },
      { title: 'اختر طريقة البيع', body: 'بيع مباشر بسعر ثابت، أو مزاد بمزايدات، أو استقبال عروض.' },
      { title: 'انشرها في السوق', body: 'تظهر فورًا للجميع، ويبدأ عدّاد المزاد لحظة النشر.' },
      {
        title: 'انقل الملكية واقبض',
        body: 'أول ما يدفع المشتري نمسك مبلغه عندنا، تنقل اللوحة باسمه وترفع إثبات النقل، ونتأكّد ثم يوصلك المبلغ في محفظتك.',
      },
    ],
    buyerTitle: 'إذا كنت مشتريًا',
    buyerSteps: [
      { title: 'تصفّح بلا تسجيل', body: 'ابحث بالحروف أو الأرقام، وصفِّ حسب طريقة البيع والنوع.' },
      { title: 'زايد أو اشترِ', body: 'زايد في المزادات، أو اشترِ مباشرة، أو أرسل عرضك للبائع.' },
      { title: 'تابع مزايداتك', body: 'صفحة مزايداتي تُظهر أين أنت الأعلى وأين تمت المزايدة عليك.' },
      {
        title: 'سدّد ونحن نحفظ مالك',
        body: 'تسدّد عبر المنصّة فيبقى مبلغك محفوظًا لدينا لا يصل البائع، وبعد نقل الملكية تتحقّق الإدارة ثم تحوّل المبلغ للبائع. ولك أن تفتح تذكرة استفسار أو اعتراض في أيّ وقت قبل التحويل.',
      },
    ],
    reserveTitle: 'السعر الاحتياطي',
    reserveBody:
      'في المزادات يمكن للبائع تحديد سعر احتياطي سرّي. رقمه لا يظهر لأي مزايد في أي وقت، وإنما تظهر حالته فقط: «تحقق» أو «لم يتحقق بعد». إن انتهى المزاد دون بلوغه لا تُباع اللوحة.',
    rulesTitle: 'قواعد التداول',
    rules: [
      'المزايدة وقبول العرض التزام بيعي داخل السوق.',
      'ما تُقبل المزايدة إلا إذا بلغت المبلغ المطلوب أو زادت عليه.',
      'لا يمكنك المزايدة على إعلانك ولا على نفسك وأنت أعلى مزايد.',
      'وقت انتهاء المزاد واحد للجميع — ما يفرق إذا ساعة جوالك متقدّمة أو متأخّرة.',
      'أي مزايدة صحيحة في الدقائق الأخيرة تمدّد المزاد تلقائيًا.',
      'المزايدة الملغاة ما تختفي — تبقى ظاهرة في الكشف ومكتوب عليها أنها ملغاة.',
    ],
    settlementTitle: 'السداد ونقل الملكية',
    settlementBody:
      'يسدّد المشتري عبر المنصّة فيبقى المبلغ محفوظًا لديها، ثم ينقل البائع الملكية عبر القنوات الرسمية ويرفع إثباتها. وتتحقّق الإدارة من النقل ثم تحوّل المبلغ إلى البائع — لا يخرج المال إلا بقرارها. وللمشتري أن يفتح تذكرة استفسار أو اعتراض في أيّ وقت قبل التحويل، فيتوقّف التحويل حتى تفصل الإدارة.',
  },
  trust: {
    title: 'بِع واشترِ وأنت مطمئن',
    body: 'مالك محفوظ عندنا حتى تستلم لوحتك، وما يزايد عليك إلا اللي دافع عربونه، وسعرك اللي ما تبي أحد يشوفه ما يشوفه أحد. كل شي مكتوب وواضح من أول خطوة.',
    features: [
      {
        title: 'سعرك الأدنى سرّك',
        body: 'أقل سعر تقبل به تكتبه ولا يشوفه أحد غيرك — ولوحتك ما تنباع بأقل منه. المزايد يعرف بس إذا وصل له أو ما وصل.',
      },
      {
        title: 'عربون يضمن الجدّية',
        body: 'نحجز العربون من محفظتك أول ما تزايد، فما يزايد عليك إلا اللي يقدر يدفع — ويرجع لك كامل لحظة ما تخسر.',
      },
      {
        title: 'تمديد تلقائي',
        body: 'أي مزايدة في آخر لحظة تزيد الوقت — عشان تكسب اللوحة بأعلى سعر مو بأسرع نت.',
      },
      {
        title: 'كل مزايدة مكشوفة',
        body: 'كل مزايدة مكتوبة بوقتها ومبلغها، وحتى الملغاة تشوفها مكتوب عليها ملغاة — ما نخفي شي.',
      },
      {
        title: 'ما تفوتك مزايدة',
        body: 'تشوف كل مزايدة لحظة ما تنزل، بدون ما تحدّث الصفحة — فما تفوتك فرصة وأنت تنتظر.',
      },
      {
        title: 'فلوسك محفوظة للتسليم',
        body: 'مبلغك يبقى عندنا لين تنتقل اللوحة باسمك وتتأكّد الإدارة — وإن ما انتقلت رجع لك كامل.',
      },
    ],
  },
}

export type TaxSettings = {
  /** بلا تفعيل لا تُصدَر فواتير — لا تُصدَر فاتورة برقم ضريبي فارغ */
  enabled: boolean
  legalName: string
  /** الرقم الضريبي — خمس عشرة خانة */
  vatNumber: string
  /** الرقم الموحّد للمنشأة أو السجل التجاري */
  crNumber: string
  street: string
  buildingNumber: string
  district: string
  city: string
  postalCode: string
  /** الرقم الإضافي في العنوان الوطني — أربع خانات */
  additionalNumber: string
  country: string
  updatedAt: string
  updatedByAdminId: string | null
}

export const DEFAULT_TAX_SETTINGS: Omit<TaxSettings, 'updatedAt' | 'updatedByAdminId'> = {
  enabled: false,
  legalName: '',
  vatNumber: '',
  crNumber: '',
  street: '',
  buildingNumber: '',
  district: '',
  city: '',
  postalCode: '',
  additionalNumber: '',
  country: 'السعودية',
}

/** الطرف الذي صدرت له الفاتورة — لكلٍّ عمولته وفاتورته. */
export type TaxInvoiceKind = 'buyer_commission' | 'seller_commission'

export const TAX_INVOICE_KIND_LABELS: Record<TaxInvoiceKind, string> = {
  buyer_commission: 'عمولة على المشتري',
  seller_commission: 'عمولة على البائع',
}

/**
 * فاتورة ضريبية مبسّطة — لا تُعدَّل ولا تُحذف بعد إصدارها.
 *
 * الخطأ في فاتورة صادرة يُصحَّح **بإشعار دائن** لا بتعديلها: تعديل رقمٍ في
 * فاتورة سُلّمت للعميل يترك نسختين مختلفتين لرقم واحد.
 */
export type TaxInvoice = {
  id: string
  /** رقم الفاتورة — `T26-00001`، متسلسل لا تنقطع سلسلته */
  reference: string
  /** معرّف عالمي فريد تتطلّبه الهيئة لكل فاتورة */
  uuid: string
  kind: TaxInvoiceKind
  orderId: string
  listingId: string
  /** الصفقة التي صدرت عنها — يُقتبَس في الفاتورة للربط */
  orderReference: string

  customerId: string
  customerName: string
  customerReference: string

  /** لقطة بيانات المنشأة وقت الإصدار */
  sellerName: string
  sellerVatNumber: string
  sellerCrNumber: string
  sellerAddress: string

  /** وصف البند: «عمولة وساطة على صفقة …» */
  description: string
  /** العمولة قبل الضريبة */
  netAmount: Halalas
  /** نسبة الضريبة وقت الإصدار — لا تُقرأ من الإعدادات لاحقًا */
  vatRate: number
  vatAmount: Halalas
  /** الإجمالي شاملًا الضريبة */
  totalAmount: Halalas

  issuedAt: string
  /** تجزئة الفاتورة السابقة — تربط السلسلة فلا تُحذف واحدة بلا أثر */
  previousHash: string
  hash: string
  /** محتوى رمز QR بترميز TLV ثم base64 */
  qr: string
}

// ========================================================== أوامر الصرف

/** ما يُصرف: عائد بيع لبائع، أو مبلغ يعود لمشترٍ. */
export type DisbursementKind = 'seller_payout' | 'buyer_refund'

export const DISBURSEMENT_KIND_LABELS: Record<DisbursementKind, string> = {
  seller_payout: 'عائد بيع للبائع',
  buyer_refund: 'إعادة مبلغ للمشتري',
}

/**
 * حالة أمر الصرف.
 *
 * `pending` التزامٌ قائم على المنصّة لم يُنفَّذ بعد؛ و`paid` مالٌ غادر حسابها
 * فعلًا؛ و`cancelled` أمرٌ أُبطل قبل تنفيذه — والمستفيد احتفظ برصيده في
 * محفظته. ولا حالة رابعة: أمرٌ «فشل» يبقى `pending` بملاحظة، فالالتزام لم
 * يسقط بفشل حوالة.
 */
export type DisbursementStatus = 'pending' | 'paid' | 'cancelled'

export const DISBURSEMENT_STATUS_LABELS: Record<DisbursementStatus, string> = {
  pending: 'بانتظار الصرف',
  paid: 'صُرف',
  cancelled: 'أُلغي',
}

/**
 * أمر صرف — ورقة المحاسب.
 *
 * قرار الإدارة (تحويل للبائع أو إعادة للمشتري) يُقيَّد في المحفظة فورًا: صاحب
 * المال يرى رصيده في لحظته ولا ينتظر دورة محاسبية. لكن **خروج المال من حساب
 * المنصّة البنكي** فعلٌ آخر: له مستفيد وآيبان ومرجع حوالة ومن أذن به ومن
 * نفّذه. وهذا الأمر يحمل ذلك كلّه، وتنفيذه يخصم من المحفظة قيدَ سحبٍ مقابلًا
 * — فيغلق الدفتر: ما دخل بقيد يخرج بقيد.
 */
export type Disbursement = {
  id: string
  /** رقم أمر الصرف — `F26-00001` */
  reference: string
  kind: DisbursementKind
  status: DisbursementStatus

  orderId: string
  orderReference: string
  listingId: string
  /** اللوحة نصًّا — ليُقرأ الأمر بلا فتح الصفقة */
  plateLabel: string

  beneficiaryId: string
  /** لقطة وقت الإصدار: تغيّر اسم المستفيد لاحقًا لا يغيّر أمرًا صدر */
  beneficiaryName: string
  beneficiaryReference: string

  /** قيمة الصفقة — سياق لا مبلغ صرف */
  grossAmount: Halalas
  /** ما خُصم عمولةً وضريبةً قبل الصرف (صفر في الإعادة) */
  commissionAmount: Halalas
  vatAmount: Halalas
  /** صافي ما يُصرف */
  amount: Halalas

  /** لقطة الحساب البنكي وقت الإصدار — تحويلٌ إلى آيبان تغيّر بعده باطل */
  bankName: string | null
  bankIban: string | null
  bankAccountName: string | null

  note: string | null
  createdAt: string
  createdByAdminId: string | null

  paidAt: string | null
  paidByAdminId: string | null
  /** مرجع الحوالة كما ورد من البنك — بلا مرجع لا يُقفل الأمر */
  paymentReference: string | null
  /** قيد السحب المقابل في محفظة المستفيد */
  ledgerEntryId: string | null

  cancelledAt: string | null
  cancelledByAdminId: string | null
  cancelReason: string | null
}

/** بيانات إيداع المستفيد — يدخلها صاحبها في إعداداته. */
export type PayoutAccount = {
  bankName: string
  /** يُخزَّن بلا مسافات وبحروف كبيرة */
  iban: string
  accountName: string
}

export const EMPTY_PAYOUT_ACCOUNT: PayoutAccount = { bankName: '', iban: '', accountName: '' }

/**
 * الآيبان السعودي: `SA` ثم رقمان للتحقّق ثم عشرون خانة.
 *
 * والتحقّق ليس شكليًّا: خانتا التحقّق تُحسبان بـmod-97 على الرقم بعد نقل
 * رمز الدولة إلى آخره — فرقمٌ أُخطئ في خانة منه يُردّ عند الإدخال لا عند
 * فشل الحوالة بعد أسبوع.
 */
export function isValidSaudiIban(value: string): boolean {
  const iban = value.replace(/\s/g, '').toUpperCase()
  if (!/^SA\d{22}$/.test(iban)) return false
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  let remainder = 0
  for (const char of rearranged) {
    const code = char >= 'A' && char <= 'Z' ? String(char.charCodeAt(0) - 55) : char
    for (const digit of code) remainder = (remainder * 10 + Number(digit)) % 97
  }
  return remainder === 1
}

/** يعرض الآيبان بمجموعات رباعية — أسهل في المطابقة بالعين. */
export function formatIban(value: string): string {
  return (value.replace(/\s/g, '').toUpperCase().match(/.{1,4}/g) ?? []).join(' ')
}
