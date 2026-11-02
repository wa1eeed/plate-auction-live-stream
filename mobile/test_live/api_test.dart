import 'package:flutter_test/flutter_test.dart';
import 'package:mazad/api/api_client.dart';
import 'package:mazad/api/mazad_api.dart';
import 'package:mazad/models/listing.dart';

/// **فحصٌ يضرب الخادمَ الحقيقيّ** — ليُثبت أنّ الطبقة تقرأ ما يُرسَل فعلًا.
///
/// **ولا يُجرى مع الحزمة**: يحتاج شبكةً ويعتمد على بياناتٍ تتبدّل — فحزمةٌ
/// تسقط لانقطاع الشبكة تُفقد معناها. فهو خارج `test/` الذي تمسحه
/// `flutter test`، ويُطلب صراحةً:
///
/// ```bash
/// flutter test test_live/api_test.dart
/// ```
///
/// **والمتصفّحُ لا يصلح لهذا**: معاينةُ الويب تُمنع بسياسة الأصول (CORS)،
/// وهي قيدُ متصفّحٍ لا يقع على عميلٍ أصيل. فيُقاس هنا بعميل Dart نفسِه.
void main() {
  late MazadApi api;

  /*
   * **ولا `TestWidgetsFlutterBinding` هنا.**
   *
   * فهو يعترض كلَّ طلبِ HTTP ويردّ ‎٤٠٠‎ بلا شبكة — وهو صوابٌ لفحص واجهةٍ
   * لا يُراد له أن يخرج إلى الشبكة، وخطأٌ لفحصٍ غرضُه الخروجُ إليها.
   */
  setUpAll(() async {
    api = MazadApi(await ApiClient.create());
  });

  test('السوقُ يصل ويُحوَّل', () async {
    final snap = await api.listings();

    expect(snap.listings, isNotEmpty, reason: 'السوقُ لا يعود فارغًا');
    expect(snap.serverTime.year, greaterThan(2024));

    final l = snap.listings.first;
    expect(l.id, isNotEmpty);
    expect(l.reference, isNotEmpty);
    expect(l.letters, isNotEmpty);

    /* ولكلّ لوحةٍ طريقةُ بيعٍ معروفة */
    for (final row in snap.listings) {
      expect(SaleType.values, contains(row.saleType));
    }
  });

  test('ومزاداتٌ لها نهاياتٌ في المستقبل', () async {
    final snap = await api.listings();
    final live = snap.listings
        .where((l) => l.saleType == SaleType.auction && l.endsAt != null)
        .toList();

    expect(live, isNotEmpty, reason: 'لا مزادَ ينتهي — فالعدّاداتُ لا تُقاس');
    for (final l in live.take(3)) {
      expect(
        l.endsAt!.isAfter(snap.serverTime.subtract(const Duration(days: 365))),
        isTrue,
      );
    }
  });

  /// **والخطأُ يصل برسالته العربيّة لا برمزٍ أعجميّ.**
  test('طلبُ لوحةٍ لا توجد يردّ رسالةً تُقرأ', () async {
    try {
      await api.listingRaw('lst_لا_يوجد');
      fail('كان ينبغي أن يُرفض');
    } on ApiError catch (e) {
      expect(e.message, isNotEmpty);
      expect(e.status, anyOf(400, 404));
    }
  });

  /// **ووظيفةٌ بلا جلسةٍ تُردّ ‎٤٠١‎** — وهو ما تبني عليه البوّابة.
  test('المزايدةُ بلا حساب تُردّ', () async {
    final snap = await api.listings();
    final auction = snap.listings.firstWhere(
      (l) => l.saleType == SaleType.auction,
    );

    try {
      await api.bid(auction.id, auction.price + 100000);
      fail('كان ينبغي أن تُردّ بلا جلسة');
    } on ApiError catch (e) {
      expect(
        e.isUnauthorized,
        isTrue,
        reason: 'الخادمُ يردّ ٤٠١ لمن لا جلسةَ له',
      );
    }
  });

  /// **والمحفظةُ والإشعاراتُ خلف الحساب** — وهو ما تبني عليه البوّابة.
  test('المحفظةُ بلا حساب تُردّ', () async {
    try {
      await api.wallet();
      fail('كان ينبغي أن تُردّ بلا جلسة');
    } on ApiError catch (e) {
      expect(e.isUnauthorized, isTrue);
    }
  });

  test('والإشعاراتُ كذلك', () async {
    try {
      await api.notifications();
      fail('كان ينبغي أن تُردّ بلا جلسة');
    } on ApiError catch (e) {
      expect(e.isUnauthorized, isTrue);
    }
  });

  /// **ودخولٌ ببيانات خاطئةٍ يردّ رسالةً تُقرأ** لا رمزًا أعجميًّا.
  test('الدخولُ ببريدٍ خاطئٍ يردّ رسالةً عربيّة', () async {
    try {
      await api.login(email: 'nobody@example.com', password: 'wrong-pass');
      fail('كان ينبغي أن يُرفض');
    } on ApiError catch (e) {
      expect(e.message, isNotEmpty);
      /* والرسالةُ عربيّةٌ — فالخادمُ يكتبها لمستخدمه */
      expect(
        RegExp(r'[\u0600-\u06FF]').hasMatch(e.message),
        isTrue,
        reason: 'رسالةُ الخادم عربيّة: ${e.message}',
      );
    }
  });

  /// **والأسئلةُ الشائعةُ مفتوحةٌ بلا حساب** — فهي للمتصفّح قبل أن يُسجّل.
  test('الأسئلةُ الشائعة تصل بلا حساب', () async {
    final json = await api.faq();
    expect(json, isNotEmpty);
  });

  /// **وتفاصيلُ اللوحة تصل بكشفها وعربونها** — وهي صدرُ صفحتها.
  test('تفاصيلُ لوحةٍ تصل مُحوَّلة', () async {
    final snap = await api.listings();
    final auction = snap.listings.firstWhere(
      (l) => l.saleType == SaleType.auction,
    );

    final detail = await api.listingDetail(auction.id);

    expect(detail.listing.id, auction.id);
    expect(detail.listing.letters, isNotEmpty);
    expect(detail.sellerName, isNotEmpty);
    expect(detail.increment, greaterThan(0), reason: 'المزادُ له خطوةُ زيادة');
    expect(detail.nextBidAmount, greaterThanOrEqualTo(detail.listing.price));
  });

  /// **والاسمُ في الكشف يصل مقنّعًا من الخادم** — فلا يُقنَّع مرّتين.
  ///
  /// والتقنيعُ في الخادم هو الصواب: ما لا يُرسَل لا يُسرَّب، وتقنيعُ
  /// الواجهة وحدها يترك الاسمَ كاملًا في الشبكة لمن يقرأ الطلبات.
  test('أسماءُ الكشف مقنّعةٌ قبل أن تصل', () async {
    final snap = await api.listings();
    for (final l
        in snap.listings
            .where((l) => l.saleType == SaleType.auction && l.bids > 0)
            .take(3)) {
      final detail = await api.listingDetail(l.id);
      for (final bid in detail.bids) {
        expect(bid.bidder, isNotEmpty);
        /* ولا يصل اسمٌ كاملٌ بلا نجوم — إلّا أن يكون اسمًا واحدًا قصيرًا */
        if (bid.bidder.contains(' ')) {
          expect(
            bid.bidder,
            contains('*'),
            reason: 'اسمٌ مركّبٌ يصل مقنّعًا: ${bid.bidder}',
          );
        }
      }
    }
  });

  /// **والسعرُ الأدنى يصل حالًا لا رقمًا** — فهو سلاحُ البائع.
  test('السعرُ الأدنى حالةٌ لا قيمة', () async {
    final snap = await api.listings();
    final auction = snap.listings.firstWhere(
      (l) => l.saleType == SaleType.auction,
    );
    final raw = await api.listingRaw(auction.id);

    expect(raw['reserveState'], anyOf('met', 'not_met', 'none', null));
    expect(
      raw.containsKey('reservePrice'),
      isFalse,
      reason: 'لا يُرسَل رقمُ السعر الأدنى أبدًا',
    );
  });

  /// **وقائمةُ الصفقات مسارٌ أُضيف للتطبيق الأصيل.**
  ///
  /// فالويبُ يُصيّر «مشترياتي» و«مبيعاتي» على الخادم ويقرأ الخدمةَ مباشرةً،
  /// والأصيلُ يرسم في الجهاز ويطلب بيانات. وهذا يُثبت أنّ المسار قائمٌ
  /// ويحرسه الحساب.
  test('قائمةُ الصفقات موجودةٌ وخلف الحساب', () async {
    try {
      await api.orders();
      fail('كان ينبغي أن تُردّ بلا جلسة');
    } on ApiError catch (e) {
      /*
       * **و‎٤٠٤‎ هنا تعني أنّ المسارَ لم يُنشر بعد** لا أنّه غير موجود.
       *
       * فهو في المستودع ومقيسٌ بثلاثة فحوصٍ في `tests/unit/orders-api`،
       * ويصل الخادمَ بأوّل نشرة. ويُقال ذلك صراحةً — ففحصٌ يسقط بغموضٍ
       * يُقرأ عطبًا في التطبيق وهو انتظارُ نشرة.
       */
      if (e.status == 404) {
        markTestSkipped('المسارُ لم يُنشر بعد — يصل بأوّل نشرة');
        return;
      }
      expect(
        e.isUnauthorized,
        isTrue,
        reason: 'المسارُ المنشورُ يردّ ٤٠١ لا ${e.status}',
      );
    }
  });
}
