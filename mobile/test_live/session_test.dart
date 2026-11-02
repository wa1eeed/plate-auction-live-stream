import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mazad/api/api_client.dart';
import 'package:mazad/api/mazad_api.dart';

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
  final email = Platform.environment['MAZAD_EMAIL'];
  final password = Platform.environment['MAZAD_PASSWORD'];
  final mayWrite = Platform.environment['MAZAD_WRITE'] == '1';

  late MazadApi api;

  setUpAll(() async {
    api = MazadApi(await ApiClient.create());
    if (email == null || password == null) return;
    await api.login(email: email, password: password);
  });

  tearDownAll(() async {
    if (email == null || password == null) return;
    /* ولا تبقى جلسةٌ في مِرطبان الجهاز بعد الفحص */
    await api.logout();
  });

  /// يُعلَّق بوضوحٍ بدل أن يسقط بغموض.
  bool ready() {
    if (email == null || password == null) {
      markTestSkipped('اضبط MAZAD_EMAIL و MAZAD_PASSWORD لتُجرى');
      return false;
    }
    return true;
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
