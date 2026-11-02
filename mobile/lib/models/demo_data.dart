import '../widgets/plate.dart';
import '../widgets/listing/bid_log.dart';
import 'activity.dart';
import 'order.dart';
import 'wallet.dart';
import '../screens/chat_screen.dart';
import '../screens/notifications_screen.dart';
import 'listing.dart';

/// **بياناتٌ تجريبيّةٌ ريثما تُربط `api/listings`** — بذرةُ النموذج نفسُها.
///
/// وهي في موضعٍ واحدٍ تقرؤه الرئيسيّةُ والسوقُ معًا، فلا تتناقض الشاشتان.

List<Listing> demoAuctions(DateTime now) => [
  Listing(
    id: '1',
    reference: 'L26-00421',
    letters: 'س ع د',
    number: '1',
    kind: PlateKind.private,
    format: PlateFormat.long,
    emblem: PlateEmblem.palm,
    saleType: SaleType.auction,
    price: 125000000,
    bids: 23,
    endsAt: now.add(const Duration(days: 2, hours: 5, minutes: 23)),
    standing: BidStanding.top,
  ),
  Listing(
    id: '2',
    reference: 'L26-00418',
    letters: 'ق و س',
    number: '4040',
    kind: PlateKind.private,
    format: PlateFormat.standard,
    emblem: PlateEmblem.palm,
    saleType: SaleType.auction,
    price: 8000000,
    bids: 7,
    endsAt: now.add(const Duration(hours: 3, minutes: 12)),
  ),
  Listing(
    id: '3',
    reference: 'L26-00410',
    letters: 'ر ر',
    number: '77',
    kind: PlateKind.private,
    format: PlateFormat.long,
    emblem: PlateEmblem.vision,
    saleType: SaleType.auction,
    price: 47500000,
    bids: 41,
    endsAt: now.add(const Duration(days: 1, hours: 2)),
    standing: BidStanding.outbid,
  ),
];

List<Listing> demoFixed(DateTime now) => [
  const Listing(
    id: '4',
    reference: 'L26-00399',
    letters: 'ن ق ل',
    number: '5566',
    kind: PlateKind.transport,
    format: PlateFormat.sport,
    emblem: PlateEmblem.palm,
    saleType: SaleType.fixed,
    price: 3500000,
  ),
  const Listing(
    id: '5',
    reference: 'L26-00381',
    letters: 'ك ط ع',
    number: '1234',
    kind: PlateKind.private,
    format: PlateFormat.standard,
    emblem: PlateEmblem.palm,
    saleType: SaleType.fixed,
    price: 12000000,
    settlementPending: true,
  ),
];

List<Listing> demoOffers(DateTime now) => [
  const Listing(
    id: '6',
    reference: 'L26-00355',
    letters: 'ح د',
    number: '9',
    kind: PlateKind.motorcycle,
    format: PlateFormat.standard,
    emblem: PlateEmblem.palm,
    saleType: SaleType.offers,
    price: 2200000,
  ),
  const Listing(
    id: '7',
    reference: 'L26-00344',
    letters: 'ب ه ا',
    number: '2846',
    kind: PlateKind.private,
    format: PlateFormat.long,
    emblem: PlateEmblem.dereyah,
    saleType: SaleType.offers,
    price: 6400000,
  ),
];

/// كلُّ المعروض — ما يراه السوق.
List<Listing> demoAll(DateTime now) => [
  ...demoAuctions(now),
  ...demoFixed(now),
  ...demoOffers(now),
];

/// كشفُ مزايداتٍ تجريبيٌّ — أسماءٌ تُقنَّع عند العرض.
List<BidEntry> demoBids(DateTime now) => [
  BidEntry(
    bidder: 'أنت',
    amount: 125000000,
    at: now.subtract(const Duration(minutes: 4)),
    isMine: true,
  ),
  BidEntry(
    bidder: 'خالد عبدالله',
    amount: 124000000,
    at: now.subtract(const Duration(minutes: 19)),
  ),
  BidEntry(
    bidder: 'نورة سعد',
    amount: 120000000,
    at: now.subtract(const Duration(hours: 2, minutes: 7)),
  ),
  BidEntry(
    bidder: 'فهد الدوسري',
    amount: 118500000,
    at: now.subtract(const Duration(hours: 5)),
  ),
];

