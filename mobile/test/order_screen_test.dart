import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mazad/design/tokens.dart';
import 'package:mazad/models/demo_data.dart';
import 'package:mazad/models/order.dart';
import 'package:mazad/screens/order_screen.dart';
import 'package:mazad/widgets/plate.dart';

import 'font_sheet.dart';

final _now = DateTime(2026, 10, 30, 4, 42);

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

OrderView _order({OrderStage stage = OrderStage.id, bool buyer = true}) =>
    OrderView(
      id: 'ord_1',
      reference: 'S26-00087',
      stage: stage,
      source: 'مزاد',
      letters: 'ق و س',
      number: '1',
      plateKind: PlateKind.private,
      format: PlateFormat.long,
      emblem: PlateEmblem.palm,
      price: 4100000,
      buyerName: 'وليد (أنت)',
      sellerName: 'فهد ع*****',
      youAreBuyer: buyer,
      createdAt: _now.subtract(const Duration(hours: 3, minutes: 40)),
      paidAt: _now.subtract(const Duration(hours: 2, minutes: 28)),
    );

void main() {
  setUpAll(loadAllFonts);

  testWidgets('لوحُ الصفقة', (tester) async {
    tester.view.physicalSize = const Size(780, 1688);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(_wrap(OrderScreen(order: demoOrder(_now))));
    await tester.runAsync(() async {
      for (final e in find.byType(Image).evaluate()) {
        await precacheImage((e.widget as Image).image, e);
      }
    });
    await tester.pump(const Duration(milliseconds: 200));

    await expectLater(
      find.byType(OrderScreen),
      matchesGoldenFile('goldens/order.png'),
    );
  });

  /// **ونموذجُ البيانات للمشتري وحده** — والبائعُ يقرأ أنّه ينتظر.
  testWidgets('المشتري يملأ، والبائعُ ينتظر', (tester) async {
    await tester.pumpWidget(_wrap(OrderScreen(order: _order())));
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.text('أرسلها للبائع'), findsOneWidget);

    await tester.pumpWidget(_wrap(OrderScreen(order: _order(buyer: false))));
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.text('أرسلها للبائع'), findsNothing);
    expect(find.text('بانتظار بيانات المشتري'), findsWidgets);
  });

  /// **وبياناتُ الطرف الآخر مقفلةٌ حتى يؤكّد المشتري.**
  testWidgets('بطاقةُ الطرف الآخر مقفلةٌ بلا بيانات', (tester) async {
    await tester.pumpWidget(_wrap(OrderScreen(order: _order())));
    await tester.pump(const Duration(milliseconds: 200));
    /* والبطاقةُ آخرُ الصفحة — فتُطلب بعد التمرير إليها */
    await tester.drag(find.byType(ListView), const Offset(0, -700));
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.textContaining('تظهر بعد أن يؤكّد المشتري'), findsOneWidget);

    await tester.pumpWidget(
      _wrap(
        OrderScreen(
          order: _order(stage: OrderStage.transfer, buyer: false),
          counterpartPhone: '0551234567',
          counterpartId: '1098765432',
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 200));
    await tester.drag(find.byType(ListView), const Offset(0, -700));
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.text('0551234567'), findsOneWidget);
    /* والبائعُ وحده يرى رقمَ الهويّة — فهو ما يُدخله في أبشر */
    expect(find.text('1098765432'), findsOneWidget);
  });

  /// **ولا يُرسَل نموذجٌ ناقص** — زرٌّ باهتٌ قبل اكتمال البيانات.
  testWidgets('الزرُّ لا يُرسل حتى يصحّ الرقمُ ويُنتقى التاريخ', (
    tester,
  ) async {
    String? sentId;
    String? sentBirth;
    /*
     * **وسطحُ الفحص يتّسع للزرّ.**
     *
     * فالافتراضيُّ ‎٨٠٠×٦٠٠‎، والزرُّ في الصفقة أسفلُ من ذلك — فتسقط
     * النقرةُ خارج السطح ولا يقع شيء. وكان الفحصُ قبلُ يقرأ من ذلك أنّ
     * الزرَّ امتنع، وهو لم يُضغط أصلًا.
     */
    tester.view.physicalSize = const Size(780, 1688);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      _wrap(
        OrderScreen(
          order: _order(),
          onConfirmIdentity: (id, birth, _) async {
            sentId = id;
            sentBirth = birth;
            return true;
          },
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 200));

    await tester.enterText(find.byType(TextField), '3098765432');
    await tester.pump();
    await tester.tap(find.text('أرسلها للبائع'));
    await tester.pump();
    expect(sentId, isNull, reason: 'رقمٌ لا يبدأ بـ١ أو ٢ لا يُرسَل');

    /* ورقمٌ صحيحٌ بلا تاريخٍ لا يُرسل كذلك */
    await tester.enterText(find.byType(TextField), '1098765432');
    await tester.pump();
    await tester.tap(find.text('أرسلها للبائع'));
    await tester.pump();
    expect(sentId, isNull, reason: 'بلا تاريخٍ منتقًى لا يُرسَل');

    await tester.tap(find.text('اختر تاريخ ميلادك'));
    await tester.pumpAndSettle();
    await tester.tap(find.textContaining('اختر 1 محرّم'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('أرسلها للبائع'));
    await tester.pump();
    expect(sentId, '1098765432');
    /*
     * **والصيغةُ `YYYY-MM-DD` كما يطلبها الخادم** — وكانت `dd/mm/yyyy`،
     * فكلُّ تاريخٍ صحيحٍ يُكتب يُردّ بـ«تاريخ الميلاد بصيغة سنة-شهر-يوم».
     */
    expect(sentBirth, matches(r'^\d{4}-\d{2}-\d{2}$'));
    expect(sentBirth, '1410-01-01');
  });

  /// **ومرحلةُ السداد تحمل زرَّها.**
  ///
  /// فبطاقةُ النداء كانت تقول «سدّد من محفظتك أو بحوالة بنكية» ولا زرَّ
  /// تحتها — فيفتحها المشتري من «بانتظارك» ويخرج كما دخل.
  testWidgets('مرحلةُ السداد: للمشتري زرٌّ وللبائع لا', (tester) async {
    var taps = 0;
    await tester.pumpWidget(
      _wrap(
        OrderScreen(
          order: _order(stage: OrderStage.pay),
          onPay: () => taps++,
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 200));

    expect(find.text('سدّد 41,000 ر.س'), findsOneWidget);
    await tester.tap(find.text('سدّد 41,000 ر.س'));
    await tester.pump();
    expect(taps, 1);

    /* والبائعُ ينتظر السداد ولا يسدّد — فلا زرَّ له */
    await tester.pumpWidget(
      _wrap(
        OrderScreen(
          order: _order(stage: OrderStage.pay, buyer: false),
          onPay: () => taps++,
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.textContaining('سدّد 41,000'), findsNothing);
  });

  testWidgets('لا تفيض الصفقةُ على عرض 360', (tester) async {
    tester.view.physicalSize = const Size(720, 1600);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      _wrap(OrderScreen(order: _order()), size: const Size(360, 800)),
    );
    await tester.pump(const Duration(milliseconds: 200));
    expect(tester.takeException(), isNull);
  });
}
