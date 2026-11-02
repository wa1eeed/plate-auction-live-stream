import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mazad/design/tokens.dart';
import 'package:mazad/models/demo_data.dart';
import 'package:mazad/screens/notifications_screen.dart';
import 'package:mazad/screens/showcase_screen.dart';

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

Widget _showcase() => ShowcaseScreen(
  name: 'وليد',
  handle: '@waleed',
  city: 'الرياض',
  joined: 'سنتين',
  plates: demoOffers(_now) + demoFixed(_now),
);

void main() {
  setUpAll(loadAllFonts);

  testWidgets('لوحُ المعرض', (tester) async {
    tester.view.physicalSize = const Size(780, 1688);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(_wrap(_showcase()));
    await tester.runAsync(() async {
      for (final e in find.byType(Image).evaluate()) {
        await precacheImage((e.widget as Image).image, e);
      }
    });
    await tester.pump(const Duration(milliseconds: 200));

    await expectLater(
      find.byType(ShowcaseScreen),
      matchesGoldenFile('goldens/showcase.png'),
    );
  });

  /// **ورأسُ المعرض يحمل المدينةَ ومدّةَ الانضمام والعدد** — ما يُطمئن الغريب.
  testWidgets('رأسُ المعرض يُعرّف بصاحبه', (tester) async {
    await tester.pumpWidget(_wrap(_showcase()));
    await tester.pump(const Duration(milliseconds: 200));

    expect(find.text('وليد'), findsOneWidget);
    expect(find.text('@waleed'), findsOneWidget);
    expect(find.text('الرياض'), findsOneWidget);
    expect(find.text('منضمّ منذ سنتين'), findsOneWidget);
    expect(find.textContaining('souq-plates.sa/'), findsOneWidget);
  });

  testWidgets('لوحُ الإشعارات', (tester) async {
    tester.view.physicalSize = const Size(780, 1688);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      _wrap(NotificationsScreen(items: demoNotifications(_now))),
    );
    await tester.pump(const Duration(milliseconds: 200));

    await expectLater(
      find.byType(NotificationsScreen),
      matchesGoldenFile('goldens/notifications.png'),
    );
  });

  /// **و«علّمها مقروءة» تُطفئ النقاطَ كلَّها** ثمّ تختفي هي.
  testWidgets('تعليمُ الكلِّ مقروءًا يُخفي الزرَّ نفسَه', (tester) async {
    await tester.pumpWidget(
      _wrap(NotificationsScreen(items: demoNotifications(_now))),
    );
    await tester.pump(const Duration(milliseconds: 200));

    expect(find.text('علّمها مقروءة'), findsOneWidget);
    await tester.tap(find.text('علّمها مقروءة'));
    await tester.pumpAndSettle();
    expect(find.text('علّمها مقروءة'), findsNothing);
  });

  /// **وحالةُ الفراغ تقول ما لا يوجد** لا شاشةٌ بيضاء.
  testWidgets('بلا إشعاراتٍ: رسالةٌ صريحة', (tester) async {
    await tester.pumpWidget(_wrap(const NotificationsScreen(items: [])));
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.text('لا إشعارات بعد'), findsOneWidget);
  });

  testWidgets('لا تفيض الشاشتان على عرض 360', (tester) async {
    tester.view.physicalSize = const Size(720, 1600);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(_wrap(_showcase(), size: const Size(360, 800)));
    await tester.pump(const Duration(milliseconds: 200));
    expect(tester.takeException(), isNull);

    await tester.pumpWidget(
      _wrap(
        NotificationsScreen(items: demoNotifications(_now)),
        size: const Size(360, 800),
      ),
    );
    await tester.pump(const Duration(milliseconds: 200));
    expect(tester.takeException(), isNull);
  });
}