/// **بنودُ «بانتظارك» الأربعة** — واحدٌ من كلّ نوعٍ يجمعه التاب.
List<PendingItem> demoPending() => const [
  PendingItem(
    id: 'p1',
    kind: PendingKind.order,
    role: ActorRole.buyer,
    letters: 'ق و س',
    number: '1',
    plateKind: PlateKind.private,
    format: PlateFormat.long,
    emblem: PlateEmblem.palm,
    saleLabel: 'مزاد',
    kicker: 'صفقة S26-00087',
    title: 'أكّد بياناتك لنقل الملكية',
    sub: 'البائع ينتظر رقم هويتك ليبدأ النقل في أبشر',
    cta: 'أكّد بياناتك',
  ),
  PendingItem(
    id: 'p2',
    kind: PendingKind.offer,
    role: ActorRole.seller,
    letters: 'ك ط ع',
    number: '4040',
    plateKind: PlateKind.private,
    format: PlateFormat.standard,
    emblem: PlateEmblem.palm,
    saleLabel: 'سوم',
    kicker: 'سوم على لوحتك',
    title: '24,000 ر.س من سلطان ع*****',
    sub: 'طلبت 20,000 ر.س كحدّ أدنى · 3 عروض على اللوحة',
    cta: 'اقبل السوم',
  ),
  PendingItem(
    id: 'p3',
    kind: PendingKind.outbid,
    role: ActorRole.buyer,
    letters: 'ر ر',
    number: '77',
    plateKind: PlateKind.private,
    format: PlateFormat.long,
    emblem: PlateEmblem.vision,
    saleLabel: 'مزاد',
    kicker: 'تجاوزك أحد',
    title: 'أعلى مزايدة 51,000 ر.س',
    sub: 'مزايدتك 47,000 · ينتهي خلال 1 يوم و5 س',
    cta: 'زايد 53,000',
  ),
  PendingItem(
    id: 'p4',
    kind: PendingKind.transfer,
    role: ActorRole.seller,
    letters: 'ن ق ل',
    number: '5566',
    plateKind: PlateKind.transport,
    format: PlateFormat.sport,
    emblem: PlateEmblem.palm,
    saleLabel: 'بيع مباشر',
    kicker: 'صفقة S26-00091',
    title: 'انقل الملكية في أبشر',
    sub: 'وصلتك بيانات المشتري — والمبلغ محجوز حتى تنقل',
    cta: 'اعرض الخطوات',
  ),
];

/// صفقةٌ تجريبيّةٌ في مرحلة تأكيد البيانات — وهي حالُ اللقطة ‎٠٦‎.
OrderView demoOrder(DateTime now) => OrderView(
  reference: 'S26-00087',
  stage: OrderStage.id,
  source: 'مزاد',
  letters: 'ق و س',
  number: '1',
  plateKind: PlateKind.private,
  format: PlateFormat.long,
  emblem: PlateEmblem.palm,
  price: 4100000,
  buyerName: 'وليد (أنت)',
  sellerName: 'فهد ع*****',
  youAreBuyer: true,
  createdAt: now.subtract(const Duration(hours: 3, minutes: 40)),
  paidAt: now.subtract(const Duration(hours: 2, minutes: 28)),
);

