import '../models/listing.dart';
import '../widgets/plate.dart';

/// **تحويلُ ما يصل من الخادم إلى نماذج الشاشات.**
///
/// وهو في موضعٍ واحد: أسماءُ الخادم تختلف عن أسماء الواجهة (`plateType`
/// مقابل `kind`، و`palm-swords-black` مقابل `palm`)، ولو تُرجمت في كلّ
/// شاشةٍ لتناقضت الترجماتُ عند أوّل اسمٍ جديد.
abstract final class ApiMapping {
  /// **وما لا يُعرف يُردّ إلى الافتراضيّ لا يُسقط الشاشة.**
  ///
  /// فاسمٌ جديدٌ يُضاف في الخادم غدًا (شعارٌ أو إصدار) يجب ألّا يُفرغ السوقَ
  /// على من لم يُحدّث تطبيقَه — يُرسم بالافتراضيّ ويبقى ما عداه صحيحًا.
  static PlateKind kind(String? raw) => switch (raw) {
    'transport' => PlateKind.transport,
    'motorcycle' => PlateKind.motorcycle,
    _ => PlateKind.private,
  };

  static PlateFormat format(String? raw) => switch (raw) {
    'standard' => PlateFormat.standard,
    'sport' => PlateFormat.sport,
    _ => PlateFormat.long,
  };

  static PlateEmblem emblem(String? raw) => switch (raw) {
    'palm-swords-gold' => PlateEmblem.gold,
    'vision-2030' => PlateEmblem.vision,
    'dereyah' => PlateEmblem.dereyah,
    'madaen' => PlateEmblem.madaen,
    _ => PlateEmblem.palm,
  };

  static SaleType saleType(String? raw) => switch (raw) {
    'fixed' => SaleType.fixed,
    'offers' => SaleType.offers,
    _ => SaleType.auction,
  };

  /// **والوقتُ يصل بصيغتين**: `2026-11-05 07:42:32.351+00` و`…T…Z`.
  ///
  /// فالأولى لا يقبلها `DateTime.parse` لأنّ بينهما فراغًا لا `T`،
  /// والثانيةُ تقبلها. فيُوحَّدان قبل التحليل.
  static DateTime? time(Object? raw) {
    if (raw is! String || raw.isEmpty) return null;
    final normalized = raw.replaceFirst(' ', 'T');
    return DateTime.tryParse(normalized)?.toLocal();
  }

  /// لوحةٌ في السوق — من `api/listings`.
  static Listing listing(Map<String, dynamic> json) {
    final plate = (json['plate'] as Map?)?.cast<String, dynamic>() ?? const {};

    return Listing(
      id: json['id'] as String? ?? '',
      reference: json['reference'] as String? ?? '',
      /*
       * **وحروفُ اللوحة تصل ملتصقةً** (`رر`) — والمكوّنُ يقبلها كما هي،
       * فهو يُسقط الفراغاتِ قبل أن يرسم.
       */
      letters: plate['arabicLetters'] as String? ?? '',
      number: plate['plateNumbers'] as String? ?? '',
      kind: kind(plate['plateType'] as String?),
      format: format(plate['plateFormat'] as String?),
      emblem: emblem(plate['emblem'] as String?),
      saleType: saleType(json['saleType'] as String?),
      price: (json['displayPrice'] as num?)?.toInt() ?? 0,
      bids: (json['bidCount'] as num?)?.toInt() ?? 0,
      endsAt: time(json['endsAt']),
      mine: json['isMine'] == true,
      settlementPending: json['settlementPending'] == true,
    );
  }
}
