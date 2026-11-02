import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mazad/design/tokens.dart';
import 'package:mazad/api/api_client.dart';
import 'package:mazad/models/chat.dart';
import 'package:mazad/models/demo_data.dart';
import 'package:mazad/screens/chat_screen.dart';
import 'package:mazad/screens/invoice_screen.dart';

import 'font_sheet.dart';

final _now = DateTime(2026, 11, 2, 9, 40);

Widget _wrap(Widget child, {Size size = const Size(390, 844)}) => MaterialApp(
  debugShowCheckedModeBanner: false,
  home: Directionality(
    textDirection: TextDirection.rtl,
    child: MediaQuery(
      data: MediaQueryData(size: size),
      /* و`Scaffold` لأنّ الرسائلَ الطافيةَ تحتاج من يعرضها */
      child: Scaffold(
        backgroundColor: AppColors.bg,
        body: Center(
          child: SizedBox(width: size.width, height: size.height, child: child),
        ),
      ),
    ),
  ),
);

Widget _chat({
  List<ChatMessage>? messages,
  Future<ChatMessage> Function(String)? onSend,
}) => ChatScreen(
  counterpartName: 'فهد',
  counterpartRole: 'البائع',
  orderReference: 'S26-00087',
  plateLabel: 'ق و س 1',
  messages: messages ?? demoChat(_now),
  onSend: onSend,
);

/// ما يردّه خادمٌ قَبِل الرسالة.
ChatMessage _echo(String body) => ChatMessage(
  id: 'msg_saved',
  kind: MessageKind.text,
  at: _now,
  mine: true,
  text: body,
);

Widget _invoice() =>
    InvoiceScreen(order: demoOrder(_now), invoice: demoInvoice(_now));

