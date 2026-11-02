import '../models/listing.dart';
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
  Future<Map<String, dynamic>> listing(String id) =>
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

  /// المحفظة — `GET api/account/wallet`.
  Future<Map<String, dynamic>> wallet() => _client.get('/api/account/wallet');

  /// الملفُّ الشخصيّ — `GET api/account/profile`.
  Future<Map<String, dynamic>> profile() => _client.get('/api/account/profile');

  /// الإشعارات — `GET api/notifications`.
  Future<Map<String, dynamic>> notifications() =>
      _client.get('/api/notifications');

  /// تعليمُ الإشعارات مقروءةً — `PATCH api/notifications`.
  Future<void> readNotifications() => _client.patch('/api/notifications');

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
