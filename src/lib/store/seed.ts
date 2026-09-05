import { riyalsToHalalas } from '@/lib/domain/money'
import type {
  Order,
  Bid,
  Deposit,
  FaqItem,
  LedgerEntry,
  Listing,
  PlateEmblem,
  PlateType,
  SaleType,
} from '@/lib/domain/types'
import { DEMO_ADMIN, DEMO_USERS, DEMO_WALLET_OPENING_BALANCE } from '@/lib/config'
import { hashPassword, newId } from '@/lib/server/crypto'
import { lettersToLatin, normalizeArabicLetters } from '@/lib/saudi-plate-mapping'
import { DEFAULT_AUCTION_SETTINGS } from '@/lib/domain/types'
import { buildReference, referenceYear, type ReferenceKind } from '@/lib/domain/reference'
import { encodeZatcaQr, invoiceDigestInput, ZATCA_GENESIS_INPUT } from '@/lib/domain/zatca'
import { sha256Base64 } from '@/lib/server/invoice-service'
import type { Disbursement, TaxInvoice } from '@/lib/domain/types'
import type { MemoryDatabase } from './memory-store'

type SeedListing = {
  seller: number
  plateType: PlateType
  arabicLetters: string
  plateNumbers: string
  emblem: PlateEmblem
  description: string
  saleType: SaleType
  price?: number
  startingPrice?: number
  minimumIncrement?: number
  reservePrice?: number
  minimumOffer?: number
  depositAmount?: number
  paymentWindowHours?: number
  /** بالثواني — موجب: مزاد جارٍ، سالب: انتهى */
  endsInSeconds?: number
  status?: Listing['status']
}

