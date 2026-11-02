import '../models/activity.dart';
import '../models/chat.dart';
import '../models/invoice.dart';
import '../models/listing.dart';
import '../models/order.dart';
import '../models/wallet.dart';
import '../screens/notifications_screen.dart';
import 'api_client.dart';
import 'mapping.dart';

/// سوقٌ مجلوبٌ **ومعه وقتُ الخادم**.
///
/// فالعدّاداتُ تُقاس بوقت الخادم لا بساعة الجهاز: ساعةٌ منحرفةٌ بدقائق
/// تُنهي مزادًا قبل أوانه، والمزايدةُ في آخر دقيقتين تُمدّد — فالانحرافُ
/// يُغيّر النتيجةَ لا العرض.
class MarketSnapshot {
  const MarketSnapshot({required this.listings, required this.serverTime});

  final List<Listing> listings;
  final DateTime serverTime;
}

/// **مستودعُ الواجهة** — كلُّ نداءٍ للخادم يمرّ به.
class MazadApi {
  const MazadApi(this._client);

  final ApiClient _client;

  ApiClient get client => _client;

  /// السوقُ كلُّه — `GET api/listings`.
  Future<MarketSnapshot> listings() async {
    final json = await _client.get('/api/listings');
    final rows = (json['listings'] as List?) ?? const [];

    return MarketSnapshot(
      listings: rows
          .whereType<Map>()
          .map((r) => ApiMapping.listing(r.cast<String, dynamic>()))
          .toList(),
      serverTime: ApiMapping.time(json['serverTime']) ?? DateTime.now(),
    );
  }

  /// تفاصيلُ لوحة — `GET api/listings/{id}`.
  Future<ListingDetailView> listingDetail(String id) async =>
      ApiMapping.listingDetail(await _client.get('/api/listings/$id'));

  /// الردُّ الخام — للفحص الحيّ.
  Future<Map<String, dynamic>> listingRaw(String id) =>
      _client.get('/api/listings/$id');

  /// مزايدة — `POST api/listings/{id}/bids`.
  Future<void> bid(String id, int amountHalalas) =>
      _client.post('/api/listings/$id/bids', body: {'amount': amountHalalas});

  /// شراءٌ مباشر — `POST api/listings/{id}/buy`.
  Future<Map<String, dynamic>> buy(String id) =>
      _client.post('/api/listings/$id/buy');

  /// سوم — `POST api/listings/{id}/offers`.
  Future<void> offer(String id, int amountHalalas) =>
      _client.post('/api/listings/$id/offers', body: {'amount': amountHalalas});

  /// **عرضُ لوحةٍ جديدة** — `POST api/listings`.
  ///
  /// **والمخطَّطُ يشترط اللاتينيَّ مع العربيّ**: الخادمُ يُطبّق قواعدَه على
  /// الاثنين، والخريطةُ معروفةٌ في الواجهة — فتُرسل محسوبةً لا يُطالَب
  /// المستخدمُ بكتابتها مرّتين.
  Future<void> createListing({
    required String plateType,
    required String plateFormat,
    required String arabicLetters,
    required String latinLetters,
    required String plateNumbers,
    required String emblem,
    required String saleType,
    required int priceRiyals,
    required int durationSeconds,
    int minimumIncrementRiyals = 0,
  }) => _client.post(
    '/api/listings',
    body: {
      'plateType': plateType,
      'plateFormat': plateFormat,
      'arabicLetters': arabicLetters,
      'latinLetters': latinLetters,
      'plateNumbers': plateNumbers,
      'emblem': emblem,
      'saleType': saleType,
      /*
         * **والمبالغُ بالريال في هذا المسار لا بالهللة.**
         *
         * فالمخطَّطُ يقرأها `riyalField` ويضربها هو — وإرسالُ الهللات
         * يُنشئ إعلانًا بمئة ضعف سعره.
         */
      'price': saleType == 'fixed' ? priceRiyals : 0,
      'startingPrice': saleType == 'auction' ? priceRiyals : 0,
      'minimumIncrement': minimumIncrementRiyals,
      'reservePrice': 0,
      'minimumOffer': saleType == 'offers' ? priceRiyals : 0,
      'durationSeconds': durationSeconds,
    },
  );

