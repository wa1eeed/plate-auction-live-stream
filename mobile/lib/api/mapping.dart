import '../models/chat.dart';
import '../models/invoice.dart';
import '../models/listing.dart';
import '../models/order.dart';
import '../models/wallet.dart';
import '../screens/notifications_screen.dart';
import '../widgets/listing/bid_log.dart';
import '../widgets/listing/price_box.dart';
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

  /// **رسالةٌ في محادثة الصفقة** — من `api/orders/{id}/messages`.
  ///
  /// و`me` يُمرَّر لأنّ الخادمَ يُرسل `senderId` لا «لي»: المعرّفُ واحدٌ
  /// للطرفين والجهةُ تختلف بمن يقرأ.
  static ChatMessage chatMessage(
    Map<String, dynamic> json, {
    required String me,
  }) {
    final seconds = (json['durationSeconds'] as num?)?.toInt();

    return ChatMessage(
      id: json['id'] as String? ?? '',
      kind: messageKind(json['kind'] as String?),
      at: time(json['createdAt']) ?? DateTime.now(),
      mine: json['senderId'] == me,
      text: json['body'] as String?,
      mediaKey: json['mediaKey'] as String?,
      fileName: json['fileName'] as String?,
      fileSize: (json['fileSize'] as num?)?.toInt(),
      duration: seconds == null ? null : Duration(seconds: seconds),
    );
  }

  static MessageKind messageKind(String? raw) => switch (raw) {
    'image' => MessageKind.image,
    'pdf' => MessageKind.pdf,
    'voice' => MessageKind.voice,
    _ => MessageKind.text,
  };

  /// **فاتورةٌ ضريبيّة** — من `api/orders/{id}/invoice`.
  static TaxInvoice invoice(Map<String, dynamic> json) => TaxInvoice(
    id: json['id'] as String? ?? '',
    reference: json['reference'] as String? ?? '',
    uuid: json['uuid'] as String? ?? '',
    kind: json['kind'] == 'seller_commission'
        ? InvoiceKind.sellerCommission
        : InvoiceKind.buyerCommission,
    orderReference: json['orderReference'] as String? ?? '',
    customerName: json['customerName'] as String? ?? '',
    sellerName: json['sellerName'] as String? ?? '',
    sellerVatNumber: json['sellerVatNumber'] as String? ?? '',
    description: json['description'] as String? ?? '',
    netAmount: (json['netAmount'] as num?)?.toInt() ?? 0,
    vatRate: (json['vatRate'] as num?)?.toDouble() ?? 0.15,
    vatAmount: (json['vatAmount'] as num?)?.toInt() ?? 0,
    totalAmount: (json['totalAmount'] as num?)?.toInt() ?? 0,
    issuedAt: time(json['issuedAt']) ?? DateTime.now(),
    qr: json['qr'] as String? ?? '',
  );

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
    /*
     * **وكشفُ الحساب سطورُه في `lines`** — كما يبنيه `buildStatement`.
     *
     * وكان يُقرأ `entries` ثمّ يُحتاط بقراءة `statement` قائمةً — وهو كائنٌ
     * دائمًا، فانقلب الاحتياطُ إلى تحويلٍ ساقط: «_Map is not a subtype of
     * List». ويُقرأ المفتاحُ الصحيحُ أوّلًا، ولا يُحوَّل ما ليس قائمةً:
     * `whereType<List>()` تُسقط ما خالف بلا رمي.
     */
    final statement = (json['statement'] as Map?)?.cast<String, dynamic>();
    final entries =
        [
          statement?['lines'],
          statement?['entries'],
          json['statement'],
        ].whereType<List>().firstOrNull ??
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

  /// **وأسماءُ الأنواع أسماءُ الخادم** — `LedgerEntryType` باثني عشر.
  ///
  /// و`purchase` و`payout` لم تكونا فيه قطّ (اسماهما `purchase_payment` و
  /// `sale_proceeds`)، وما لم يُعرَف كان يسقط إلى «شحن رصيد».
  static LedgerKind _ledgerKind(String? raw) => switch (raw) {
    'topup' => LedgerKind.topup,
    'withdrawal' => LedgerKind.withdrawal,
    'deposit_hold' => LedgerKind.hold,
    'deposit_release' => LedgerKind.release,
    'deposit_forfeit' => LedgerKind.forfeit,
    'deposit_applied' => LedgerKind.depositApplied,
    'sale_proceeds' => LedgerKind.saleProceeds,
    'purchase_payment' => LedgerKind.purchase,
    'purchase_refund' => LedgerKind.refund,
    'commission' => LedgerKind.commission,
    'vat' => LedgerKind.vat,
    _ => LedgerKind.adjustment,
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

  /// **تفاصيلُ لوحةٍ** — من `api/listings/{id}`.
  static ListingDetailView listingDetail(Map<String, dynamic> json) {
    final seller = (json['seller'] as Map?)?.cast<String, dynamic>();
    final bids = (json['bids'] as List?) ?? const [];

    return ListingDetailView(
      listing: listing(json),
      /*
       * **والعربونُ المطلوب قد يكون صفرًا** — فلا تُعرض بطاقتُه حينئذٍ:
       * بطاقةٌ تقول «العربون 0 ر.س» تُثير سؤالًا لا جوابَ له.
       */
      depositAmount: (json['depositAmount'] as num?)?.toInt() ?? 0,
      increment: (json['minimumIncrement'] as num?)?.toInt() ?? 0,
      nextBidAmount: (json['nextBidAmount'] as num?)?.toInt() ?? 0,
      sellerName: seller?['name'] as String? ?? '—',
      reserve: _reserve(json['reserveState'] as String?),
      iAmHighest: json['iAmHighest'] == true,
      bids: bids
          .whereType<Map>()
          .map((b) => _bid(b.cast<String, dynamic>()))
          .toList(),
    );
  }

  static ReserveState _reserve(String? raw) => switch (raw) {
    'met' => ReserveState.met,
    'not_met' => ReserveState.notMet,
    _ => ReserveState.none,
  };

  /// **والاسمُ يصل مقنّعًا من الخادم** — فلا يُقنَّع مرّتين.
  ///
  /// والتقنيعُ في الخادم هو الصواب: ما لا يُرسَل لا يُسرَّب، وتقنيعُ
  /// الواجهة وحدها يترك الاسمَ كاملًا في الشبكة لمن يقرأ الطلبات.
  static BidEntry _bid(Map<String, dynamic> json) => BidEntry(
    bidder: json['bidderName'] as String? ?? '—',
    amount: (json['amount'] as num?)?.toInt() ?? 0,
    at: time(json['createdAt']) ?? DateTime.now(),
    isMine: json['isMine'] == true,
  );

  /// **الملفُّ الشخصيّ** — من `api/account/profile`.
  static ProfileView profile(Map<String, dynamic> json) {
    final user = (json['user'] as Map?)?.cast<String, dynamic>() ?? json;
    final handle = user['handle'] as String?;

    return ProfileView(
      /* والخادمُ يسمّيه `displayName` — و`name` احتياطٌ لردٍّ مختصَر */
      name: user['displayName'] as String? ?? user['name'] as String? ?? '—',
      /* والمعرّفُ يصل بلا `@` — وهي علامةُ عرضٍ تُضاف هنا */
      handle: handle == null || handle.isEmpty ? '' : '@$handle',
      membershipNumber:
          user['membershipNumber'] as String? ??
          user['reference'] as String? ??
          '',
      city: user['city'] as String? ?? '',
      email: user['email'] as String? ?? '',
      phone: user['phone'] as String? ?? '',
    );
  }

  /// **صفقةٌ في قائمة «صفقاتي»** — من `api/orders`.
  static OrderView order(Map<String, dynamic> json, {required bool asBuyer}) {
    final plate = (json['plate'] as Map?)?.cast<String, dynamic>() ?? const {};
    final counterpart = json['counterpartName'] as String? ?? '—';

    return OrderView(
      id: json['id'] as String? ?? '',
      reference: json['reference'] as String? ?? '',
      stage: _stage(json['status'] as String?),
      source: _sourceLabel(json['source'] as String?),
      letters: plate['arabicLetters'] as String? ?? '',
      number: plate['plateNumbers'] as String? ?? '',
      plateKind: kind(plate['plateType'] as String?),
      format: format(plate['plateFormat'] as String?),
      emblem: emblem(plate['emblem'] as String?),
      price: (json['amount'] as num?)?.toInt() ?? 0,
      net: ((json['settlement'] as Map?)?['net'] as num?)?.toInt(),
      /*
       * **والطرفُ الآخرُ يصل باسمٍ واحد** — فيُركَّب الطرفان من دور القارئ:
       * من يقرأ مشترياتِه هو المشتري، والآخرُ هو البائع. والخادمُ لا يُرسل
       * الاسمين لأنّ أحدَهما صاحبُ الطلب، ومعرفتُه بنفسه لا تحتاج شبكة.
       */
      buyerName: asBuyer ? 'أنت' : counterpart,
      sellerName: asBuyer ? counterpart : 'أنت',
      youAreBuyer: asBuyer,
      createdAt: time(json['createdAt']) ?? DateTime.now(),
      paidAt: time(json['paidAt']),
      identityAt: time(json['identityConfirmedAt']),
      transferAt: time(json['transferProofAt']),
      releasedAt: time(json['releasedAt']),
      deadline: time(json['paymentDueAt']) ?? time(json['transferDueAt']),
    );
  }

  static OrderStage _stage(String? raw) => switch (raw) {
    'awaiting_settlement' => OrderStage.pay,
    'escrow_held' => OrderStage.id,
    'ownership_transferred' => OrderStage.review,
    'completed' => OrderStage.done,
    'cancelled' => OrderStage.cancelled,
    'defaulted' => OrderStage.defaulted,
    _ => OrderStage.pay,
  };

  static String _sourceLabel(String? raw) => switch (raw) {
    'fixed' => 'بيع مباشر',
    'offer' || 'offers' => 'سوم',
    _ => 'مزاد',
  };
}

/// الملفُّ الشخصيُّ كما تحتاجه شاشةُ «حسابي».
class ProfileView {
  const ProfileView({
    required this.name,
    required this.handle,
    required this.membershipNumber,
    required this.city,
    required this.email,
    required this.phone,
  });

  final String name;
  final String handle;
  final String membershipNumber;
  final String city;
  final String email;
  final String phone;
}

/// تفاصيلُ لوحةٍ كما تحتاجها شاشتُها.
class ListingDetailView {
  const ListingDetailView({
    required this.listing,
    required this.depositAmount,
    required this.increment,
    required this.nextBidAmount,
    required this.sellerName,
    required this.reserve,
    required this.iAmHighest,
    required this.bids,
  });

  final Listing listing;
  final int depositAmount;
  final int increment;
  final int nextBidAmount;
  final String sellerName;
  final ReserveState reserve;
  final bool iAmHighest;
  final List<BidEntry> bids;
}