void main() {
  setUpAll(loadAllFonts);

  testWidgets('لوحُ المحادثة', (tester) async {
    tester.view.physicalSize = const Size(780, 1688);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(_wrap(_chat()));
    await tester.pumpAndSettle();

    await expectLater(
      find.byType(ChatScreen),
      matchesGoldenFile('goldens/chat.png'),
    );
  });

  /// **وتنبيهٌ في صدر المحادثة** — يُمرَّر معها كما في التصميم.
  testWidgets('المحادثةُ تُنبّه أنّها محفوظةٌ وتُراجَع', (tester) async {
    await tester.pumpWidget(_wrap(_chat()));
    await tester.pumpAndSettle();

    /* وهي تُفتح على آخرها — فيُصعَد إلى صدرها */
    await tester.drag(find.byType(ListView), const Offset(0, 900));
    await tester.pumpAndSettle();

    expect(find.textContaining('محفوظة للطرفين'), findsOneWidget);
    expect(find.textContaining('رموز التحقق'), findsOneWidget);
  });

  /// **وتُفتح على آخر رسالة** — لا على أوّلها.
  testWidgets('تُفتح على آخر ما وصل', (tester) async {
    await tester.pumpWidget(_wrap(_chat()));
    await tester.pumpAndSettle();

    final list = tester.widget<ListView>(find.byType(ListView));
    final pos = list.controller!.position;
    expect(
      pos.pixels,
      pos.maxScrollExtent,
      reason: 'المحادثةُ تُفتح على آخرها',
    );
  });

  /// **والزرُّ يتبدّل مع أوّل حرف** — ميكروفونٌ ثمّ إرسال.
  testWidgets('الميكروفونُ يصير إرسالًا حين يُكتب', (tester) async {
    await tester.pumpWidget(_wrap(_chat(onSend: (b) async => _echo(b))));
    await tester.pumpAndSettle();

    expect(find.bySemanticsLabel('رسالة صوتية'), findsOneWidget);
    expect(find.bySemanticsLabel('إرسال'), findsNothing);

    await tester.enterText(find.byType(TextField), 'تمّ');
    await tester.pump();

    expect(find.bySemanticsLabel('إرسال'), findsOneWidget);
    expect(find.bySemanticsLabel('رسالة صوتية'), findsNothing);

    /* وفراغٌ محضٌ لا يُرسَل */
    await tester.enterText(find.byType(TextField), '   ');
    await tester.pump();
    expect(find.bySemanticsLabel('رسالة صوتية'), findsOneWidget);
  });

  /// **وما كُتب يُرسم قبل أن يصل** ثمّ يُستبدل بما حفظه الخادم.
  testWidgets('الرسالةُ تُرسم فورًا ثمّ تُقرّ', (tester) async {
    final gate = Completer<ChatMessage>();
    var asked = '';

    await tester.pumpWidget(
      _wrap(
        _chat(
          onSend: (b) {
            asked = b;
            return gate.future;
          },
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), 'وصلتني');
    await tester.pump();
    await tester.tap(find.bySemanticsLabel('إرسال'));
    await tester.pump();

    expect(asked, 'وصلتني');
    /* الفقاعةُ مرسومةٌ والحقلُ فُرّغ قبل أن يردّ الخادم */
    expect(find.text('وصلتني'), findsOneWidget);
    expect(
      tester.widget<TextField>(find.byType(TextField)).controller!.text,
      '',
    );

    gate.complete(_echo('وصلتني'));
    await tester.pumpAndSettle();
    expect(find.text('وصلتني'), findsOneWidget);
  });

  /// **وإن سقط الإرسالُ عاد النصُّ إلى الحقل** — لا يُفقد ما كُتب.
  ///
  /// **ورسالةُ الخادم تُعرض** ولا تُرمى في الفراغ: مُستمعُ الضغط لا يُنتظر،
  /// فما يُرمى منه خطأٌ غيرُ ملتقَطٍ لا يصل صاحبَ الشاشة.
  testWidgets('سقوطُ الإرسال يردّ النصّ ويقول السبب', (tester) async {
    await tester.pumpWidget(
      _wrap(
        _chat(
          onSend: (_) async => throw const ApiError(
            'أُغلقت هذه الصفقة — لا مراسلة فيها',
            status: 409,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), 'جرّب');
    await tester.pump();
    await tester.tap(find.bySemanticsLabel('إرسال'));
    await tester.pump();
    await tester.pump();

    expect(tester.takeException(), isNull, reason: 'لا خطأَ غيرُ ملتقَط');
    expect(
      tester.widget<TextField>(find.byType(TextField)).controller!.text,
      'جرّب',
      reason: 'ما كُتب يعود إلى الحقل',
    );
    /* ولا تبقى فقاعةٌ يظنّها صاحبُها وصلت */
    expect(find.text('جرّب'), findsOneWidget);
    expect(find.text('أُغلقت هذه الصفقة — لا مراسلة فيها'), findsOneWidget);
  });

  /// **ومحادثةٌ بلا رسائل تقول ذلك** — لا فراغٌ يُقرأ عطبًا.
  testWidgets('لا رسائل بعد', (tester) async {
    await tester.pumpWidget(_wrap(_chat(messages: const [])));
    await tester.pumpAndSettle();

    expect(find.text('لا رسائل بعد'), findsOneWidget);
  });

  testWidgets('لوحُ الفاتورة', (tester) async {
    tester.view.physicalSize = const Size(780, 1688);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(_wrap(_invoice()));
    await tester.pump(const Duration(milliseconds: 200));

    await expectLater(
      find.byType(InvoiceScreen),
      matchesGoldenFile('goldens/invoice.png'),
    );
  });

  /// **وقيمةُ اللوحة لا تدخل الفاتورة** — المنصّةُ تفوتر عمولتَها وحدها.
  testWidgets('الفاتورةُ على العمولة لا على اللوحة', (tester) async {
    await tester.pumpWidget(_wrap(_invoice()));
    await tester.pump(const Duration(milliseconds: 200));

    /*
     * العمولةُ ‎٨٢٠‎ وضريبتُها ‎١٢٣‎ بندان، والإجمالُ ‎٩٤٣‎ وحده بالعملة.
     * وقيمةُ اللوحة تُذكَر في الحاشية لتُنفى — لا بندًا يُحتسب.
     */
    expect(find.text('820'), findsOneWidget);
    expect(find.text('123'), findsOneWidget);
    expect(find.text('943 ر.س'), findsOneWidget);
    expect(find.text('41,000'), findsNothing);
    expect(find.textContaining('لا تدخل الفاتورة'), findsOneWidget);

    /* والأرقامُ من الخادم لا من الجهاز: رقمُ الفاتورة متسلسلٌ لا مشتقّ */
    expect(find.text('T26-00087'), findsOneWidget);
    expect(find.text('300000000000003'), findsOneWidget);
  });

  testWidgets('لا تفيض الشاشتان على عرض 360', (tester) async {
    tester.view.physicalSize = const Size(720, 1600);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);

    for (final w in [_chat(), _invoice()]) {
      await tester.pumpWidget(_wrap(w, size: const Size(360, 800)));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    }
  });
}