  /// المحفظة — `GET api/account/wallet`.
  Future<WalletView> wallet() async =>
      ApiMapping.wallet(await _client.get('/api/account/wallet'));

  /// الملفُّ الشخصيّ — `GET api/account/profile`.
  Future<ProfileView> profile() async =>
      ApiMapping.profile(await _client.get('/api/account/profile'));

  /// **حسابي كاملًا**: الملفُّ والمحفظةُ ولوحاتي في ندوةٍ واحدةٍ متوازية.
  ///
  /// فثلاثُ ندواتٍ متتابعةٍ تُبطئ الشاشةَ بمجموع أزمنتها، والمتوازيةُ
  /// بأبطئها وحده.
  Future<AccountBundle> account() async {
    final results = await Future.wait([profile(), wallet(), listings()]);

    final market = results[2] as MarketSnapshot;
    return AccountBundle(
      profile: results[0] as ProfileView,
      wallet: results[1] as WalletView,
      myPlates: market.listings.where((l) => l.mine).toList(),
    );
  }

  /// **حفظُ الإعدادات** — `PATCH api/account/profile`.
  ///
  /// **والملفُّ والحسابُ البنكيُّ يُرسلان معًا** كما يقبلهما المخطَّط:
  /// فالمستخدمُ يملأ الشاشةَ مرّةً ويحفظ مرّةً، وطلبان منفصلان يُنجح أحدَهما
  /// ويُسقط الآخرَ فتبقى الشاشةُ نصفَ محفوظة.
  Future<void> saveProfile({
    required String displayName,
    String? phone,
    String? city,
    String? snapchat,
    String? tiktok,
    String? instagram,
    String? iban,
    String? bankName,
    String? holderName,
  }) => _client.patch(
    '/api/account/profile',
    body: {
      'displayName': displayName,
      'phone': phone ?? '',
      'city': city ?? '',
      'social': {
        'snapchat': snapchat ?? '',
        'tiktok': tiktok ?? '',
        'instagram': instagram ?? '',
      },
      if (iban != null)
        'payout': {
          'iban': iban,
          'bankName': bankName ?? '',
          'holderName': holderName ?? '',
        },
    },
  );

  /// الإشعارات — `GET api/notifications`.
  Future<List<AppNotification>> notifications() async {
    final json = await _client.get('/api/notifications');
    final rows = (json['notifications'] as List?) ?? const [];
    return rows
        .whereType<Map>()
        .map((r) => ApiMapping.notification(r.cast<String, dynamic>()))
        .toList();
  }

  /// تعليمُ الإشعارات مقروءةً — `PATCH api/notifications`.
  Future<void> readNotifications() => _client.patch('/api/notifications');

  /// **صفقاتي** — `GET api/orders`: مشترياتٌ ومبيعاتٌ في ردٍّ واحد.
  Future<OrdersBundle> orders() async {
    final json = await _client.get('/api/orders');

    List<OrderView> read(String key, {required bool asBuyer}) =>
        ((json[key] as List?) ?? const [])
            .whereType<Map>()
            .map(
              (o) =>
                  ApiMapping.order(o.cast<String, dynamic>(), asBuyer: asBuyer),
            )
            .toList();

    return OrdersBundle(
      purchases: read('purchases', asBuyer: true),
      sales: read('sales', asBuyer: false),
    );
  }