/// محفظةٌ تجريبيّةٌ — أرقامُ اللقطة ‎٠٧‎.
WalletView demoWallet(DateTime now) => WalletView(
  available: 3850000,
  balance: 5000000,
  held: 1150000,
  deposits: const [
    HeldDeposit(
      amount: 500000,
      why: 'أنت الأعلى — يبقى حتى يُحسم المزاد',
      letters: 'ق و س',
      number: '1',
      kind: PlateKind.private,
      format: PlateFormat.long,
      emblem: PlateEmblem.palm,
    ),
    HeldDeposit(
      amount: 500000,
      why: 'يعود إن انتهى المزاد ولم ترسُ عليك',
      letters: 'ك ط ع',
      number: '4040',
      kind: PlateKind.private,
      format: PlateFormat.long,
      emblem: PlateEmblem.palm,
    ),
    HeldDeposit(
      amount: 150000,
      why: 'أنت الأعلى — يبقى حتى يُحسم المزاد',
      letters: 'ر ر',
      number: '77',
      kind: PlateKind.private,
      format: PlateFormat.long,
      emblem: PlateEmblem.vision,
    ),
  ],
  ledger: [
    LedgerEntry(
      reference: 'W26-00412',
      kind: LedgerKind.hold,
      amount: -500000,
      at: now.subtract(const Duration(hours: 2)),
      status: 'محجوز',
      note: 'و ل ق 9999',
    ),
    LedgerEntry(
      reference: 'W26-00408',
      kind: LedgerKind.release,
      amount: 500000,
      at: now.subtract(const Duration(days: 1, hours: 4)),
      status: 'تمّ',
      note: 'لم ترسُ عليك',
    ),
    LedgerEntry(
      reference: 'W26-00401',
      kind: LedgerKind.topup,
      amount: 2500000,
      at: now.subtract(const Duration(days: 3)),
      status: 'تمّ',
    ),
    LedgerEntry(
      reference: 'W26-00397',
      kind: LedgerKind.withdrawal,
      amount: -1000000,
      at: now.subtract(const Duration(days: 6)),
      status: 'قيد المراجعة',
    ),
  ],
);

/// إشعاراتٌ تجريبيّة — ولكلّ نوعٍ أيقونتُه.
List<AppNotification> demoNotifications(DateTime now) => [
  AppNotification(
    kind: NotifKind.outbid,
    title: 'تجاوزك أحد في «ر ر 77»',
    body: 'أعلى مزايدة 51,000 ر.س — ينتهي خلال يوم و5 ساعات',
    at: now.subtract(const Duration(minutes: 12)),
    unread: true,
  ),
  AppNotification(
    kind: NotifKind.order,
    title: 'صفقة S26-00087 تنتظر بياناتك',
    body: 'أكّد رقم هويتك وتاريخ ميلادك ليبدأ البائع النقل',
    at: now.subtract(const Duration(hours: 2, minutes: 28)),
    unread: true,
  ),
  AppNotification(
    kind: NotifKind.offer,
    title: 'سوم جديد على «ك ط ع 4040»',
    body: '24,000 ر.س من سلطان ع*****',
    at: now.subtract(const Duration(hours: 6)),
  ),
  AppNotification(
    kind: NotifKind.wallet,
    title: 'عاد عربونك 5,000 ر.س',
    body: 'انتهى مزاد «ا ه ب 2846» ولم ترسُ عليك',
    at: now.subtract(const Duration(days: 1, hours: 4)),
  ),
  AppNotification(
    kind: NotifKind.won,
    title: 'رست عليك «ق و س 1»',
    body: 'بمبلغ 41,000 ر.س — سدّد خلال 24 ساعة',
    at: now.subtract(const Duration(days: 2)),
  ),
];

/// محادثةٌ تجريبيّةٌ — نصٌّ وصورةٌ وملفٌّ وصوت.
List<ChatMessage> demoChat(DateTime now) => [
  ChatMessage(
    kind: MessageKind.text,
    at: now.subtract(const Duration(hours: 3)),
    mine: false,
    text: 'السلام عليكم، جاهز أنقل اللوحة أول ما تأكّد بياناتك.',
  ),
  ChatMessage(
    kind: MessageKind.text,
    at: now.subtract(const Duration(hours: 2, minutes: 51)),
    mine: true,
    text: 'وعليكم السلام، أكّدتها الحين. تقدر تبدأ النقل.',
  ),
  ChatMessage(
    kind: MessageKind.image,
    at: now.subtract(const Duration(hours: 1, minutes: 12)),
    mine: false,
  ),
  ChatMessage(
    kind: MessageKind.pdf,
    at: now.subtract(const Duration(minutes: 48)),
    mine: false,
    fileName: 'إثبات-النقل.pdf',
    fileSize: '240 KB',
  ),
  ChatMessage(
    kind: MessageKind.voice,
    at: now.subtract(const Duration(minutes: 9)),
    mine: true,
    duration: Duration(seconds: 23),
  ),
];