const SEED_LISTINGS: SeedListing[] = [
  {
    seller: 0,
    plateType: 'private',
    arabicLetters: 'أ',
    plateNumbers: '1',
    emblem: 'palm-swords-black',
    description: 'لوحة أحادية نادرة — حرف واحد ورقم واحد. من أندر ما يُطرح.',
    saleType: 'auction',
    startingPrice: 150_000,
    minimumIncrement: 5_000,
    reservePrice: 220_000,
    depositAmount: 10_000,
    endsInSeconds: 3 * 24 * 3600,
  },
  {
    seller: 1,
    plateType: 'private',
    arabicLetters: 'رر',
    plateNumbers: '77',
    emblem: 'palm-swords-black',
    description: 'حرفان متكرران مع رقم مزدوج مطلوب.',
    saleType: 'auction',
    startingPrice: 45_000,
    minimumIncrement: 1_000,
    reservePrice: 62_000,
    depositAmount: 5_000,
    endsInSeconds: 36 * 3600,
  },
  {
    seller: 0,
    plateType: 'private',
    arabicLetters: 'كطع',
    plateNumbers: '4040',
    emblem: 'palm-swords-black',
    description: 'رقم رباعي متناظر مع ثلاثة حروف — سهلة الحفظ.',
    saleType: 'fixed',
    price: 28_000,
  },
  {
    seller: 2,
    plateType: 'transport',
    arabicLetters: 'نقل',
    plateNumbers: '5566',
    emblem: 'palm-swords-black',
    description: 'لوحة نقل خاص لشاحنة تجارية.',
    saleType: 'fixed',
    price: 12_500,
  },
  {
    seller: 1,
    plateType: 'motorcycle',
    arabicLetters: 'حد',
    plateNumbers: '9',
    emblem: 'palm-swords-black',
    description: 'لوحة دراجة نارية برقم أحادي.',
    saleType: 'offers',
    minimumOffer: 7_000,
  },
  {
    seller: 2,
    plateType: 'private',
    arabicLetters: 'سعد',
    plateNumbers: '313',
    emblem: 'vision-2030',
    description: 'لوحة بثلاثة حروف تُقرأ كاسم.',
    saleType: 'offers',
    minimumOffer: 30_000,
  },
  {
    seller: 0,
    plateType: 'private',
    arabicLetters: 'مم',
    plateNumbers: '22',
    emblem: 'palm-swords-black',
    description: 'مزاد منتهٍ — بيعت بأعلى مزايدة.',
    saleType: 'auction',
    startingPrice: 18_000,
    minimumIncrement: 500,
    reservePrice: 20_000,
    endsInSeconds: -3600,
  },
  /*
   * ثلاث لوحات لتجربة مصير العربون عند انتهاء المزاد — كل حالة على حدة.
   * `endsInSeconds` سالبة: انتهى وقتها، وتُحسم عند أوّل قراءة للسوق.
   */
  {
    seller: 1,
    plateType: 'private',
    arabicLetters: 'ابح',
    plateNumbers: '1010',
    emblem: 'palm-swords-black',
    description: 'تجربة (١): انتهى المزاد وتجاوزت أعلى مزايدة السعر الاحتياطي — رست اللوحة.',
    saleType: 'auction',
    startingPrice: 30_000,
    minimumIncrement: 1_000,
    reservePrice: 33_000,
    depositAmount: 4_000,
    endsInSeconds: -900,
    status: 'sold',
  },
  {
    seller: 1,
    plateType: 'private',
    arabicLetters: 'سد',
    plateNumbers: '2020',
    emblem: 'palm-swords-black',
    description: 'تجربة (٢): انتهى المزاد ولم تبلغ أعلى مزايدة السعر الاحتياطي — لا بيع.',
    saleType: 'auction',
    startingPrice: 30_000,
    minimumIncrement: 1_000,
    reservePrice: 90_000,
    depositAmount: 4_000,
    endsInSeconds: -900,
    status: 'reserve_not_met',
  },
  {
    seller: 1,
    plateType: 'private',
    arabicLetters: 'هد',
    plateNumbers: '5050',
    emblem: 'palm-swords-black',
    description: 'تجربة (٤): رست ثم تخلّف الفائز عن السداد وانتهت مهلته — جاهزة للمصادرة وإعادة الإرساء.',
    saleType: 'auction',
    startingPrice: 30_000,
    minimumIncrement: 1_000,
    reservePrice: 33_000,
    depositAmount: 4_000,
    endsInSeconds: -180_000,
    status: 'sold',
  },
  {
    seller: 1,
    plateType: 'private',
    arabicLetters: 'كن',
    plateNumbers: '3030',
    emblem: 'palm-swords-black',
    description: 'تجربة (٣): انتهى المزاد دون أن يزايد أحد.',
    saleType: 'auction',
    startingPrice: 30_000,
    minimumIncrement: 1_000,
    reservePrice: 35_000,
    depositAmount: 4_000,
    endsInSeconds: -900,
    status: 'no_bids',
  },
  {
    seller: 2,
    plateType: 'private',
    arabicLetters: 'وسم',
    plateNumbers: '505',
    emblem: 'palm-swords-black',
    description: 'ثلاثة حروف ورقم ثلاثي متناظر.',
    saleType: 'auction',
    startingPrice: 62_000,
    minimumIncrement: 2_000,
    reservePrice: 85_000,
    depositAmount: 6_000,
    endsInSeconds: 5 * 3600,
  },
  {
    seller: 0,
    plateType: 'private',
    arabicLetters: 'طط',
    plateNumbers: '88',
    emblem: 'palm-swords-gold',
    description: 'حرفان متكرّران ورقم مزدوج — تركيبة مطلوبة.',
    saleType: 'auction',
    startingPrice: 95_000,
    minimumIncrement: 2_500,
    reservePrice: 130_000,
    depositAmount: 8_000,
    endsInSeconds: 40 * 60,
  },
  {
    seller: 1,
    plateType: 'transport',
    arabicLetters: 'هلا',
    plateNumbers: '2020',
    emblem: 'vision-2030',
    description: 'لوحة نقل خاص تُقرأ كلمةً.',
    saleType: 'auction',
    startingPrice: 34_000,
    minimumIncrement: 1_000,
    reservePrice: 0,
    depositAmount: 3_000,
    endsInSeconds: 6 * 24 * 3600,
  },
  {
    seller: 2,
    plateType: 'private',
    arabicLetters: 'ررر',
    plateNumbers: '7',
    emblem: 'palm-swords-black',
    description: 'ثلاثة حروف متطابقة مع رقم أحادي.',
    saleType: 'fixed',
    price: 240_000,
  },
  {
    seller: 0,
    plateType: 'private',
    arabicLetters: 'ند',
    plateNumbers: '350',
    emblem: 'heritage-arch',
    description: 'رقم ثلاثي سهل الحفظ.',
    saleType: 'fixed',
    price: 19_500,
  },
  {
    seller: 1,
    plateType: 'motorcycle',
    arabicLetters: 'سب',
    plateNumbers: '12',
    emblem: 'palm-swords-black',
    description: 'لوحة دراجة نارية برقم مزدوج.',
    saleType: 'fixed',
    price: 6_800,
  },
  {
    seller: 2,
    plateType: 'private',
    arabicLetters: 'عز',
    plateNumbers: '1',
    emblem: 'palm-swords-gold',
    description: 'حرفان ورقم أحادي — من أندر التركيبات.',
    saleType: 'offers',
    minimumOffer: 180_000,
  },
  {
    seller: 0,
    plateType: 'private',
    arabicLetters: 'دال',
    plateNumbers: '404',
    emblem: 'vision-2030',
    description: 'رقم متناظر مع ثلاثة حروف.',
    saleType: 'offers',
    minimumOffer: 45_000,
  },
  {
    seller: 1,
    plateType: 'transport',
    arabicLetters: 'حمل',
    plateNumbers: '3300',
    emblem: 'palm-swords-black',
    description: 'لوحة نقل خاص برقم رباعي.',
    saleType: 'offers',
    minimumOffer: 14_000,
  },
  {
    seller: 1,
    plateType: 'private',
    arabicLetters: 'بدر',
    plateNumbers: '1010',
    emblem: 'heritage-arch',
    description: 'مسودة لم تُنشر بعد.',
    saleType: 'fixed',
    price: 40_000,
    status: 'draft',
  },
  /*
   * أربع لوحات لعرض مراحل الصفقة الباقية في «مشترياتي».
   *
   * البذرة تعرض ثلاث حالات فقط: بانتظار السداد، ومتخلّفة، ومكتملة — فلا يرى
   * أحدٌ الشريط في حالاته الوسطى (محجوز، نُقلت الملكية، اعتراض، استرداد) إلا
   * بأن يصنعها بنفسه. وهذه تُبذَر بحالتها النهائية كما بُذرت حالات المزاد.
   */
  {
    seller: 1,
    plateType: 'private',
    arabicLetters: 'سهم',
    plateNumbers: '2400',
    emblem: 'palm-swords-black',
    description: 'صفقة تجريبية: وصل المبلغ وحُجز أمانةً بانتظار نقل الملكية.',
    saleType: 'fixed',
    price: 27_500,
    status: 'sold',
  },
  {
    seller: 1,
    plateType: 'private',
    arabicLetters: 'نور',
    plateNumbers: '5800',
    emblem: 'palm-swords-black',
    description: 'صفقة تجريبية: نقل البائع الملكية ورفع إثباتها، والدور على المشتري.',
    saleType: 'fixed',
    price: 39_000,
    status: 'sold',
  },
  {
    seller: 2,
    plateType: 'private',
    arabicLetters: 'طرق',
    plateNumbers: '6300',
    emblem: 'palm-swords-black',
    description: 'صفقة تجريبية: اعتراض المشتري أوقف تحويل المبلغ حتى تفصل الإدارة.',
    saleType: 'fixed',
    price: 21_000,
    status: 'sold',
  },
  {
    seller: 2,
    plateType: 'private',
    arabicLetters: 'حسم',
    plateNumbers: '8500',
    emblem: 'palm-swords-black',
    description: 'صفقة تجريبية: لم تُنقل الملكية فعاد المبلغ إلى المشتري.',
    saleType: 'fixed',
    price: 52_000,
    status: 'sold',
  },
  {
    seller: 1,
    plateType: 'private',
    arabicLetters: 'قلم',
    plateNumbers: '4900',
    emblem: 'palm-swords-black',
    description: 'صفقة تجريبية: بانتظار سداد المشتري خلال المهلة.',
    saleType: 'fixed',
    price: 16_750,
    status: 'sold',
  },
  {
    seller: 0,
    plateType: 'private',
    arabicLetters: 'ركب',
    plateNumbers: '1200',
    emblem: 'palm-swords-black',
    description: 'صفقة تجريبية: وصل المبلغ وحُجز أمانةً بانتظار نقل الملكية.',
    saleType: 'fixed',
    price: 24_000,
    status: 'sold',
  },
  {
    seller: 0,
    plateType: 'private',
    arabicLetters: 'سلم',
    plateNumbers: '3600',
    emblem: 'palm-swords-black',
    description: 'صفقة تجريبية: نقل البائع الملكية ورفع إثباتها، والدور على المشتري.',
    saleType: 'fixed',
    price: 31_500,
    status: 'sold',
  },
  {
    seller: 1,
    plateType: 'private',
    arabicLetters: 'عهد',
    plateNumbers: '7400',
    emblem: 'palm-swords-black',
    description: 'صفقة تجريبية: اعتراض المشتري أوقف تحويل المبلغ حتى تفصل الإدارة.',
    saleType: 'fixed',
    price: 18_900,
    status: 'sold',
  },
  {
    seller: 1,
    plateType: 'private',
    arabicLetters: 'بدر',
    plateNumbers: '9100',
    emblem: 'palm-swords-black',
    description: 'صفقة تجريبية: لم تُنقل الملكية فعاد المبلغ إلى المشتري.',
    saleType: 'fixed',
    price: 44_000,
    status: 'sold',
  },
  /*
   * صفقتان مكتملتان — بلا هاتين تبقى «أوامر الصرف» و«الفواتير» فارغتين.
   *
   * أمر الصرف يُفتح بقرار التحويل، والفاتورة تُصدَر باستحقاق العمولة؛ وكلاهما
   * يقع في نهاية المسار وحدها. فما لم تُبذَر صفقة وصلت آخره، لم يُرَ أثرهما.
   */
  {
    seller: 0,
    plateType: 'private',
    arabicLetters: 'حسن',
    plateNumbers: '2200',
    emblem: 'palm-swords-black',
    description: 'صفقة تجريبية: اكتملت وحُوّل المبلغ للبائع — أمر صرفها بانتظار المحاسب.',
    saleType: 'fixed',
    price: 63_000,
    status: 'sold',
  },
  {
    seller: 1,
    plateType: 'private',
    arabicLetters: 'دار',
    plateNumbers: '7700',
    emblem: 'palm-swords-black',
    description: 'صفقة تجريبية: اكتملت وصُرف عائدها بحوالة بنكية مقفلة بمرجعها.',
    saleType: 'fixed',
    price: 27_500,
    status: 'sold',
  },
]

