import '../widgets/plate.dart';

/// طريقةُ البيع — ولكلٍّ لونُها ونقطتُها (§2.1).
enum SaleType { auction, fixed, offers }

/// حالةُ المزايد في المزاد.
enum BidStanding { none, top, outbid }

/// **لوحةٌ في السوق** — ما يحتاجه الكرتُ لا أكثر.
///
/// والحقولُ تطابق `ListingCard` في [توثيق المنصّة](../../../docs/domain-model.md)،
/// فما يصل من `api/listings` يُسقَط عليها مباشرةً.
class Listing {
  const Listing({
    required this.id,
    required this.reference,
    required this.letters,
    required this.number,
    required this.kind,
    required this.format,
    required this.emblem,
    required this.saleType,
    required this.price,
    this.bids = 0,
    this.endsAt,
    this.standing = BidStanding.none,
    this.mine = false,
    this.following = false,
    this.settlementPending = false,
  });

  final String id;

  /// رقمُ الإعلان — يُعرض تحت اللوحة.
  final String reference;

  final String letters;
  final String number;
  final PlateKind kind;
  final PlateFormat format;
  final PlateEmblem emblem;

  final SaleType saleType;

  /// **أعلى مزايدةٍ أو السعرُ الثابت — بالهللات.**
  ///
  /// ولا يُعرض سعرُ الافتتاح في الكروت، قرارٌ صريح: من رآه ظنّه السعرَ
  /// الحاضر، والحاضرُ أعلى منه بعد أوّل مزايدة.
  final int price;

  final int bids;
  final DateTime? endsAt;
  final BidStanding standing;

  /// **المالكُ يطّلع فقط** — لا يزايد ولا يشتري ولا يسوم على لوحته.
  final bool mine;

  final bool following;

  /// محجوزةٌ بانتظار سداد المشتري — تبقى معروضةً ولا تختفي.
  final bool settlementPending;

  /// نسخةٌ بحالِ متابعةٍ أخرى — للفحص وللتفاؤل بعد ضغطة الجرس.
  Listing copyWith({bool? following}) => Listing(
    id: id,
    reference: reference,
    letters: letters,
    number: number,
    kind: kind,
    format: format,
    emblem: emblem,
    saleType: saleType,
    price: price,
    bids: bids,
    endsAt: endsAt,
    standing: standing,
    mine: mine,
    following: following ?? this.following,
    settlementPending: settlementPending,
  );
}
