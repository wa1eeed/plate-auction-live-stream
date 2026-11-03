import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mazad/design/tokens.dart';
import 'package:mazad/models/demo_data.dart';
import 'package:mazad/screens/market_screen.dart';

import 'font_sheet.dart';

final _now = DateTime(2026, 10, 30, 10);

/// **وغلافُ الفحص يحمل `MaterialLocalizations`.**
///
/// فـ`TextField` يطلبها لقوائمِ القصّ واللصق وأسمائها — ولا تأتي مع
/// `Material` وحدها، بل مع `MaterialApp` أو `Localizations` صريحة.
Widget _wrap(Widget child, {Size size = const Size(390, 844)}) => MaterialApp(
  debugShowCheckedModeBanner: false,
  locale: const Locale('ar', 'SA'),
  localizationsDelegates: const [
    DefaultMaterialLocalizations.delegate,
    DefaultWidgetsLocalizations.delegate,
  ],
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

Widget _screen() =>
    /* ونداءُ المتابعة يُمرَّر كما يُمرّره الصدفُ — فاللوحُ يُري الجرس */
    _wrap(
      MarketScreen(listings: demoAll(_now), serverTime: _now, onWatch: (_) {}),
    );

void main() {
  setUpAll(loadAllFonts);

  testWidgets('لوحُ السوق', (tester) async {
    tester.view.physicalSize = const Size(780, 1688);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(_screen());
    await tester.runAsync(() async {
      for (final e in find.byType(Image).evaluate()) {
        await precacheImage((e.widget as Image).image, e);
      }
    });
    await tester.pump(const Duration(milliseconds: 200));

    await expectLater(
      find.byType(MarketScreen),
      matchesGoldenFile('goldens/market.png'),
    );
  });

  /// **والبحثُ يُطبّع وأنت تكتب** — ويُعرض ما فُهم لا ما كُتب.
  testWidgets('الكتابةُ باللاتينيّ تُصفّي وتُظهر ما فُهم', (tester) async {
    await tester.pumpWidget(_screen());
    await tester.pump();

    await tester.enterText(find.byType(TextField), 'SED');
    await tester.pump();

    expect(find.text('نبحث عن'), findsOneWidget);
    expect(find.textContaining('حروف: س ع د'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  /// **ولا تمريرَ أفقيًّا عند ‎٣٦٠‎** — شرطٌ في قائمة القبول.
  testWidgets('لا يفيض السوقُ على عرض 360', (tester) async {
    tester.view.physicalSize = const Size(720, 1600);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      _wrap(
        MarketScreen(listings: demoAll(_now), serverTime: _now),
        size: const Size(360, 800),
      ),
    );
    await tester.pump(const Duration(milliseconds: 200));
    expect(tester.takeException(), isNull);
  });
}