  /// **ما يحتاجه «نشاطي»** — صفقاتي ولوحاتي في ندوتين متوازيتين.
  Future<ActivityBundle> activity() async {
    final results = await Future.wait([orders(), listings()]);
    final mine = results[0] as OrdersBundle;
    final market = (results[1] as MarketSnapshot).listings;

    return ActivityBundle(
      pending: mine.awaitingMe.map((o) => o.toPendingItem()).toList(),
      orders: [...mine.purchases, ...mine.sales],
      /*
       * **ومزايداتي وعروضي تُشتقّ من السوق** لا من مسارٍ ثالث.
       *
       * فالخادمُ يُرسل مع كلّ لوحةٍ حالَ المزايد عليها، والسوقُ مجلوبٌ
       * أصلًا — فندوةٌ ثالثةٌ تُبطئ بلا فائدة.
       */
      myBids: market
          .where(
            (l) =>
                l.saleType == SaleType.auction &&
                l.standing != BidStanding.none,
          )
          .toList(),
      myOffers: market.where((l) => l.saleType == SaleType.offers).toList(),
      watching: market.where((l) => l.following).toList(),
      serverTime: (results[1] as MarketSnapshot).serverTime,
    );
  }

  /// صفقةٌ — `GET api/orders/{id}`.
  Future<Map<String, dynamic>> order(String id) =>
      _client.get('/api/orders/$id');

  /// تأكيدُ بيانات المشتري — `POST api/orders/{id}/identity`.
  Future<void> confirmIdentity(
    String orderId, {
    required String nationalId,
    required String birthDate,
    required String birthCalendar,
  }) => _client.post(
    '/api/orders/$orderId/identity',
    body: {
      'nationalId': nationalId,
      'birthDate': birthDate,
      'birthCalendar': birthCalendar,
    },
  );

  /// إثباتُ نقل الملكيّة — `POST api/orders/{id}/transfer`.
  Future<void> submitTransfer(String orderId, {String? note}) =>
      _client.post('/api/orders/$orderId/transfer', body: {'note': ?note});

  /// **محادثةُ الصفقة** — `GET api/orders/{id}/messages`.
  ///
  /// ويعود `me` معها: الفقاعةُ تُرسم لي يسارًا وللطرف الآخر يمينًا، فلا بدّ
  /// أن تعرف أيُّها لي. ومعرّفُ الجلسة عند الخادم لا عند العميل.
  Future<ChatThread> chat(String orderId) async {
    final json = await _client.get('/api/orders/$orderId/messages');
    final me = json['me'] as String? ?? '';

    return ChatThread(
      me: me,
      messages: ((json['messages'] as List?) ?? const [])
          .cast<Map<String, dynamic>>()
          .map((row) => ApiMapping.chatMessage(row, me: me))
          .toList(),
    );
  }

  /// إرسالُ رسالةٍ نصّيّة — `POST api/orders/{id}/messages`.
  Future<ChatMessage> sendMessage(String orderId, String body) async {
    final json = await _client.post(
      '/api/orders/$orderId/messages',
      body: {'kind': 'text', 'body': body},
    );
    final row = (json['message'] as Map).cast<String, dynamic>();
    /* والمرسِلُ أنا بالضرورة — فلا تُنتظر جولةٌ ثانيةٌ لتعرف جهةَ الفقاعة */
    return ApiMapping.chatMessage(row, me: row['senderId'] as String? ?? '');
  }

  /// **فواتيرُ الصفقة** — `GET api/orders/{id}/invoice`.
  ///
  /// وهي قائمةٌ لا واحدة: للصفقة فاتورةُ عمولةِ مشترٍ وفاتورةُ عمولةِ بائع،
  /// ويُرسل الخادمُ ما كان منها لطالبها وحده.
  Future<List<TaxInvoice>> invoices(String orderId) async {
    final json = await _client.get('/api/orders/$orderId/invoice');
    return ((json['invoices'] as List?) ?? const [])
        .cast<Map<String, dynamic>>()
        .map(ApiMapping.invoice)
        .toList();
  }

  /// الأسئلةُ الشائعة — `GET api/faq`.
  Future<Map<String, dynamic>> faq() => _client.get('/api/faq');

  /// دخولٌ بالبريد وكلمة المرور — `POST api/auth/login`.
  ///
  /// **وهو ما كان في التطبيق القديم**، وما زال قائمًا في الخادم.
  Future<void> login({required String email, required String password}) =>
      _client.post(
        '/api/auth/login',
        body: {'email': email, 'password': password},
      );

