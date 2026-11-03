import '../models/activity.dart';
import '../models/chat.dart';
import '../models/checkout.dart';
import '../models/invoice.dart';
import '../models/listing.dart';
import '../models/order.dart';
import '../models/wallet.dart';
import '../screens/notifications_screen.dart';
import '../screens/settings_screen.dart' show DeletionBlocker;
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

  /// **ما تحتاجه الشاشةُ الرئيسيّة** — السوقُ ومعه ترويستُه.
  ///
  /// فالترويسةُ تعرض الرصيدَ المتاحَ وعددَ ما ينتظر ردَّك ونقطةَ الإشعارات،
  /// وثلاثتُها خلف الحساب. وكانت أرقامًا مكتوبةً في الشاشة.
  ///
  /// **ولمن لا حسابَ له يُجلب السوقُ وحده** — فثلاثةُ طلباتٍ تُردّ ‎٤٠١‎
  /// تُبطئ أوّلَ شاشةٍ يراها الزائرُ بلا فائدة.
  ///
  /// **وإخفاقُ واحدٍ منها لا يُفرغ الشاشة**: السوقُ هو المحتوى، والترويسةُ
  /// زينتُه. فتُقرأ ما وصل ويُترك ما لم يصل بصفره.
  Future<HomeBundle> home({required bool signedIn}) async {
    final market = await listings();
    if (!signedIn) return HomeBundle(market: market);

    final rest = await Future.wait([
      wallet().then<Object?>((w) => w).catchError((_) => null),
      orders().then<Object?>((o) => o).catchError((_) => null),
      notifications().then<Object?>((n) => n).catchError((_) => null),
    ]);

    final w = rest[0] as WalletView?;
    final mine = rest[1] as OrdersBundle?;
    final notes = rest[2] as List<AppNotification>?;
    final waiting = mine?.awaitingMe ?? const [];

    return HomeBundle(
      market: market,
      availableHalalas: w?.available ?? 0,
      pendingCount: waiting.length,
      pendingFirst: waiting.isEmpty
          ? null
          : waiting.first.toPendingItem().title,
      hasUnread: notes?.any((n) => n.unread) ?? false,
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
  ///
  /// **والملفُّ وحده شرطُ الشاشة** — فيه الاسمُ والمعرّفُ ورقمُ العضوية،
  /// وشاشةُ حسابٍ باسم «—» أسوأُ من خطأٍ يُقال. وأمّا المحفظةُ واللوحاتُ
  /// فتُقرأ ما وصل: `Future.wait` تسقط بأوّل إخفاق، فكان سطرٌ واحدٌ ساقطٌ
  /// في الكشف يُلبس الشاشةَ كلَّها «تعذّر إتمام الطلب».
  Future<AccountBundle> account() async {
    final me = await profile();
    final rest = await Future.wait([
      wallet().then<Object?>((w) => w).catchError((_) => null),
      listings().then<Object?>((m) => m).catchError((_) => null),
    ]);

    final market = rest[1] as MarketSnapshot?;
    return AccountBundle(
      profile: me,
      wallet: rest[0] as WalletView? ?? const WalletView.empty(),
      myPlates:
          market?.listings.where((l) => l.mine).toList() ?? const <Listing>[],
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
    final snapshot = results[1] as MarketSnapshot;
    final market = snapshot.listings;
    final serverTime = snapshot.serverTime;

    /*
     * **و«بانتظارك» يجمع الصفقاتِ والتجاوزَ** — §5.6 يذكر أربعةَ أنواع.
     *
     * وكان يبني الصفقاتِ وحدها، فمن تجاوزه أحدٌ في مزادٍ لم يُعلَم إلّا
     * بأن يفتح «مزايداتي» ويقارن بعينه. والبياناتُ في السوق المجلوب أصلًا:
     * الخادمُ يُرسل مع كلّ لوحةٍ حالَ المزايد عليها.
     *
     * **وسومٌ وصلك لا يُبنى بعد**: لا مسارَ يُرجع السومَ على لوحاتي.
     */
    final outbid = market
        .where(
          (l) =>
              l.saleType == SaleType.auction &&
              l.standing == BidStanding.outbid &&
              /* ومزادٌ انقضى لا يُزايَد فيه — فلا يُنادى عليه */
              (l.endsAt == null || l.endsAt!.isAfter(serverTime)),
        )
        .map(_outbidItem);

    return ActivityBundle(
      pending: [...mine.awaitingMe.map((o) => o.toPendingItem()), ...outbid],
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
      serverTime: serverTime,
    );
  }

  /// **صفقةٌ واحدة** — `GET api/orders/{id}`.
  ///
  /// تُقرأ بعد كلّ خطوةٍ تُغيّر المرحلة، ودورُك فيها يأتي من الخادم
  /// (`side`) فلا يُخمَّن من اسمٍ أو ترتيب.
  Future<OrderView> order(String id) async {
    final json = await _client.get('/api/orders/$id');
    final row = (json['order'] as Map?)?.cast<String, dynamic>() ?? const {};
    return ApiMapping.order(row, asBuyer: json['side'] != 'seller');
  }

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

  /// **صفحةُ سداد صفقة** — `GET api/checkout/{id}`.
  ///
  /// مقصورةٌ على مشتري الصفقة في الخادم، فردُّها ‎٤٠٣‎ لغيره.
  Future<CheckoutInfo> checkout(String orderId) async {
    final json = await _client.get('/api/checkout/$orderId');
    final order = (json['order'] as Map?)?.cast<String, dynamic>() ?? const {};
    final s =
        (order['settlement'] as Map?)?.cast<String, dynamic>() ?? const {};
    final commission = (s['commission'] as Map?)?.cast<String, dynamic>();
    final options = (json['payment'] as Map?)?.cast<String, dynamic>();
    final bank = (options?['bank'] as Map?)?.cast<String, dynamic>();

    return CheckoutInfo(
      due:
          (s['net'] as num?)?.toInt() ??
          (order['amount'] as num?)?.toInt() ??
          0,
      price: (s['price'] as num?)?.toInt() ?? 0,
      depositApplied: (s['depositApplied'] as num?)?.toInt() ?? 0,
      commission: (commission?['total'] as num?)?.toInt() ?? 0,
      availableHalalas: (json['availableBalance'] as num?)?.toInt() ?? 0,
      plateLabel: json['plateLabel'] as String? ?? '',
      sellerName: json['sellerName'] as String? ?? '',
      methods: ((json['methods'] as List?) ?? const [])
          .whereType<Map>()
          .map((raw) {
            final m = raw.cast<String, dynamic>();
            final method = payMethodOf(m['method'] as String?);
            if (method == null) return null;
            return PayOption(
              method: method,
              label: m['label'] as String? ?? '',
              available: m['available'] == true,
              hint: m['hint'] as String? ?? '',
            );
          })
          .whereType<PayOption>()
          .toList(),
      bank: bank == null
          ? null
          : BankDetails(
              name: bank['name'] as String? ?? '',
              accountName: bank['accountName'] as String? ?? '',
              iban: bank['iban'] as String? ?? '',
              accountNumber: bank['accountNumber'] as String? ?? '',
              instructions: bank['instructions'] as String? ?? '',
            ),
    );
  }

  /// **سدادُ صفقة** — `POST api/checkout/{id}`.
  ///
  /// والمحفظةُ وحدها تُسوّي فورًا (`settled`)؛ والبطاقةُ تعود برابطٍ يُفتح
  /// خارج التطبيق، والحوالةُ بعمليةٍ معلّقةٍ تنتظر توثيقَ الإدارة.
  Future<PayResult> payOrder(String orderId, PayMethod method) async {
    final json = await _client.post(
      '/api/checkout/$orderId',
      body: {'method': payMethodWire(method)},
    );

    return PayResult(
      reference: json['paymentReference'] as String? ?? '',
      settled: json['settled'] == true,
      redirectUrl: json['redirectUrl'] as String?,
    );
  }

  /// **خياراتُ الدفع المفعَّلة** — `GET api/payments`.
  ///
  /// **ولا تُفترض الطرائقُ في الجهاز**: الإدارةُ تُطفئ البطاقةَ أو الحوالةَ
  /// من لوحتها، فزرٌّ يُرسم لطريقةٍ مطفأةٍ يُرَدّ طلبُه بـ‎٤٠٩‎ بعد أن يختار
  /// المستخدمُ مبلغَه.
  Future<PaymentOptions> paymentOptions() async {
    final json = await _client.get('/api/payments');
    final o = (json['options'] as Map?)?.cast<String, dynamic>() ?? const {};
    final bank = (o['bank'] as Map?)?.cast<String, dynamic>();

    return PaymentOptions(
      cardEnabled: o['tapEnabled'] == true,
      bankEnabled: o['bankTransferEnabled'] == true,
      bank: bank == null
          ? null
          : BankDetails(
              name: bank['name'] as String? ?? '',
              accountName: bank['accountName'] as String? ?? '',
              iban: bank['iban'] as String? ?? '',
              accountNumber: bank['accountNumber'] as String? ?? '',
              instructions: bank['instructions'] as String? ?? '',
            ),
    );
  }

  /// **بدءُ شحن** — `POST api/payments`.
  ///
  /// **والمبلغُ بالريال** كما يقرؤه المخطَّط (`riyalsToHalalas` في الخادم) —
  /// وإرسالُ الهللات يشحن مئةَ ضعفٍ. وهو الفخُّ نفسُه في إنشاء الإعلان.
  ///
  /// ويعود `redirectUrl` للبطاقة — صفحةُ البوّابة تُفتح خارج التطبيق؛
  /// و`null` للحوالة، فبياناتُ الحساب تُعرض وينتظر توثيقَ الإدارة.
  Future<TopUpStarted> startTopUp({
    required int amountRiyals,
    required bool byCard,
  }) async {
    final json = await _client.post(
      '/api/payments',
      body: {
        'amount': amountRiyals,
        'method': byCard ? 'tap' : 'bank_transfer',
      },
    );
    final payment =
        (json['payment'] as Map?)?.cast<String, dynamic>() ?? const {};

    return TopUpStarted(
      reference: payment['reference'] as String? ?? '',
      redirectUrl: json['redirectUrl'] as String?,
    );
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

  /// **البائعُ يردّ على سوم** — `POST api/offers/{id}`.
  ///
  /// والقبولُ يُنشئ صفقةً، فيعود معرّفُها ليُفتح مسارُها في الحال.
  Future<String?> respondToOffer(String offerId, {required bool accept}) async {
    final json = await _client.post(
      '/api/offers/$offerId',
      body: {'decision': accept ? 'accept' : 'decline'},
    );
    return json['orderId'] as String?;
  }

  /// **ما تحتاجه شاشةُ الإعدادات** — الملفُّ وعوائقُ الحذف معًا.
  ///
  /// **والعوائقُ تُقرأ مع الشاشة لا عند الضغط**: §٥٫١٠ تقول إنّ من عليه
  /// معلّقٌ يرى «لا يمكن حذف حسابك الآن» بقائمتها. وكانت تُمرَّر فارغةً
  /// دائمًا، فتَعِد الورقةُ بحذفٍ يردّه الخادمُ بـ٤٠٩.
  ///
  /// وسقوطُ العوائق لا يُسقط الشاشة: الملفُّ هو محتواها.
  Future<SettingsBundle> settings() async {
    final me = await profile();
    final blockers = await deletionBlockers().catchError(
      (_) => const <DeletionBlocker>[],
    );
    return SettingsBundle(profile: me, blockers: blockers);
  }

  /// **ما يمنع حذفَ الحساب** — `GET api/account/delete`.
  ///
  /// تُقرأ قبل أن تُعرض ورقةُ الحذف: من عليه صفقةٌ قائمةٌ أو مالٌ محجوزٌ
  /// يُقال له بأيِّها يبدأ، لا يُترك يضغط ثمّ يُردّ.
  Future<List<DeletionBlocker>> deletionBlockers() async {
    final json = await _client.get('/api/account/delete');
    return ((json['blockers'] as List?) ?? const []).whereType<Map>().map((
      raw,
    ) {
      final b = raw.cast<String, dynamic>();
      return DeletionBlocker(
        _blockerLabel(b['kind'] as String?),
        b['detail'] as String? ?? '',
      );
    }).toList();
  }

  /// **وعنوانُ العائق من نوعه** — والتفصيلُ يأتي من الخادم بأرقامه.
  static String _blockerLabel(String? kind) => switch (kind) {
    'open_orders' => 'صفقات لم تكتمل',
    'live_listings' => 'إعلانات قائمة',
    'held_funds' => 'مبلغ محجوز',
    'wallet_balance' => 'رصيد في محفظتك',
    'live_bids' => 'مزايدات قائمة',
    _ => 'معلّق',
  };

  /// **حذفُ الحساب بطلب صاحبه** — `POST api/account/delete`.
  ///
  /// وهو تعطيلٌ ثلاثين يومًا ثمّ حذف، لا محوٌ في الحال: محوُ صفِّه محوٌ
  /// لتاريخٍ ماليٍّ تقابله صفقاتٌ وفواتير. والجلسةُ تُمحى في الخادم فورًا.
  Future<void> deleteAccount() => _client.post('/api/account/delete');

  /// خروج — `POST api/auth/logout`.
  Future<void> logout() async {
    await _client.post('/api/auth/logout');
    await _client.clearSession();
  }
}

/// ما تحتاجه الشاشةُ الرئيسيّة — سوقٌ وترويسة.
class HomeBundle {
  const HomeBundle({
    required this.market,
    this.availableHalalas = 0,
    this.pendingCount = 0,
    this.pendingFirst,
    this.hasUnread = false,
  });

  final MarketSnapshot market;
  final int availableHalalas;
  final int pendingCount;
  final String? pendingFirst;
  final bool hasUnread;
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

/// الملفُّ وعوائقُ الحذف — ما تفتح به شاشةُ الإعدادات.
class SettingsBundle {
  const SettingsBundle({required this.profile, required this.blockers});

  final ProfileView profile;
  final List<DeletionBlocker> blockers;
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

/// **مزادٌ تجاوزك فيه أحد** — بندٌ في «بانتظارك».
PendingItem _outbidItem(Listing l) => PendingItem(
  id: l.id,
  kind: PendingKind.outbid,
  role: ActorRole.buyer,
  letters: l.letters,
  number: l.number,
  plateKind: l.kind,
  format: l.format,
  emblem: l.emblem,
  saleLabel: 'مزاد',
  kicker: 'مزاد ${l.reference}',
  title: 'تجاوزك أحدٌ في المزاد',
  sub: 'أعلى مزايدة الآن ${_riyals(l.price)} ر.س',
  cta: 'زايد من جديد',
);

String _riyals(int halalas) => (halalas ~/ 100).toString().replaceAllMapped(
  RegExp(r'(\d)(?=(\d{3})+$)'),
  (m) => '${m[1]},',
);

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
