import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mazad/design/tokens.dart';
import 'package:mazad/models/demo_data.dart';
import 'package:mazad/screens/account_screen.dart';

import 'font_sheet.dart';

final _now = DateTime(2026, 11, 1, 9, 40);

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

AccountScreen _screen() {
  final w = demoWallet(_now);
  return AccountScreen(
    name: 'وليد',
    handle: '@waleed',
    membershipNumber: 'U26-00001',
    available: w.available,
    balance: w.balance,
    held: w.held,
    myPlates: demoOffers(_now),
  );
}

void main() {
  setUpAll(loadAllFonts);

  testWidgets('لوحُ حسابي', (tester) async {
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
      find.byType(AccountScreen),
      matchesGoldenFile('goldens/account.png'),
    );
  });

  /// **والبطاقةُ تحمل المتاحَ كبيرًا والكلّيَّ والمحجوزَ صغيرين** — كالمحفظة.
  testWidgets('البطاقةُ تعرض المتاحَ والرصيدَ والمحجوز', (tester) async {
    await tester.pumpWidget(_wrap(_screen()));
    await tester.pump(const Duration(milliseconds: 200));

    expect(find.text('38,500'), findsOneWidget);
    expect(find.text('الرصيد 50,000'), findsOneWidget);
    expect(find.text('محجوز 11,500'), findsOneWidget);
    expect(find.text('U26-00001'), findsOneWidget);
  });

  /// **والمعرّفُ يُقرأ يسارًا** ولو كان ما حوله عربيًّا.
  testWidgets('المعرّفُ العلنيُّ بصيغته اللاتينيّة', (tester) async {
    await tester.pumpWidget(_wrap(_screen()));
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.text('@waleed'), findsOneWidget);
  });

  /// **وزرُّ المحفظة في البطاقة** — فالبطاقةُ ملخّصٌ والتفصيلُ خلفها.
  testWidgets('زرُّ المحفظة يفتحها', (tester) async {
    var opened = false;
    final w = demoWallet(_now);
    await tester.pumpWidget(
      _wrap(
        AccountScreen(
          name: 'وليد',
          handle: '@waleed',
          membershipNumber: 'U26-00001',
          available: w.available,
          balance: w.balance,
          held: w.held,
          myPlates: demoOffers(_now),
          onOpenWallet: () => opened = true,
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 200));

    await tester.tap(find.text('المحفظة'));
    await tester.pump();
    expect(opened, isTrue);
  });

  testWidgets('لا يفيض حسابي على عرض 360', (tester) async {
    tester.view.physicalSize = const Size(720, 1600);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(_wrap(_screen(), size: const Size(360, 800)));
    await tester.pump(const Duration(milliseconds: 200));
    expect(tester.takeException(), isNull);
  });
}
