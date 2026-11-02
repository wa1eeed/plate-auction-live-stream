import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mazad/design/tokens.dart';
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
      child: Material(
        color: AppColors.bg,
        child: Center(
          child: SizedBox(width: size.width, height: size.height, child: child),
        ),
      ),
    ),
  ),
);

Widget _chat() => ChatScreen(
  counterpartName: 'فهد',
  counterpartRole: 'البائع',
  orderReference: 'S26-00087',
  plateLabel: 'ق و س 1',
  messages: demoChat(_now),
);

Widget _invoice() => InvoiceScreen(order: demoOrder(_now), commission: 82000);

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

  /// **وتنبيهٌ ثابتٌ أعلى المحادثة** — فالاتّفاقُ خارجها لا تحميه المنصّة.
  testWidgets('المحادثةُ تُنبّه أنّها محفوظةٌ وتُراجَع', (tester) async {
    await tester.pumpWidget(_wrap(_chat()));
    await tester.pumpAndSettle();

    expect(find.textContaining('محفوظة للطرفين'), findsOneWidget);
    expect(find.textContaining('خارج المنصّة'), findsOneWidget);
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

    /* العمولةُ ‎٨٢٠‎ وضريبتُها ‎١٢٣‎ والإجمالُ ‎٩٤٣‎ — لا ‎٤١,٠٠٠‎ */
    expect(find.text('820 ر.س'), findsOneWidget);
    expect(find.text('123 ر.س'), findsOneWidget);
    expect(find.text('943 ر.س'), findsOneWidget);
    expect(find.text('41,000 ر.س'), findsNothing);
    expect(find.textContaining('لا تدخل الفاتورة'), findsOneWidget);
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
