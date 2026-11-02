import 'dart:io';

import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show MissingPluginException;
import 'package:path_provider/path_provider.dart';

/// خطأٌ من الخادم بصيغته — رسالةٌ عربيّةٌ ورمز.
class ApiError implements Exception {
  const ApiError(this.message, {this.code, this.status});

  /// **الرسالةُ كما كتبها الخادم** — فهو يكتبها بالعربيّة لمستخدمها.
  final String message;

  /// رمزٌ يُفرّق الحالاتِ عند الحاجة: `IDENTITY_MISSING` وأشباهُه.
  final String? code;

  final int? status;

  bool get isUnauthorized => status == 401;

  @override
  String toString() => message;
}

/// **عميلُ الواجهة** — فوق `api/` القائمة، بلا خادمٍ جديد.
///
/// **والجلسةُ تبقى كوكي `httpOnly` كما هي.** و`sameSite=lax` مفهومٌ
/// متصفّحيٌّ لا يُقيّد عميلًا أصيلًا يملك مِرطبانَ كوكيّاته — فلا يلزم رمزٌ
/// يُحفظ في الجهاز، ولا سطحُ أمانٍ جديد. وهي ميزةٌ ثمينة: ما بُني في
/// الخادم للجلسات يعمل كما هو.
class ApiClient {
  ApiClient._(this._dio, this._jar);

  final Dio _dio;
  final CookieJar _jar;

  /// نطاقُ المنصّة — يُبدَّل عند البناء لبيئةٍ أخرى.
  static const baseUrl = String.fromEnvironment(
    'MAZAD_API',
    defaultValue: 'https://mazad.payone.one',
  );

  static Future<ApiClient> create() async {
    final dio = Dio(
      BaseOptions(
        baseUrl: baseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 20),
        /* ويُقبل كلُّ رمزٍ ليُقرأ جسمُ الخطأ بدل أن يُرمى بلا رسالة */
        validateStatus: (_) => true,
        headers: {'accept': 'application/json'},
      ),
    );

    /*
     * **والكوكي تُحفظ على القرص** — فالجلسةُ تبقى بعد إغلاق التطبيق.
     *
     * ومرطبانٌ في الذاكرة وحده يُخرج المستخدمَ كلّما أُغلق التطبيق، وهو
     * ما لا يحتمله من يتابع مزادًا.
     */
    final jar = await _openJar();
    /* وفي الويب يتولّى المتصفّحُ الكوكي بنفسه، فلا يُركَّب المدير */
    if (!kIsWeb) dio.interceptors.add(CookieManager(jar));

    return ApiClient._(dio, jar);
  }

  /// **ومِرطبانُ الكوكي على القرص — أو في الذاكرة إن تعذّر.**
  ///
  /// فـ`path_provider` إضافةٌ أصيلةٌ لا تعمل في فحصٍ على الحاسوب، ورميُها
  /// يُسقط كلَّ شيءٍ قبل أن يبدأ. والسقوطُ إلى الذاكرة يُبقي الطبقةَ قابلةً
  /// للقياس، ويُفقد البقاءَ بعد الإغلاق وحده — وهو ما لا يعني الفحص.
  static Future<CookieJar> _openJar() async {
    if (kIsWeb) return CookieJar();
    try {
      final dir = await getApplicationSupportDirectory();
      return PersistCookieJar(
        storage: FileStorage('${dir.path}/cookies'),
        ignoreExpires: false,
      );
    } on MissingPluginException {
      return CookieJar();
    } catch (_) {
      return CookieJar();
    }
  }

  /// هل في المِرطبان كوكي جلسةٍ سارية؟
  Future<bool> hasSession() async {
    if (kIsWeb) return false;
    final cookies = await _jar.loadForRequest(Uri.parse(baseUrl));
    return cookies.any((c) => c.name == 'session' || c.name == 'sid');
  }

  Future<void> clearSession() => _jar.deleteAll();

  Future<Map<String, dynamic>> get(
    String path, {
    Map<String, dynamic>? query,
  }) async =>
      _unwrap(await _send(() => _dio.get(path, queryParameters: query)));

  Future<Map<String, dynamic>> post(String path, {Object? body}) async =>
      _unwrap(await _send(() => _dio.post(path, data: body)));

  Future<Map<String, dynamic>> patch(String path, {Object? body}) async =>
      _unwrap(await _send(() => _dio.patch(path, data: body)));

  /// يحوّل أعطابَ الشبكة إلى [ApiError] برسالةٍ تُقرأ.
  Future<Response<dynamic>> _send(
    Future<Response<dynamic>> Function() run,
  ) async {
    try {
      return await run();
    } on DioException catch (e) {
      /*
       * **ورسالةُ انقطاع الشبكة تُقال بالعربيّة.**
       *
       * فرسالةُ المكتبة إنجليزيّةٌ تقنيّة، ومن انقطعت شبكتُه وهو يزايد
       * يحتاج أن يعرف أنّ العطبَ في اتّصاله لا في مزايدته.
       */
      final message = switch (e.type) {
        DioExceptionType.connectionTimeout ||
        DioExceptionType.sendTimeout ||
        DioExceptionType.receiveTimeout =>
          'تأخّر الاتصال — تحقّق من شبكتك وأعد المحاولة',
        DioExceptionType.connectionError => 'لا اتصال بالإنترنت',
        _ when e.error is SocketException => 'لا اتصال بالإنترنت',
        _ => 'تعذّر الاتصال بالخادم',
      };
      throw ApiError(message);
    }
  }

  /// يقرأ الجسمَ، ويرمي [ApiError] لما ليس ‎٢xx‎.
  Map<String, dynamic> _unwrap(Response<dynamic> res) {
    final body = res.data;
    final map = body is Map<String, dynamic> ? body : <String, dynamic>{};

    if (res.statusCode != null &&
        res.statusCode! >= 200 &&
        res.statusCode! < 300) {
      return map;
    }

    /* والخادمُ يردّ `{error:{message, code}}` — فتُقرأ رسالتُه لا رمزُه */
    final error = map['error'];
    final message = error is Map
        ? (error['message'] as String? ?? 'تعذّر إتمام الطلب')
        : 'تعذّر إتمام الطلب';
    final code = error is Map ? error['code'] as String? : null;

    throw ApiError(message, code: code, status: res.statusCode);
  }
}
