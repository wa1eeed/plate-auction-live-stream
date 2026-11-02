import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mazad/design/tokens.dart';
import 'package:mazad/models/demo_data.dart';
import 'package:mazad/screens/wallet_screen.dart';

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

void main() {
  setUpAll(loadAllFonts);

  testWidgets('لوحُ المحفظة', (tester) async {
    tester.view.physicalSize = const Size(780, 1688);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(_wrap(WalletScreen(wallet: demoWallet(_now))));
    await tester.runAsync(() async {
      for (final e in find.byType(Image).evaluate()) {
        await precacheImage((e.widget as Image).image, e);
      }
    });
    await tester.pump(const Duration(milliseconds: 200));

    await expectLater(
      find.byType(WalletScreen),
      matchesGoldenFile('goldens/wallet.png'),
    );
  });

  /// **والمتاحُ هو الصدر** — لا الكلّيّ.
  ///
  /// فالكلّيُّ رقمٌ لا يُزايَد به: من رآه ‎٥٠,٠٠٠‎ وزايد بها رُفض، لأنّ
  /// ‎١١,٥٠٠‎ منها محجوزةٌ على مزاداتٍ قائمة.
  testWidgets('المتاحُ في الصدر والكلّيُّ والمحجوزُ تحته', (tester) async {
    await tester.pumpWidget(_wrap(WalletScreen(wallet: demoWallet(_now))));
    await tester.pump(const Duration(milliseconds: 200));

    expect(find.text('المتاح'), findsOneWidget);
    expect(find.text('38,500'), findsOneWidget);
    expect(find.text('الرصيد الكلي'), findsOneWidget);
    expect(find.text('50,000'), findsOneWidget);
    expect(find.text('محجوز كعرابين'), findsOneWidget);
    expect(find.text('11,500'), findsOneWidget);
  });

  /// **والمحجوزُ ما زال ملكك** — فلا يُقرأ خصمًا.
  testWidgets('يُقال صراحةً إنّ المحجوز يعود', (tester) async {
    await tester.pumpWidget(_wrap(WalletScreen(wallet: demoWallet(_now))));
    await tester.pump(const Duration(milliseconds: 200));

    expect(find.textContaining('المحجوز ما زال ملكك'), findsOneWidget);
  });

  /// **ولكلّ عربونٍ سببُ حجزه** — لا مبلغٌ بلا سبب.
  testWidgets('كلُّ عربونٍ محجوزٍ معه لماذا', (tester) async {
    await tester.pumpWidget(_wrap(WalletScreen(wallet: demoWallet(_now))));
    await tester.pump(const Duration(milliseconds: 200));
    await tester.drag(find.byType(ListView), const Offset(0, -420));
    await tester.pump(const Duration(milliseconds: 200));

    expect(find.textContaining('أنت الأعلى'), findsWidgets);
    expect(find.textContaining('يعود إن انتهى المزاد'), findsOneWidget);
  });

  /// **وسطرُ الكشف بختمه وحاله** — يُراجَع حين يُسأل عنه.
  testWidgets('كشفُ الحساب يحمل الوقتَ والحال', (tester) async {
    await tester.pumpWidget(_wrap(WalletScreen(wallet: demoWallet(_now))));
    await tester.pump(const Duration(milliseconds: 200));
    await tester.drag(find.byType(ListView), const Offset(0, -900));
    await tester.pump(const Duration(milliseconds: 200));

    expect(find.text('حجز عربون'), findsWidgets);
    expect(find.text('محجوز'), findsWidgets);
    expect(find.textContaining('01/11/2026'), findsWidgets);
  });

  testWidgets('لا تفيض المحفظةُ على عرض 360', (tester) async {
    tester.view.physicalSize = const Size(720, 1600);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      _wrap(WalletScreen(wallet: demoWallet(_now)), size: const Size(360, 800)),
    );
    await tester.pump(const Duration(milliseconds: 200));
    expect(tester.takeException(), isNull);
  });
}
