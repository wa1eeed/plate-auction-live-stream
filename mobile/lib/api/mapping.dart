import '../models/listing.dart';
import '../models/wallet.dart';
import '../screens/notifications_screen.dart';
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

  /// **المحفظة** — من `api/account/wallet`.
  static WalletView wallet(Map<String, dynamic> json) {
    final deposits = (json['deposits'] as List?) ?? const [];
    final statement = (json['statement'] as Map?)?.cast<String, dynamic>();
    final entries =
        (statement?['entries'] as List?) ??
        (json['statement'] as List?) ??
        const [];

    return WalletView(
      available: (json['available'] as num?)?.toInt() ?? 0,
      balance: (json['balance'] as num?)?.toInt() ?? 0,
      held: (json['held'] as num?)?.toInt() ?? 0,
      deposits: deposits
          .whereType<Map>()
          .map((d) => _deposit(d.cast<String, dynamic>()))
          .whereType<HeldDeposit>()
          .toList(),
      ledger: entries
          .whereType<Map>()
          .map((e) => _ledger(e.cast<String, dynamic>()))
          .toList(),
    );
  }

  /// **والعربونُ يُعرض بلوحته** — فيُعرف بالنظر لا بفكّ حروفه.
  ///
  /// وعربونٌ بلا لوحةٍ (حُذف إعلانُها مثلًا) يُسقط من القائمة لا يُرسم
  /// فارغًا: صندوقٌ أبيضُ مكان اللوحة يُقرأ عطبًا.
  static HeldDeposit? _deposit(Map<String, dynamic> json) {
    final plate = (json['plate'] as Map?)?.cast<String, dynamic>();
    if (plate == null) return null;

    return HeldDeposit(
      amount: (json['amount'] as num?)?.toInt() ?? 0,
      why: json['reason'] as String? ?? 'محجوز على مزادٍ قائم',
      letters: plate['arabicLetters'] as String? ?? '',
      number: plate['plateNumbers'] as String? ?? '',
      kind: kind(plate['plateType'] as String?),
      format: format(plate['plateFormat'] as String?),
      emblem: emblem(plate['emblem'] as String?),
    );
  }

  static LedgerEntry _ledger(Map<String, dynamic> json) {
    /*
     * **والمبلغُ موجبٌ دائمًا في الخادم، والاتّجاهُ حقلٌ مستقلّ.**
     *
     * فيُجمعان هنا في رقمٍ بإشارة: الواجهةُ تُلوّن الداخلَ والخارجَ، وقراءةُ
     * الإشارة أوضحُ من مقابلة حقلين في كلّ سطر.
     */
    final amount = (json['amount'] as num?)?.toInt() ?? 0;
    final outgoing = json['direction'] == 'debit';

    return LedgerEntry(
      reference: json['reference'] as String? ?? '',
      kind: _ledgerKind(json['type'] as String?),
      amount: outgoing ? -amount : amount,
      at: time(json['createdAt']) ?? DateTime.now(),
      status: json['statusLabel'] as String? ?? '',
      note: json['note'] as String?,
    );
  }

  static LedgerKind _ledgerKind(String? raw) => switch (raw) {
    'topup' => LedgerKind.topup,
    'withdrawal' => LedgerKind.withdrawal,
    'deposit_hold' => LedgerKind.hold,
    'deposit_release' => LedgerKind.release,
    'deposit_forfeit' => LedgerKind.forfeit,
    'purchase' => LedgerKind.purchase,
    'payout' => LedgerKind.payout,
    _ => LedgerKind.topup,
  };

  /// **الإشعارات** — من `api/notifications`.
  static AppNotification notification(Map<String, dynamic> json) =>
      AppNotification(
        kind: _notifKind(json['type'] as String?),
        title: json['title'] as String? ?? '',
        body: json['body'] as String? ?? '',
        at: time(json['createdAt']) ?? DateTime.now(),
        unread: json['readAt'] == null,
      );

  static NotifKind _notifKind(String? raw) {
    final t = raw ?? '';
    if (t.contains('outbid') || t.contains('bid')) return NotifKind.outbid;
    if (t.contains('offer')) return NotifKind.offer;
    if (t.contains('won') || t.contains('award')) return NotifKind.won;
    if (t.contains('wallet') || t.contains('deposit')) {
      return NotifKind.wallet;
    }
    if (t.contains('order')) return NotifKind.order;
    return NotifKind.system;
  }
}
