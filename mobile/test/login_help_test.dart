import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mazad/design/tokens.dart';
import 'package:mazad/screens/help_screen.dart';
import 'package:mazad/screens/login_screen.dart';

import 'font_sheet.dart';

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

  testWidgets('لوحُ الدخول', (tester) async {
    tester.view.physicalSize = const Size(780, 1688);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(_wrap(const LoginScreen()));
    await tester.pump(const Duration(milliseconds: 200));

    await expectLater(
      find.byType(LoginScreen),
      matchesGoldenFile('goldens/login.png'),
    );
  });

  /// **ولا يُرسَل رمزٌ لرقمٍ لا يصحّ** — ‎05‎ وعشرُ خانات.
  testWidgets('الجوالُ يُفحص قبل الإرسال', (tester) async {
    await tester.pumpWidget(_wrap(const LoginScreen()));
    await tester.pump(const Duration(milliseconds: 200));

    await tester.enterText(find.byType(TextField), '0512345');
    await tester.pump();
    await tester.tap(find.text('أرسل الرمز'));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('رمز التحقق'), findsNothing);

    await tester.enterText(find.byType(TextField), '0551234567');
    await tester.pump();
    await tester.tap(find.text('أرسل الرمز'));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('رمز التحقق'), findsOneWidget);
  });

  /// **و«لاحقًا» مخرجٌ صريح** — المعرّفُ لا يمنع الدخول.
  testWidgets('اختيارُ المعرّف يُتخطّى', (tester) async {
    var done = false;
    await tester.pumpWidget(_wrap(LoginScreen(onDone: () => done = true)));
    await tester.pump(const Duration(milliseconds: 200));

    await tester.enterText(find.byType(TextField), '0551234567');
    await tester.pump();
    await tester.tap(find.text('أرسل الرمز'));
    await tester.pump(const Duration(milliseconds: 300));

    await tester.enterText(find.byType(TextField).last, '1234');
    await tester.pump();
    await tester.tap(find.text('تحقّق'));
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.text('اختر معرّفك'), findsOneWidget);
    await tester.tap(find.text('لاحقًا'));
    await tester.pump();
    expect(done, isTrue);
  });

  testWidgets('لوحُ المساعدة', (tester) async {
    tester.view.physicalSize = const Size(780, 1688);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(_wrap(const HelpScreen()));
    await tester.pump(const Duration(milliseconds: 200));

    await expectLater(
      find.byType(HelpScreen),
      matchesGoldenFile('goldens/help.png'),
    );
  });

  /// **وأسئلةُ أبشر الأربعة موجودة** — وهي أكثرُ ما يُسأل عنه.
  testWidgets('الأسئلةُ الشائعة تحمل أسئلةَ أبشر', (tester) async {
    await tester.pumpWidget(_wrap(const HelpScreen()));
    await tester.pump(const Duration(milliseconds: 200));

    await tester.tap(find.text('الأسئلة الشائعة'));
    await tester.pumpAndSettle();

    expect(find.textContaining('كيف أنقل اللوحة'), findsOneWidget);
    expect(find.textContaining('كيف أستلم اللوحة'), findsOneWidget);
    expect(find.textContaining('المحفظة الرقمية'), findsOneWidget);
    expect(find.textContaining('ما رسوم أبشر'), findsOneWidget);
  });

  /// **والجوابُ يُفتح بضغطة** — ولا يُفتح اثنان معًا.
  testWidgets('الأكورديون يفتح واحدًا', (tester) async {
    await tester.pumpWidget(_wrap(const HelpScreen()));
    await tester.pump(const Duration(milliseconds: 200));
    await tester.tap(find.text('الأسئلة الشائعة'));
    await tester.pumpAndSettle();

    expect(
      find.textContaining('افصل اللوحة عن سيارتك أولًا، ثم ادخل أبشر'),
      findsNothing,
    );
    await tester.tap(find.textContaining('كيف أنقل اللوحة'));
    await tester.pumpAndSettle();
    expect(
      find.textContaining('افصل اللوحة عن سيارتك أولًا، ثم ادخل أبشر'),
      findsOneWidget,
    );
  });

  testWidgets('لا تفيض الشاشتان على عرض 360', (tester) async {
    tester.view.physicalSize = const Size(720, 1600);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);

    for (final w in [const LoginScreen(), const HelpScreen()]) {
      await tester.pumpWidget(_wrap(w, size: const Size(360, 800)));
      await tester.pump(const Duration(milliseconds: 200));
      expect(tester.takeException(), isNull);
    }
  });
}
