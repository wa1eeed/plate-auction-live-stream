import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mazad/design/tokens.dart';
import 'package:mazad/models/demo_data.dart';
import 'package:mazad/screens/activity_screen.dart';

import 'font_sheet.dart';

final _now = DateTime(2026, 10, 30, 10);

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

ActivityScreen _screen({bool empty = false}) => ActivityScreen(
  pending: empty ? const [] : demoPending(),
  myBids: demoAuctions(_now),
  myOffers: demoOffers(_now),
  watching: demoFixed(_now),
  serverTime: _now,
);

void main() {
  setUpAll(loadAllFonts);

  testWidgets('لوحُ نشاطي', (tester) async {
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
      find.byType(ActivityScreen),
      matchesGoldenFile('goldens/activity.png'),
    );
  });

  /// **ووسما الدور ونوع الصفقة تحت كلّ لوحة** — §9.
  testWidgets('كلُّ بندٍ يحمل دورَك ونوعَ الصفقة', (tester) async {
    await tester.pumpWidget(_wrap(_screen()));
    await tester.pump(const Duration(milliseconds: 200));

    expect(find.text('أنت المشتري'), findsWidgets);
    expect(find.text('أنت البائع'), findsWidgets);
    expect(find.text('مزاد'), findsWidgets);
    expect(find.text('سوم'), findsWidgets);
  });

  /// **وتابُ «بانتظارك» يجمع الأنواعَ الأربعة** — لا تابًا لكلٍّ.
  testWidgets('بانتظارك يجمع السداد والسوم والتجاوز والنقل', (tester) async {
    await tester.pumpWidget(_wrap(_screen()));
    await tester.pump(const Duration(milliseconds: 200));

    expect(find.text('أكّد بياناتك لنقل الملكية'), findsOneWidget);
    expect(find.textContaining('من سلطان'), findsOneWidget);
    expect(find.text('أعلى مزايدة 51,000 ر.س'), findsOneWidget);

    /*
     * **والرابعُ تحت الطيّة** — و`ListView` لا يبني ما لم يُعرض، فلا يُوجَد
     * بالبحث قبل التمرير إليه. وهذا سلوكٌ مقصودٌ لا عطب: قائمةٌ تبني كلَّ
     * عناصرها تُثقل أوّلَ فتحةٍ بما لا يُرى.
     */
    await tester.drag(find.byType(ListView), const Offset(0, -500));
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.text('انقل الملكية في أبشر'), findsOneWidget);
  });

  /// **والسومُ له زرّان، وغيرُه زرٌّ واحد.**
  testWidgets('السومُ يُقبل أو يُرفض من البطاقة', (tester) async {
    await tester.pumpWidget(_wrap(_screen()));
    await tester.pump(const Duration(milliseconds: 200));

    expect(find.text('اقبل السوم'), findsOneWidget);
    expect(find.text('ارفض'), findsOneWidget);
  });

  /// **وحالةُ الفراغ تطمئن** لا تترك الشاشةَ بيضاء.
  testWidgets('لا شيء عليك: رسالةٌ صريحة', (tester) async {
    await tester.pumpWidget(_wrap(_screen(empty: true)));
    await tester.pump(const Duration(milliseconds: 200));

    expect(find.text('ما عليك شيء الآن'), findsOneWidget);
  });

  testWidgets('لا تفيض الشاشةُ على عرض 360', (tester) async {
    tester.view.physicalSize = const Size(720, 1600);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(_wrap(_screen(), size: const Size(360, 800)));
    await tester.pump(const Duration(milliseconds: 200));
    expect(tester.takeException(), isNull);
  });
}
