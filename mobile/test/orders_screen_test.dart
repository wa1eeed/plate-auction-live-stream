import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mazad/design/tokens.dart';
import 'package:mazad/models/order.dart';
import 'package:mazad/screens/orders_screen.dart';
import 'package:mazad/widgets/plate.dart';

import 'font_sheet.dart';

final _now = DateTime(2026, 10, 30, 1, 2);

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

OrderView _order({
  required String reference,
  required OrderStage stage,
  required bool buyer,
  int price = 4100000,
  int? net,
}) => OrderView(
  id: 'ord_$reference',
  reference: reference,
  stage: stage,
  source: 'مزاد',
  letters: 'ق و س',
  number: '1',
  plateKind: PlateKind.private,
  format: PlateFormat.long,
  emblem: PlateEmblem.palm,
  price: price,
  net: net,
  buyerName: buyer ? 'أنت' : 'سلطان ع*****',
  sellerName: buyer ? 'فهد ع*****' : 'أنت',
  youAreBuyer: buyer,
  createdAt: _now,
  paidAt: _now,
);

final _purchases = [
  _order(reference: 'S26-00087', stage: OrderStage.id, buyer: true),
  _order(
    reference: 'S26-00052',
    stage: OrderStage.done,
    buyer: true,
    price: 5800000,
    net: 5933400,
  ),
];

final _sales = [
  _order(
    reference: 'S26-00041',
    stage: OrderStage.done,
    buyer: false,
    price: 3000000,
    net: 2769000,
  ),
];

OrdersScreen _screen({
  bool sales = false,
  ValueChanged<OrderView>? onOpen,
  List<OrderView>? purchases,
}) => OrdersScreen(
  purchases: purchases ?? _purchases,
  sales: _sales,
  startOnSales: sales,
  onOpen: onOpen,
);

void main() {
  setUpAll(loadAllFonts);

  testWidgets('لوحُ صفقاتي', (tester) async {
    tester.view.physicalSize = const Size(780, 1688);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(_wrap(_screen()));
    await tester.runAsync(() async {
      for (final e in find.byType(Image).evaluate()) {
        await precacheImage((e.widget as Image).image, e);
      }
    });
    await tester.pump(const Duration(milliseconds: 200));

    await expectLater(
      find.byType(OrdersScreen),
      matchesGoldenFile('goldens/orders.png'),
    );
  });

  /// **والمجموعُ من المكتملة وحدها** — فصفقةٌ لم تُسدَّد لم يُدفع فيها شيء.
  testWidgets('المجموعُ يحسب المكتملةَ ويتبدّل بالتاب', (tester) async {
    await tester.pumpWidget(_wrap(_screen()));
    await tester.pump(const Duration(milliseconds: 200));

    /* ‎٥٩٬٣٣٤‎ من المكتملة وحدها — و‎٤١٬٠٠٠‎ المعلّقةُ لا تُحسب */
    expect(
      find.text('مجموع ما دفعته في صفقات مكتملة 59,334 ر.س'),
      findsOneWidget,
    );

    await tester.tap(find.text('مبيعاتي'));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('مجموع عائدك المكتمل 27,690 ر.س'), findsOneWidget);
  });

  /// **و«المدفوع» غيرُ الثمن** — العربونُ خُصم والعمولةُ أُضيفت.
  testWidgets('الكرتُ يفرّق بين الثمن وما دُفع', (tester) async {
    await tester.pumpWidget(_wrap(_screen()));
    await tester.pump(const Duration(milliseconds: 200));

    expect(find.text('58,000'), findsOneWidget);
    expect(find.text('المدفوع 59,334 ر.س'), findsOneWidget);

    await tester.tap(find.text('مبيعاتي'));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('عائدك 27,690 ر.س'), findsOneWidget);
  });

  /// **والوسمُ قصيرٌ لا نداءٌ كامل** — `stageChip` لا `stageName`.
  testWidgets('وسمُ الحال لا يفيض على عرض الكرت', (tester) async {
    await tester.pumpWidget(
      _wrap(
        _screen(
          purchases: [
            _order(
              reference: 'S26-00090',
              stage: OrderStage.transfer,
              buyer: true,
            ),
          ],
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 200));

    expect(find.text('بانتظار نقل البائع'), findsOneWidget);
    expect(find.text('الدور على البائع: نقل الملكية في أبشر'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('الكرتُ يفتح مسارَ الصفقة', (tester) async {
    OrderView? opened;
    await tester.pumpWidget(_wrap(_screen(onOpen: (o) => opened = o)));
    await tester.pump(const Duration(milliseconds: 200));

    await tester.tap(find.text('S26-00087 · 30/10/2026 · 01:02:00 ص'));
    await tester.pump();
    expect(opened?.reference, 'S26-00087');
  });

  testWidgets('يُفتح على مبيعاتي لمن جاء من صفّها', (tester) async {
    await tester.pumpWidget(_wrap(_screen(sales: true)));
    await tester.pump(const Duration(milliseconds: 200));

    expect(find.text('S26-00041 · 30/10/2026 · 01:02:00 ص'), findsOneWidget);
  });

  testWidgets('لا تفيض صفقاتي على عرض 360', (tester) async {
    tester.view.physicalSize = const Size(720, 1600);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(_wrap(_screen(), size: const Size(360, 800)));
    await tester.pump(const Duration(milliseconds: 200));
    expect(tester.takeException(), isNull);
  });
}
