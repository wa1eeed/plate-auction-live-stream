import '../widgets/plate.dart';
import '../widgets/listing/bid_log.dart';
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
