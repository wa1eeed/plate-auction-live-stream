import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mazad/api/api_client.dart';
import 'package:mazad/api/mazad_api.dart';
import 'package:mazad/models/order.dart';

/// **فحصٌ بجلسةٍ حقيقيّة على الخادم الحقيقيّ.**
///
/// وهو ما لا يبلغه `api_test.dart`: ذاك يُثبت أنّ المسارات قائمةٌ ويحرسها
/// الحساب (‎٤٠١‎)، وهذا يُثبت أنّها **تعمل** — تُرجع صفقاتٍ ومحادثةً وفاتورة.
///
/// **وكلمةُ المرور لا تُكتب هنا ولا تُمرَّر في محادثة.** تُقرأ من بيئة من
/// يُشغّله، فلا تدخل المستودعَ ولا سجلَّ أمرٍ مشترك:
///
/// ```bash
/// MAZAD_EMAIL='you@example.com' MAZAD_PASSWORD='…' \
///   flutter test test_live/session_test.dart
/// ```
///
/// **ولا يُرسل شيئًا افتراضًا.** الإرسالُ يكتب في محادثةِ صفقةٍ قائمةٍ
/// ويراه الطرفُ الآخر — فهو خلف `MAZAD_WRITE=1` صراحةً.
void main() {
  /*
   * **حسابُ الديمو افتراضًا** — فيُشغَّل الفحصُ بأمرٍ واحدٍ بلا إعداد.
   *
   * وهذه ليست سرًّا يُفشى: هي مكتوبةٌ في `src/lib/config.ts` بذرةً للمنصّة،
   * والمستودعُ عامّ. فكتابتُها هنا لا تكشف شيئًا لم يُكشف.
   *
   * **ولا يُوضع هنا حسابٌ حقيقيّ أبدًا.** من أراد قياسَ حسابه فليُمرّره
   * في البيئة — لا يُحرّر هذا الملفّ:
   *
   * ```bash
   * MAZAD_EMAIL='…' MAZAD_PASSWORD='…' flutter test test_live/session_test.dart
   * ```
   */
  const demoEmail = 'sara@demo.sa';
  const demoPassword = 'demo1234';

  final email = Platform.environment['MAZAD_EMAIL'] ?? demoEmail;
  final password = Platform.environment['MAZAD_PASSWORD'] ?? demoPassword;
  final mayWrite = Platform.environment['MAZAD_WRITE'] == '1';

  late MazadApi api;

  /* وسببُ سقوط الدخول يُحفظ ليُقال في كلّ فحصٍ بدل خطأٍ غامض */
  Object? loginFailure;

  setUpAll(() async {
    api = MazadApi(await ApiClient.create());
    try {
      await api.login(email: email, password: password);
    } catch (error) {
      loginFailure = error;
    }
  });

  tearDownAll(() async {
    if (loginFailure != null) return;
    /* ولا تبقى جلسةٌ في مِرطبان الجهاز بعد الفحص */
    await api.logout();
  });

  /// **ودخولٌ ساقطٌ يُقال سببُه** لا يُترك فحوصًا تسقط واحدًا واحدًا.
  bool ready() {
    final failure = loginFailure;
    if (failure == null) return true;

    if (failure is ApiError && failure.status == 401) {
      markTestSkipped(
        'لم يُقبل الدخول بـ$email — '
        'فحساباتُ البذرة غيرُ مستوردةٍ على هذا الخادم، وهو الأسلم. '
        'مرّر حسابًا قائمًا في MAZAD_EMAIL و MAZAD_PASSWORD.',
      );
      return false;
    }
    fail('سقط الدخول: $failure');
  }

  test('الدخولُ يصل، وصفقاتي تُقرأ', () async {
    if (!ready()) return;

    final orders = await api.orders();
    /* قد تكون فارغةً — والمقيسُ أنّ المسار يعمل لا أنّ فيه بيانات */
    expect(orders.purchases, isA<List>());
    expect(orders.sales, isA<List>());

    for (final o in [...orders.purchases, ...orders.sales].take(3)) {
      expect(o.id, isNotEmpty, reason: 'المعرّفُ يصل — وبه تُنادى المسارات');
      expect(o.reference, isNotEmpty);
      /* والمعرّفُ غيرُ الرقم: `ord_…` لا `S26-…` */
      expect(o.id, isNot(o.reference));
    }
  });

  test('ومحادثةُ صفقةٍ تُقرأ بمعرّفها', () async {
    if (!ready()) return;

    final orders = await api.orders();
    final all = [...orders.purchases, ...orders.sales];
    if (all.isEmpty) {
      markTestSkipped('لا صفقةَ على هذا الحساب — لا محادثةَ تُقرأ');
      return;
    }

    final thread = await api.chat(all.first.id);
    expect(thread.me, isNotEmpty, reason: 'الخادمُ يقول أيُّ الرسائل لي');
    for (final m in thread.messages) {
      expect(m.id, isNotEmpty);
      expect(m.at.year, greaterThan(2024));
    }
  });

  test('وفاتورتُها كذلك', () async {
    if (!ready()) return;

    final orders = await api.orders();
    final all = [...orders.purchases, ...orders.sales];
    if (all.isEmpty) {
      markTestSkipped('لا صفقةَ على هذا الحساب');
      return;
    }

    final invoices = await api.invoices(all.first.id);
    /* وفاتورةٌ لم تُصدَر بعد قائمةٌ فارغة — لا خطأ */
    for (final inv in invoices) {
      expect(inv.reference, isNotEmpty);
      expect(inv.totalAmount, inv.netAmount + inv.vatAmount);
      expect(inv.qr, isNotEmpty, reason: 'رمزُ ZATCA يصل مع الفاتورة');
    }
  });

  /// **مِجسُّ «حسابي»** — أيُّ النداءات الثلاثة يسقط.
  ///
  /// فالشاشةُ تجمع الملفَّ والمحفظةَ والسوقَ في `Future.wait`، وهي تسقط
  /// بأوّل إخفاق فلا يُعرف أيُّها. وقد ظهرت للمستخدم «تعذّر إتمام الطلب»،
  /// وهي رسالةٌ احتياطيّةٌ تعني أنّ الردَّ لم يكن JSON أصلًا.
  test('حسابي: أيُّ نداءٍ يسقط', () async {
    if (!ready()) return;

    for (final (name, call) in <(String, Future<void> Function())>[
      ('الملفّ', () => api.profile()),
      ('المحفظة', () => api.wallet()),
      ('السوق', () => api.listings()),
      ('الحزمة كاملةً', () => api.account()),
    ]) {
      try {
        await call();
        // ignore: avoid_print
        print('  ✓ $name');
      } catch (e) {
        // ignore: avoid_print
        print('  ✗ $name — $e');
      }
    }
  });

  /// **والصفقةُ تُقرأ وحدَها وتُقرأ صفحةُ سدادها.**
  ///
  /// فمساراها (`GET api/orders/{id}` و`GET api/checkout/{id}`) لم يكونا
  /// موجودين: الويبُ يقرؤهما في الخادم قبل التصيير، والتطبيقُ يسألهما
  /// بالشبكة — فكان يأتيه ‎٤٠٥‎.
  test('صفقةٌ بمعرّفها، وصفحةُ سدادها', () async {
    if (!ready()) return;

    final mine = await api.orders();
    final one = [...mine.purchases, ...mine.sales].firstOrNull;
    if (one == null) {
      markTestSkipped('لا صفقةَ في هذا الحساب');
      return;
    }

    final fresh = await api.order(one.id);
    expect(fresh.id, one.id);
    expect(fresh.reference, isNotEmpty);
    expect(fresh.youAreBuyer, one.youAreBuyer);

    /* وصفحةُ السداد للمشتري وحده، وفي مرحلة السداد وحدها */
    final payable = mine.purchases
        .where((o) => o.stage == OrderStage.pay)
        .firstOrNull;
    if (payable == null) {
      markTestSkipped('لا صفقةَ بانتظار السداد');
      return;
    }

    final view = await api.checkout(payable.id);
    expect(view.due, greaterThan(0));
    expect(view.methods, isNotEmpty);
    expect(view.plateLabel, isNotEmpty);
  });

  /// **ولا تُقرأ صفقةُ غيرك** — وهو ما يحرسه المسار.
  test('ومعرّفٌ ليس لك يُردّ', () async {
    if (!ready()) return;

    try {
      await api.chat('ord_ليس_لك');
      fail('كان ينبغي أن يُردّ');
    } on ApiError catch (e) {
      expect(e.status, anyOf(403, 404));
      expect(RegExp(r'[؀-ۿ]').hasMatch(e.message), isTrue);
    }
  });

  test('والإرسالُ يصل ويُحفظ', () async {
    if (!ready()) return;
    if (!mayWrite) {
      markTestSkipped('اضبط MAZAD_WRITE=1 — الإرسالُ يكتب في صفقةٍ قائمة');
      return;
    }

    final orders = await api.orders();
    final all = [...orders.purchases, ...orders.sales];
    if (all.isEmpty) {
      markTestSkipped('لا صفقةَ على هذا الحساب');
      return;
    }

    final id = all.first.id;
    final before = (await api.chat(id)).messages.length;
    final body = 'فحصٌ آليّ — ${DateTime.now().toIso8601String()}';

    final sent = await api.sendMessage(id, body);
    expect(sent.text, body);
    expect(sent.mine, isTrue);

    final after = await api.chat(id);
    expect(after.messages.length, before + 1);
    expect(after.messages.last.text, body);
  });
}