  /// تسجيلُ حسابٍ جديد — `POST api/auth/register`.
  Future<void> register({
    required String name,
    required String email,
    required String password,
    required String phone,
  }) => _client.post(
    '/api/auth/register',
    body: {'name': name, 'email': email, 'password': password, 'phone': phone},
  );

  /// خروج — `POST api/auth/logout`.
  Future<void> logout() async {
    await _client.post('/api/auth/logout');
    await _client.clearSession();
  }
}

/// ما تحتاجه شاشةُ «حسابي» في ندوةٍ واحدة.
class AccountBundle {
  const AccountBundle({
    required this.profile,
    required this.wallet,
    required this.myPlates,
  });

  final ProfileView profile;
  final WalletView wallet;
  final List<Listing> myPlates;
}

/// مشترياتٌ ومبيعاتٌ معًا.
class OrdersBundle {
  const OrdersBundle({required this.purchases, required this.sales});

  final List<OrderView> purchases;
  final List<OrderView> sales;

  /// **ما ينتظر ردَّك من الجهتين** — وهو تابُ «بانتظارك».
  ///
  /// فالمشتري يُنتظر في السداد وتأكيد البيانات، والبائعُ في النقل. ومن
  /// يفتح التطبيقَ يسأل «ماذا عليّ؟» لا «أيَّ دورٍ ألبس الآن؟».
  List<OrderView> get awaitingMe => [
    ...purchases.where(
      (o) => o.stage == OrderStage.pay || o.stage == OrderStage.id,
    ),
    ...sales.where((o) => o.stage == OrderStage.transfer),
  ];
}

/// يحوّل صفقةً إلى بندٍ في «بانتظارك».
extension OrderPending on OrderView {
  /// **والنداءُ يتبع المرحلةَ والدور** — وهو ما يُغني عن تاباتٍ لكلّ نوع.
  PendingItem toPendingItem() {
    final (kicker, title, sub, cta) = switch (stage) {
      OrderStage.pay when youAreBuyer => (
        'صفقة $reference',
        'سدّد قيمة اللوحة',
        'يُحجز المبلغ أمانةً حتى تصلك اللوحة',
        'سدّد الآن',
      ),
      OrderStage.id when youAreBuyer => (
        'صفقة $reference',
        'أكّد بياناتك لنقل الملكية',
        'البائع ينتظر رقم هويتك ليبدأ النقل في أبشر',
        'أكّد بياناتك',
      ),
      OrderStage.transfer => (
        'صفقة $reference',
        'انقل الملكية في أبشر',
        'وصلتك بيانات المشتري — والمبلغ محجوز حتى تنقل',
        'اعرض الخطوات',
      ),
      _ => ('صفقة $reference', stageName, '', 'افتح الصفقة'),
    };

    return PendingItem(
      /* والمعرّفُ لا الرقمُ: منه تُفتح الصفقةُ وتُنادى مساراتُها */
      id: id,
      kind: stage == OrderStage.transfer
          ? PendingKind.transfer
          : PendingKind.order,
      role: youAreBuyer ? ActorRole.buyer : ActorRole.seller,
      letters: letters,
      number: number,
      plateKind: plateKind,
      format: format,
      emblem: emblem,
      saleLabel: source,
      kicker: kicker,
      title: title,
      sub: sub,
      cta: cta,
    );
  }
}

/// ما تحتاجه شاشةُ «نشاطي».
class ActivityBundle {
  const ActivityBundle({
    required this.pending,
    required this.orders,
    required this.myBids,
    required this.myOffers,
    required this.watching,
    required this.serverTime,
  });

  final List<PendingItem> pending;

  /// **الصفقاتُ كاملةً مع بنودها** — فمنها تُفتح الصفقةُ بلا ندوةٍ ثانية.
  ///
  /// فالبندُ في «بانتظارك» يحمل معرّفًا ونصًّا، والشاشةُ تحتاج الصفقةَ
  /// كلَّها. وطلبُها من جديدٍ بالمعرّف يُعيد ما في اليد.
  final List<OrderView> orders;

  final List<Listing> myBids;
  final List<Listing> myOffers;
  final List<Listing> watching;
  final DateTime serverTime;
}