/**
 * يملأ قاعدة بيانات Demo بمستخدمين وإعلانات تغطّي طرق البيع الثلاث
 * وحالات مختلفة: مزاد جارٍ، مزاد منتهٍ ومباع، بيع مباشر، استقبال عروض، ومسودة.
 */
export function seedDatabase(db: MemoryDatabase): void {
  const now = Date.now()
  const iso = (offsetMs = 0) => new Date(now + offsetMs).toISOString()

  /*
   * البذرة تبني الكيانات مباشرة لا عبر `createX`، فتحتاج مولّد المراجع نفسه
   * ليبقى العدّاد متّصلًا: أوّل إعلان حقيقي بعد البذرة يأخذ الرقم التالي لا
   * رقمًا مستعملًا.
   */
  const nextRef = (kind: ReferenceKind, at: number = now) => {
    const year = referenceYear(at)
    const key = `${kind}:${year}`
    const next = (db.referenceCounters[key] ?? 0) + 1
    db.referenceCounters[key] = next
    return buildReference(kind, year, next)
  }

  const users = DEMO_USERS.map((demo, index) => ({
    id: newId('usr'),
    reference: nextRef('user'),
    email: demo.email,
    displayName: demo.displayName,
    phone: demo.phone,
    city: demo.city,
    social: { ...demo.social },
    payout: { ...demo.payout },
    // معرّفٌ علنيّ في البذرة: الروابط تُشارَك في العرض ولا تُملى بمعرّف داخليّ
    handle: demo.email.split('@')[0],
    showcaseUsesHandle: false,
    avatarUrl: null,
    createdAt: iso(-(30 - index) * 86_400_000),
    passwordHash: hashPassword(demo.password),
  }))
  db.users.push(...users)

  /*
   * منشأة ضريبية تجريبية — مفعّلة كي تُرى الفوترة تعمل.
   *
   * الرقم مبنيّ على قاعدة الهيئة (يبدأ بـ3، وينتهي بـ3، والحادية عشرة 1)
   * وأصفاره تقول إنه رقم عرضٍ لا رقم منشأة قائمة.
   */
  db.taxSettings = {
    enabled: true,
    legalName: 'منصّة سوق اللوحات (تجريبي)',
    vatNumber: '312345678910003',
    crNumber: '7000000000',
    street: 'طريق الملك فهد',
    buildingNumber: '2100',
    district: 'العليا',
    city: 'الرياض',
    postalCode: '12212',
    additionalNumber: '8020',
    country: 'السعودية',
    updatedAt: iso(-40 * 86_400_000),
    updatedByAdminId: null,
  }

  db.admins.push({
    id: newId('adm'),
    email: DEMO_ADMIN.email,
    displayName: DEMO_ADMIN.displayName,
    createdAt: iso(-40 * 86_400_000),
    lastLoginAt: null,
    passwordHash: hashPassword(DEMO_ADMIN.password),
  })

  // محفظة لكل مستخدم برصيد افتتاحي وقيد شحن يفسّره في كشف الحساب
  const opening = riyalsToHalalas(DEMO_WALLET_OPENING_BALANCE)
  users.forEach((user, index) => {
    db.wallets.set(user.id, {
      userId: user.id,
      balance: opening,
      held: 0,
      updatedAt: iso(-(20 - index) * 86_400_000),
    })
    const entry: LedgerEntry = {
      id: newId('led'),
      reference: nextRef('wallet'),
      userId: user.id,
      type: 'topup',
      direction: 'credit',
      amount: opening,
      balanceAfter: opening,
      heldAfter: 0,
      listingId: null,
      depositId: null,
      orderId: null,
      note: 'رصيد افتتاحي لحساب تجريبي',
      actorAdminId: db.admins[0].id,
      createdAt: iso(-(20 - index) * 86_400_000),
    }
    db.ledger.push(entry)
  })

  const listings: Listing[] = SEED_LISTINGS.map((seed, index) => {
    const isAuction = seed.saleType === 'auction'
    const ends = seed.endsInSeconds
    const status: Listing['status'] =
      seed.status ?? (isAuction && ends !== undefined && ends < 0 ? 'active' : 'active')

    return {
      id: newId('lst'),
      reference: nextRef('listing'),
      sellerId: users[seed.seller].id,
      plateType: seed.plateType,
      // نمرّ بالتطبيع كما يمرّ إدخال المستخدم: البذرة تكتب «أ» و«ي» بالمألوف،
      // والمخزَّن يجب أن يكون الشكل المعتمد في جدول المرور («ا» و«ى»)
      arabicLetters: normalizeArabicLetters(seed.arabicLetters),
      latinLetters: lettersToLatin(normalizeArabicLetters(seed.arabicLetters)),
      plateNumbers: seed.plateNumbers,
      emblem: seed.emblem,
      customEmblemUrl: null,
      description: seed.description,
      saleType: seed.saleType,
      status,
      price: riyalsToHalalas(seed.price ?? 0),
      startingPrice: riyalsToHalalas(seed.startingPrice ?? 0),
      minimumIncrement: riyalsToHalalas(seed.minimumIncrement ?? 0),
      reservePrice: riyalsToHalalas(seed.reservePrice ?? 0),
      minimumOffer: riyalsToHalalas(seed.minimumOffer ?? 0),
      durationSeconds: 3 * 24 * 3600,
      extensionTriggerSeconds: 300,
      extensionDurationSeconds: 300,
      extensionResetsTimer: true,
      allowCustomBid: true,
      depositAmount: riyalsToHalalas(seed.depositAmount ?? 0),
      paymentWindowHours: seed.paymentWindowHours ?? 48,
      forfeitPercent: DEFAULT_AUCTION_SETTINGS.forfeitPercent,
      forfeitUndoWindowHours: DEFAULT_AUCTION_SETTINGS.forfeitUndoWindowHours,
      escrowTransferWindowHours: DEFAULT_AUCTION_SETTINGS.escrowTransferWindowHours,
      escrowReviewWindowHours: DEFAULT_AUCTION_SETTINGS.escrowReviewWindowHours,
      escrowDisputeWindowHours: DEFAULT_AUCTION_SETTINGS.escrowDisputeWindowHours,
      escrowReleaseUndoWindowHours: DEFAULT_AUCTION_SETTINGS.escrowReleaseUndoWindowHours,
      refundDepositOnLoss: true,
      startsAt: isAuction ? iso(-3600) : null,
      endsAt: isAuction && ends !== undefined ? iso(ends * 1000) : null,
      endedAt: null,
      highestBidId: null,
      soldToUserId: null,
      soldAmount: 0,
      viewCount: 40 + index * 17,
      createdAt: iso(-(index + 1) * 3_600_000),
      updatedAt: iso(-(index + 1) * 3_600_000),
    }
  })
  db.listings.push(...listings)

  const addBid = (listing: Listing, bidderIndex: number, amount: number, agoMs: number): Bid => {
    db.sequence += 1
    const bid: Bid = {
      id: newId('bid'),
      listingId: listing.id,
      bidderId: users[bidderIndex].id,
      amount: riyalsToHalalas(amount),
      status: 'accepted',
      serverSequence: db.sequence,
      createdAt: iso(-agoMs),
      cancelledAt: null,
      cancellationReason: null,
    }
    db.bids.push(bid)
    listing.highestBidId = bid.id
    return bid
  }

  // مزاد جارٍ عليه مزايدات
  addBid(listings[0], 1, 150_000, 7_200_000)
  addBid(listings[0], 2, 165_000, 5_400_000)
  addBid(listings[0], 1, 180_000, 1_800_000)

  addBid(listings[1], 2, 45_000, 3_600_000)

  // مزاد منتهٍ ومباع
  const soldListing = listings[6]
  addBid(soldListing, 1, 18_000, 9_000_000)
  const winning = addBid(soldListing, 2, 26_500, 7_200_000)
  soldListing.status = 'sold'
  soldListing.endedAt = iso(-3_600_000)
  soldListing.soldToUserId = users[2].id
  soldListing.soldAmount = winning.amount
  db.orders.push({
    id: newId('ord'),
    reference: nextRef('order'),
    listingId: soldListing.id,
    buyerId: users[2].id,
    sellerId: soldListing.sellerId,
    amount: winning.amount,
    source: 'auction',
    status: 'completed',
    remindersSent: [],
    /*
     * صفقة مرّت بالدورة كاملة: سُدّدت فحُجزت، ثم نُقلت الملكية، فأُفرج.
     * صفقة مكتملة بلا `paidAt` تُظهر «سداد المشتري» جاريًا في مسارها — تناقض
     * يراه المستخدم في أوّل صفحة يفتحها.
     */
    paidAt: iso(-3_500_000),
    escrowAmount: winning.amount,
    transferDueAt: iso(-3_500_000 + 72 * 3_600_000),
    transferProofNote: 'نُقلت الملكية في أبشر — بيانات تجريبية',
    transferProofAt: iso(-2_400_000),
    confirmDueAt: iso(-2_400_000 + 72 * 3_600_000),
    disputedAt: null,
    disputeReason: null,
    disputedBy: null,
    payoutLedgerEntryId: null,
    releasedAt: iso(-1_800_000),
    paymentDueAt: iso(-3_600_000 + 48 * 3_600_000),
    depositId: null,
    createdAt: iso(-3_600_000),
    completedAt: iso(-1_800_000),
  })

  /**
   * عرابين المزايدين في المزادات الجارية.
   * البذرة يجب أن تكون متّسقة: كل مزايدة على مزاد بعربون يقابلها عربون محجوز
   * وقيد حجز في كشف الحساب — وإلا بدت المحفظة مخالفة لواقع المزايدات.
   */
  const holdDeposit = (listing: Listing, bidderIndex: number, agoMs: number) => {
    if (listing.depositAmount <= 0) return null
    const user = users[bidderIndex]
    const wallet = db.wallets.get(user.id)!
    const deposit: Deposit = {
      id: newId('dep'),
      reference: nextRef('deposit'),
      listingId: listing.id,
      userId: user.id,
      amount: listing.depositAmount,
      status: 'held',
      forfeitedAmount: 0,
      createdAt: iso(-agoMs),
      resolvedAt: null,
      resolvedByAdminId: null,
      reason: null,
    }
    db.deposits.push(deposit)
    wallet.held += listing.depositAmount
    db.ledger.push({
      id: newId('led'),
      reference: nextRef('wallet'),
      userId: user.id,
      type: 'deposit_hold',
      direction: 'neutral',
      amount: listing.depositAmount,
      balanceAfter: wallet.balance,
      heldAfter: wallet.held,
      listingId: listing.id,
      depositId: deposit.id,
      orderId: null,
      note: 'حجز عربون لدخول المزاد',
      actorAdminId: null,
      createdAt: iso(-agoMs),
    })
    return deposit
  }

  /** عربون حُجز ثم فُكّ — بقيديه معًا كي يبقى الكشف مطابقًا للمحفظة. */
  const releaseDeposit = (listing: Listing, bidderIndex: number, agoMs: number) => {
    const deposit = holdDeposit(listing, bidderIndex, agoMs)
    if (!deposit) return null
    const user = users[bidderIndex]
    const wallet = db.wallets.get(user.id)!
    deposit.status = 'released'
    deposit.resolvedAt = iso(-900_000)
    deposit.reason = 'انتهى المزاد دون بيع'
    wallet.held -= deposit.amount
    db.ledger.push({
      id: newId('led'),
      reference: nextRef('wallet'),
      userId: user.id,
      type: 'deposit_release',
      direction: 'neutral',
      amount: deposit.amount,
      balanceAfter: wallet.balance,
      heldAfter: wallet.held,
      listingId: listing.id,
      depositId: deposit.id,
      orderId: null,
      note: 'انتهى المزاد دون بيع',
      actorAdminId: null,
      createdAt: iso(-900_000),
    })
    return deposit
  }

  holdDeposit(listings[0], 1, 7_200_000)
  holdDeposit(listings[0], 2, 5_400_000)
  holdDeposit(listings[1], 2, 3_600_000)

  /*
   * ثلاث حالات انتهاء مزاد جاهزة للتجربة.
   *
   * تُبذَر بحالتها النهائية لا `active` بوقتٍ منقضٍ: مزادٌ منتهٍ في البذرة
   * يُحسم عند أوّل قراءة للسوق فيُحرّك محافظ المستخدمين في لحظة غير متوقَّعة،
   * وتصير كل قراءة أثرًا جانبيًا تتعثّر به الاختبارات. المنطق نفسه مُغطّى
   * باختبارات الوحدة؛ ودور البذرة أن تعرض الحالة لا أن تُنتجها.
   */
  /*
   * البحث يرمي ولا يُرجع `undefined`.
   *
   * حروف اللوحة تُطبَّع عند البذر إلى السبعة عشر المعتمدة، فـ«وفق» تُخزَّن
   * «وق». وبحثٌ بالحروف الأصلية يُرجع `!` كاذبة تنفجر بعد أسطر عند أوّل
   * قراءة حقل — والرمي هنا يقول أي لوحة ضاعت.
   */
  const byPlate = (letters: string, numbers: string) => {
    const found = listings.find(
      (l) => l.arabicLetters === letters && l.plateNumbers === numbers,
    )
    if (!found) throw new Error(`لوحة البذرة «${letters} ${numbers}» غير موجودة`)
    return found
  }

  // (١) تجاوزت الاحتياطي 33,000 → رست على ماجد، والعرابين تبقى محجوزة
  const overReserve = byPlate('ابح', '1010')
  addBid(overReserve, 0, 32_000, 5_400_000)
  const overWinner = addBid(overReserve, 2, 35_000, 3_600_000)
  overReserve.endedAt = iso(-900_000)
  overReserve.soldToUserId = users[2].id
  overReserve.soldAmount = overWinner.amount
  holdDeposit(overReserve, 0, 5_400_000)
  const winnerDeposit = holdDeposit(overReserve, 2, 3_600_000)
  db.orders.push({
    id: newId('ord'),
    reference: nextRef('order'),
    listingId: overReserve.id,
    buyerId: users[2].id,
    sellerId: overReserve.sellerId,
    amount: overWinner.amount,
    source: 'auction',
    status: 'awaiting_settlement',
    remindersSent: [],
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
    paymentDueAt: iso(-900_000 + overReserve.paymentWindowHours * 3_600_000),
    depositId: winnerDeposit?.id ?? null,
    createdAt: iso(-900_000),
    completedAt: null,
  })

  // (٢) أعلى مزايدة 36,000 دون احتياطي 90,000 → لا بيع، وتُفكّ العرابين
  const underReserve = byPlate('سد', '2020')
  addBid(underReserve, 0, 32_000, 5_400_000)
  addBid(underReserve, 2, 36_000, 3_600_000)
  underReserve.endedAt = iso(-900_000)
  releaseDeposit(underReserve, 0, 5_400_000)
  releaseDeposit(underReserve, 2, 3_600_000)

  /*
   * (٤) تخلّف الفائز وانقضت مهلته.
   *
   * مزايدان اثنان بعرابين محجوزة: الأوّل ليصير «المزايد التالي» عند إعادة
   * الإرساء، والثاني هو المتخلّف. وبلا مزايد ثانٍ لا معنى لإعادة الإرساء.
   */
  const defaulted = byPlate('هد', '5050')
  const runnerUp = addBid(defaulted, 0, 34_000, 200_000_000)
  const defaulter = addBid(defaulted, 2, 38_000, 190_000_000)
  defaulted.endedAt = iso(-180_000_000)
  defaulted.soldToUserId = users[2].id
  defaulted.soldAmount = defaulter.amount
  defaulted.highestBidId = defaulter.id
  void runnerUp
  holdDeposit(defaulted, 0, 200_000_000)
  const defaulterDeposit = holdDeposit(defaulted, 2, 190_000_000)
  db.orders.push({
    id: newId('ord'),
    reference: nextRef('order'),
    listingId: defaulted.id,
    buyerId: users[2].id,
    sellerId: defaulted.sellerId,
    amount: defaulter.amount,
    source: 'auction',
    status: 'awaiting_settlement',
    remindersSent: [],
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
    // المهلة انقضت: 50 ساعة مضت على الرسوّ ونافذة السداد 48
    paymentDueAt: iso(-180_000_000 + defaulted.paymentWindowHours * 3_600_000),
    depositId: defaulterDeposit?.id ?? null,
    createdAt: iso(-180_000_000),
    completedAt: null,
  })

  // (٣) بلا مزايدات — ولذلك بلا عرابين أصلًا
  byPlate('كن', '3030').endedAt = iso(-900_000)

  /*
   * مراحل الضمان الأربع الباقية — لتُرى في «مشترياتي» بلا صنعها يدويًا.
   *
   * وتُبذَر بمهلٍ **لم تنقضِ**: مسح الضمان يجري على مسارات القراءة، فصفقةٌ
   * مبذورة بمهلة تأكيد منقضية تُفرَج عند أوّل فتح للصفحة، فيرى صاحبها حالةً
   * غير التي بُذرت. والمهل المتبقّية أطول من يومٍ أيضًا، فلا يُطلق التذكير
   * إشعارًا لم يطلبه أحد.
   *
   * ولا قيود محفظة لها كما لا قيود للصفقة المكتملة أعلاه: البذرة تعرض الحالة
   * ولا تُنتجها.
   */
  const HOUR = 3_600_000
  const demoDeal = (
    buyerIndex: number,
    plate: [string, string],
    fields: Partial<Order> & Pick<Order, 'status' | 'createdAt'>,
  ): Order => {
    const listing = byPlate(...plate)
    listing.soldToUserId = users[buyerIndex].id
    listing.soldAmount = listing.price
    const order: Order = {
      id: newId('ord'),
      reference: nextRef('order'),
      listingId: listing.id,
      buyerId: users[buyerIndex].id,
      sellerId: listing.sellerId,
      amount: listing.price,
      source: 'fixed',
      remindersSent: [],
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
      paymentDueAt: null,
      depositId: null,
      completedAt: null,
      ...fields,
    }
    db.orders.push(order)
    return order
  }

  /*
   * قيد عائد البيع للصفقة المكتملة.
   *
   * البذرة تعرض الحالة ولا تُنتجها في سائر الصفقات، أمّا هذه فقيدُها لازم:
   * أمرُ صرفها يخصم من المحفظة عند تنفيذه، وخصمٌ بلا إيداعٍ سابق يستنزف
   * رصيدًا لم يدخل — فتُقرأ محفظة البائع بعد الصرف أقلّ ممّا بدأت به.
   */
  const walletEntry = (
    order: Order,
    beneficiaryIndex: number,
    amount: number,
    type: 'sale_proceeds' | 'withdrawal',
    note: string,
    at: string,
  ) => {
    const beneficiary = users[beneficiaryIndex]
    const wallet = db.wallets.get(beneficiary.id)!
    wallet.balance += type === 'withdrawal' ? -amount : amount
    wallet.updatedAt = at
    db.ledger.push({
      id: newId('led'),
      reference: nextRef('wallet', Date.parse(at)),
      userId: beneficiary.id,
      type,
      direction: type === 'withdrawal' ? 'debit' : 'credit',
      amount,
      balanceAfter: wallet.balance,
      heldAfter: wallet.held,
      listingId: order.listingId,
      depositId: null,
      orderId: order.id,
      note,
      actorAdminId: null,
      createdAt: at,
    })
  }

  const creditProceeds = (order: Order, beneficiaryIndex: number, amount: number) =>
    walletEntry(
      order,
      beneficiaryIndex,
      amount,
      'sale_proceeds',
      'عائد بيع بعد خصم عمولة المنصّة وضريبتها',
      order.completedAt ?? order.createdAt,
    )

  /*
   * أمر صرف مبذور.
   *
   * لقطة الحساب البنكي تُنسخ هنا كما تُنسخ في الإصدار الحقيقي، فتُقرأ
   * البطاقة كاملةً: مستفيدٌ وآيبان ومبلغ — لا حقول فارغة تُقرأ خللًا.
   */
  const demoPayout = (
    order: Order,
    kind: Disbursement['kind'],
    beneficiaryIndex: number,
    amount: number,
    extra: Partial<Disbursement> = {},
  ) => {
    const listing = db.listings.find((row) => row.id === order.listingId)!
    const beneficiary = users[beneficiaryIndex]
    db.disbursements.push({
      id: newId('dsb'),
      reference: nextRef('disbursement', Date.parse(order.completedAt ?? order.createdAt)),
      kind,
      status: 'pending',
      orderId: order.id,
      orderReference: order.reference,
      listingId: listing.id,
      plateLabel: `${listing.arabicLetters} ${listing.plateNumbers}`,
      beneficiaryId: beneficiary.id,
      beneficiaryName: beneficiary.displayName,
      beneficiaryReference: beneficiary.reference,
      grossAmount: order.amount,
      commissionAmount: 0,
      vatAmount: 0,
      amount,
      bankName: beneficiary.payout.bankName || null,
      bankIban: beneficiary.payout.iban || null,
      bankAccountName: beneficiary.payout.accountName || null,
      note: null,
      createdAt: order.completedAt ?? order.createdAt,
      createdByAdminId: null,
      paidAt: null,
      paidByAdminId: null,
      paymentReference: null,
      ledgerEntryId: null,
      cancelledAt: null,
      cancelledByAdminId: null,
      cancelReason: null,
      ...extra,
    })
  }

  /**
   * فاتورة مبذورة — بسلسلتها لا خارجها.
   *
   * تجزئة كل فاتورة تُحسب من سابقتها بالدالّة نفسها التي يستعملها الإصدار،
   * فتقرأ لوحة الإدارة «سلسلة سليمة». وبذرةٌ بتجزئة عشوائية تُظهر السلسلة
   * مكسورة منذ أوّل تشغيل، فيُطارَد عيبٌ لا وجود له.
   */
  const demoInvoice = (
    order: Order,
    kind: TaxInvoice['kind'],
    customerIndex: number,
    net: number,
  ) => {
    const tax = db.taxSettings
    const listing = db.listings.find((row) => row.id === order.listingId)!
    const customer = users[customerIndex]
    const issuedAt = order.completedAt ?? order.createdAt
    const vat = Math.round((net * 15) / 100)
    const reference = nextRef('invoice', Date.parse(issuedAt))
    const previousHash = db.invoices.at(-1)?.hash ?? sha256Base64(ZATCA_GENESIS_INPUT)
    const uuid = `f0000000-0000-4000-8000-${String(db.invoices.length + 1).padStart(12, '0')}`

    db.invoices.push({
      id: newId('inv'),
      reference,
      uuid,
      kind,
      orderId: order.id,
      listingId: listing.id,
      orderReference: order.reference,
      customerId: customer.id,
      customerName: customer.displayName,
      customerReference: customer.reference,
      sellerName: tax.legalName,
      sellerVatNumber: tax.vatNumber,
      sellerCrNumber: tax.crNumber,
      sellerAddress: [tax.buildingNumber, tax.street, tax.district, tax.city, tax.postalCode, tax.country]
        .filter(Boolean)
        .join('، '),
      description:
        kind === 'buyer_commission'
          ? `عمولة وساطة على شراء اللوحة «${listing.arabicLetters} ${listing.plateNumbers}»`
          : `عمولة وساطة على بيع اللوحة «${listing.arabicLetters} ${listing.plateNumbers}»`,
      netAmount: net,
      vatRate: 15,
      vatAmount: vat,
      totalAmount: net + vat,
      issuedAt,
      previousHash,
      hash: sha256Base64(
        invoiceDigestInput({
          reference,
          uuid,
          issuedAt,
          vatNumber: tax.vatNumber,
          netAmount: net,
          vatAmount: vat,
          totalAmount: net + vat,
          customerReference: customer.reference,
          previousHash,
        }),
      ),
      qr: encodeZatcaQr({
        sellerName: tax.legalName,
        vatNumber: tax.vatNumber,
        issuedAt,
        total: net + vat,
        vatTotal: vat,
      }),
    })
  }

  /**
   * المراحل الأربع لمشترٍ واحد.
   *
   * تُبذَر لكل حساب تجريبي لا لحساب واحد: من يدخل بحساب غير الذي بُذرت له
   * يفتح «مشترياتي» فيجده فارغًا، ويظنّ أن لا شيء أُنجز.
   */
  const seedEscrowStages = (buyerIndex: number, plates: [string, string][]) => {
    const [held, transferred, disputed, refunded] = plates

    // (أ) المبلغ محجوز والدور على البائع — ومهلة نقله مضى منها ٦٠٪
    demoDeal(buyerIndex, held, {
      status: 'escrow_held',
      createdAt: iso(-46 * HOUR),
      paymentDueAt: iso(-46 * HOUR + 48 * HOUR),
      paidAt: iso(-43 * HOUR),
      escrowAmount: byPlate(...held).price,
      transferDueAt: iso(-43 * HOUR + 72 * HOUR),
    })

    // (ب) نُقلت الملكية والدور على المشتري: زرّا التأكيد والاعتراض وعدّادهما
    demoDeal(buyerIndex, transferred, {
      status: 'ownership_transferred',
      createdAt: iso(-60 * HOUR),
      paymentDueAt: iso(-60 * HOUR + 48 * HOUR),
      paidAt: iso(-58 * HOUR),
      escrowAmount: byPlate(...transferred).price,
      transferDueAt: iso(-58 * HOUR + 72 * HOUR),
      transferProofNote: 'نُقلت الملكية في أبشر — رقم العملية 4471209 (بيانات تجريبية)',
      transferProofAt: iso(-36 * HOUR),
      confirmDueAt: iso(-36 * HOUR + 72 * HOUR),
    })

    // (ج) اعتراض المشتري أوقف الإفراج
    demoDeal(buyerIndex, disputed, {
      status: 'disputed',
      createdAt: iso(-80 * HOUR),
      paymentDueAt: iso(-80 * HOUR + 48 * HOUR),
      paidAt: iso(-78 * HOUR),
      escrowAmount: byPlate(...disputed).price,
      transferDueAt: iso(-78 * HOUR + 72 * HOUR),
      transferProofNote: 'إثبات نقل — بيانات تجريبية',
      transferProofAt: iso(-50 * HOUR),
      confirmDueAt: iso(-50 * HOUR + 72 * HOUR),
      disputedAt: iso(-20 * HOUR),
      disputeReason: 'اللوحة لم تُنقل باسمي في أبشر حتى الآن',
      disputedBy: users[buyerIndex].id,
    })

    // (د) لم تُنقل الملكية فعاد المبلغ — المسار ينتهي أحمر عند محطّة التحويل
    const back = demoDeal(buyerIndex, refunded, {
      status: 'refunded',
      createdAt: iso(-120 * HOUR),
      paymentDueAt: iso(-120 * HOUR + 48 * HOUR),
      paidAt: iso(-118 * HOUR),
      escrowAmount: byPlate(...refunded).price,
      transferDueAt: iso(-118 * HOUR + 72 * HOUR),
      completedAt: iso(-40 * HOUR),
    })
    // وأمر صرفه للمشتري — التزامٌ قائم على المنصّة حتى تُنفَّذ الحوالة
    demoPayout(back, 'buyer_refund', buyerIndex, back.amount)
  }

  seedEscrowStages(2, [
    ['ركب', '1200'],
    ['سلم', '3600'],
    ['عهد', '7400'],
    ['بدر', '9100'],
  ])
  seedEscrowStages(0, [
    ['سهم', '2400'],
    ['نور', '5800'],
    ['طرق', '6300'],
    ['حسم', '8500'],
  ])

  // وصفقة بانتظار سداد وليد، فيرى زرّ «أكمل السداد» في حسابه هو
  demoDeal(0, ['قلم', '4900'], {
    status: 'awaiting_settlement',
    createdAt: iso(-6 * HOUR),
    paymentDueAt: iso(-6 * HOUR + 48 * HOUR),
  })

  /*
   * صفقتان مكتملتان — بهما تمتلئ لوحة المحاسب بالحالتين معًا.
   *
   * الأولى أمرُ صرفٍ **قائم** ينتظر حوالة، والثانية **مقفلة** بمرجعها. ولوحة
   * لا تُري إلا حالة واحدة لا يُعرف منها كيف تبدو الأخرى.
   */
  const completedDeal = (
    buyerIndex: number,
    sellerIndex: number,
    plate: [string, string],
    hoursAgo: number,
  ) => {
    const listing = byPlate(...plate)
    const commission = Math.round(listing.price * 0.02)
    const vat = Math.round(commission * 0.15)
    const order = demoDeal(buyerIndex, plate, {
      status: 'completed',
      createdAt: iso(-hoursAgo * HOUR),
      paymentDueAt: iso(-hoursAgo * HOUR + 48 * HOUR),
      paidAt: iso(-(hoursAgo - 3) * HOUR),
      escrowAmount: listing.price,
      transferDueAt: iso(-(hoursAgo - 3) * HOUR + 72 * HOUR),
      transferProofNote: 'نُقلت الملكية في أبشر — بيانات تجريبية',
      transferProofAt: iso(-(hoursAgo - 20) * HOUR),
      releasedAt: iso(-(hoursAgo - 26) * HOUR),
      completedAt: iso(-(hoursAgo - 26) * HOUR),
    })
    demoInvoice(order, 'seller_commission', sellerIndex, commission)
    return { order, payout: listing.price - commission - vat, commission, vat }
  }

  const openPayout = completedDeal(2, 0, ['حسن', '2200'], 96)
  creditProceeds(openPayout.order, 0, openPayout.payout)
  demoPayout(openPayout.order, 'seller_payout', 0, openPayout.payout, {
    commissionAmount: openPayout.commission,
    vatAmount: openPayout.vat,
    note: 'عائد بيع بعد خصم عمولة المنصّة وضريبتها',
  })

  /*
   * والمقفل يُقيَّد إيداعه ثم سحبه: هكذا يقرأ كشفه من صُرف له فعلًا — دخلَ
   * بقيد وخرج بقيد، لا رصيدًا ظهر ثم اختفى.
   */
  const closedPayout = completedDeal(0, 1, ['دار', '7700'], 200)
  creditProceeds(closedPayout.order, 1, closedPayout.payout)
  demoPayout(closedPayout.order, 'seller_payout', 1, closedPayout.payout, {
    commissionAmount: closedPayout.commission,
    vatAmount: closedPayout.vat,
    status: 'paid',
    paidAt: iso(-160 * HOUR),
    paymentReference: 'TRF-26-004417',
    note: 'عائد بيع بعد خصم عمولة المنصّة وضريبتها',
  })
  walletEntry(
    closedPayout.order,
    1,
    closedPayout.payout,
    'withdrawal',
    'صُرف إلى حسابك البنكي — مرجع الحوالة TRF-26-004417',
    iso(-160 * HOUR),
  )

  // أسئلة شائعة منشورة، بعضها يظهر أسفل صفحة المزاد
  const faqSeed: Omit<FaqItem, 'id' | 'createdAt' | 'updatedAt'>[] = [
    {
      question: 'ما السعر الاحتياطي؟ ولماذا لا أراه؟',
      answer:
        'السعر الاحتياطي هو أقل مبلغ يقبل البائع البيع عنده. ما يشوفه أحد غيره حتى لا يصير المزاد مساومة عليه — المزايد يعرف بس إذا وصلت المزايدات له أو ما وصلت. إذا انتهى المزاد دون بلوغه فلا بيع، وتُفكّ عرابين الجميع.',
      category: 'general',
      sortOrder: 1,
      published: true,
      showOnListing: true,
    },
    {
      question: 'ما العربون؟ ومتى يُخصم من رصيدي؟',
      answer:
        'العربون مبلغ يُحجز من رصيد محفظتك عند أول مزايدة لك في المزاد، ويضمن جدّية المزايدين. لا يُخصم عند الحجز — يبقى ملكك لكنه غير متاح للاستعمال. وقيمته تحدّدها إدارة المنصّة بقاعدة واحدة على كل المزادات، لا يرفعها بائع ولا يخفضها.',
      category: 'deposit',
      sortOrder: 2,
      published: true,
      showOnListing: true,
    },
    {
      question: 'ماذا يحدث لعربوني إذا فزت؟',
      answer:
        'يبقى محجوزًا حتى تُتمّ السداد خلال المهلة المحدّدة، ثم يُخصم من قيمة الصفقة فلا تدفعه مرّتين. أمّا إذا انتهت المهلة دون سداد فيحقّ للإدارة مصادرته وإعادة إرساء اللوحة على المزايد الذي يليك.',
      category: 'deposit',
      sortOrder: 3,
      published: true,
      showOnListing: true,
    },
    {
      question: 'خسرتُ المزاد — متى يعود عربوني؟',
      answer:
        'يعود متاحًا فور اكتمال سداد الفائز، لا لحظة انتهاء المزاد. السبب أنّ المزاد لا ينتهي بالرسوّ بل بالسداد: لو تخلّف الفائز عن الدفع أُعيد إرساء اللوحة على من يليه، ولو كنّا فككنا العرابين لَما بقي خلف مزايدتك مال يضمنها. وإن انتهى المزاد دون بيع — لم تبلغ أعلى مزايدة السعر الاحتياطي — فلا صفقة تنتظر، وتُفكّ العرابين كلّها فورًا.',
      category: 'deposit',
      sortOrder: 4,
      published: true,
      showOnListing: true,
    },
    {
      question: 'كيف أشحن رصيد محفظتي؟',
      answer:
        'من صفحة «محفظتي» اضغط «شحن الرصيد» واختر الطريقة المتاحة:\n\n• بالبطاقة: تُحوَّل إلى صفحة الدفع الآمنة ويُضاف الرصيد فور نجاح العملية.\n• بحوالة بنكية: تظهر لك بيانات حساب المنصّة ورقم مرجعي، حوّل المبلغ واكتب الرقم المرجعي في ملاحظات الحوالة، ثم أرفق رقم عمليتك. يُضاف الرصيد بعد تحقّق الإدارة من وصول الحوالة.',
      category: 'payment',
      sortOrder: 5,
      published: true,
      showOnListing: false,
    },
    {
      question: 'هل بيانات بطاقتي آمنة؟',
      answer:
        'نعم. الدفع بالبطاقة يتم عند بوابة الدفع نفسها، وما نشوف بيانات بطاقتك ولا نحفظ منها شي — يوصلنا بس إذا العملية نجحت أو لا.',
      category: 'payment',
      sortOrder: 6,
      published: true,
      showOnListing: false,
    },
    {
      question: 'كم يستغرق تأكيد الحوالة البنكية؟',
      answer:
        'يعتمد على وصول الحوالة إلى حساب المنصّة ومطابقتها. اكتب الرقم المرجعي الظاهر لك في ملاحظات التحويل — به تُطابَق حوالتك بسرعة. وتجد حالة العملية دائمًا في صفحة «محفظتي».',
      category: 'payment',
      sortOrder: 7,
      published: true,
      showOnListing: false,
    },
    {
      question: 'هل على الصفقة عمولة؟ وكيف تُحتسب؟',
      answer:
        'إن فعّلت الإدارة العمولة فهي تظهر لك **قبل** المزايدة أو الشراء لا بعده، محسوبةً على السعر القائم. تُخصم لحظة اكتمال الصفقة، وهي مقابل الوساطة لا جزء من ثمن اللوحة. وضريبة القيمة المضافة، إن كانت مفعّلة، تُطبَّق على العمولة وحدها لا على قيمة اللوحة: المنصّة تبيع خدمة وساطة لا تبيع اللوحة.',
      category: 'payment',
      sortOrder: 8,
      published: true,
      showOnListing: true,
    },
    {
      question: 'كيف يتم السداد ونقل الملكية؟',
      answer:
        'السداد ونقل الملكية يتمّان خارج المنصّة بين البائع والمشتري عبر القنوات الرسمية. المنصّة توثّق الصفقة ومهلتها، والبائع هو من يعلّمها مكتملة بعد الاستلام.',
      category: 'payment',
      sortOrder: 9,
      published: true,
      showOnListing: true,
    },
    {
      question: 'ما التمديد التلقائي؟',
      answer:
        'إذا وردت مزايدة في الثواني الأخيرة يمتدّ وقت المزاد تلقائيًا. الغرض منع القنص في اللحظة الأخيرة، وإعطاء بقيّة المزايدين فرصة عادلة للردّ.',
      category: 'bidding',
      sortOrder: 10,
      published: true,
      showOnListing: true,
    },
    {
      question: 'كيف أعرض لوحتي للبيع؟',
      answer:
        'من «لوحاتي» اختر «أضف لوحة»، وحدّد طريقة العرض: مزاد بمزايدات، أو بيع مباشر بسعر ثابت، أو استقبال عروض تختار منها. تُحفظ كمسودة أولًا، وتنشرها متى شئت.',
      category: 'selling',
      sortOrder: 11,
      published: true,
      showOnListing: false,
    },
  ]
  const faqNow = iso(-10 * 86_400_000)
  db.faq.push(
    ...faqSeed.map((item) => ({ ...item, id: newId('faq'), createdAt: faqNow, updatedAt: faqNow })),
  )

  // عروض معلّقة على إعلان «استقبال عروض»
  db.offers.push(
    {
      id: newId('ofr'),
      listingId: listings[4].id,
      buyerId: users[0].id,
      amount: riyalsToHalalas(7_500),
      message: 'جاهز للتحويل اليوم.',
      status: 'pending',
      createdAt: iso(-5_400_000),
      respondedAt: null,
    },
    {
      id: newId('ofr'),
      listingId: listings[5].id,
      buyerId: users[1].id,
      amount: riyalsToHalalas(32_000),
      message: null,
      status: 'pending',
      createdAt: iso(-2_700_000),
      respondedAt: null,
    },
  )
}
