import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mazad/auth/auth_gate.dart';
import 'package:mazad/auth/password_login_screen.dart';
import 'package:mazad/auth/register_screen.dart';
import 'package:mazad/auth/session.dart';
import 'package:mazad/design/tokens.dart';
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

  /// **والتصفّحُ مفتوحٌ بلا دخول** — والجلسةُ تبدأ خارجةً.
  group('الجلسة', () {
    test('تبدأ غيرَ داخلة', () {
      expect(Session().signedIn, isFalse);
    });

    test('والدخولُ يُعلن مرّةً واحدة', () {
      var fired = 0;
      final s = Session()..addListener(() => fired++);
      s.signIn();
      s.signIn();
      expect(s.signedIn, isTrue);
      expect(fired, 1, reason: 'دخولٌ مكرّرٌ لا يُعلن مرّتين');
    });
  });

  /// **ولكلّ وظيفةٍ جملتُها** — لا «سجّل الدخول للمتابعة».
  group('جملةُ المطالبة', () {
    test('المزايدةُ تُعلّل بالعربون', () {
      final (title, body) = GatedAction.bid.prompt;
      expect(title, 'تحتاج حسابًا لتزايد');
      expect(body, contains('العربون'));
    });

    test('والشراءُ يُعلّل بالحجز أمانةً', () {
      expect(GatedAction.buy.prompt.$2, contains('أمانةً'));
    });

    test('ولكلّ وظيفةٍ عنوانٌ مختلف', () {
      final titles = GatedAction.values.map((a) => a.prompt.$1).toSet();
      expect(titles.length, GatedAction.values.length);
    });
  });

  /// **وورقةُ المطالبة ثلاثةُ أبواب**، وكلمةُ المرور سطرٌ لا زرّ.
  testWidgets('ورقةُ المطالبة تعرض الأبواب الثلاثة', (tester) async {
    AuthChoice? picked;
    await tester.pumpWidget(
      _wrap(
        Builder(
          builder: (context) => Center(
            child: GestureDetector(
              onTap: () async =>
                  picked = await showAuthGate(context, GatedAction.bid),
              child: const Text('زايد'),
            ),
          ),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 200));

    await tester.tap(find.text('زايد'));
    await tester.pumpAndSettle();

    expect(find.text('تحتاج حسابًا لتزايد'), findsOneWidget);
    expect(find.text('ادخل برقم جوالك'), findsOneWidget);
    expect(find.text('أنشئ حسابًا جديدًا'), findsOneWidget);
    expect(find.text('لديك حساب بكلمة مرور؟ ادخل بالبريد'), findsOneWidget);

    await tester.tap(find.text('لديك حساب بكلمة مرور؟ ادخل بالبريد'));
    await tester.pumpAndSettle();
    expect(picked, AuthChoice.password);
  });

  /// **وكلمةُ المرور سطرٌ ثانويٌّ في شاشة الدخول** لا زرٌّ يُزاحم.
  testWidgets('الدخولُ يعرض المسارَ الثانويَّ بلا مزاحمة', (tester) async {
    await tester.pumpWidget(_wrap(const LoginScreen()));
    await tester.pump(const Duration(milliseconds: 200));

    expect(find.text('أرسل الرمز'), findsOneWidget);
    expect(find.text('أنشئ حسابًا جديدًا'), findsOneWidget);
    expect(find.text('لديك حساب بكلمة مرور؟ ادخل بالبريد'), findsOneWidget);
  });

  /// **ولا يُقبل بريدٌ ولا كلمةُ مرورٍ قصيرة.**
  testWidgets('الدخولُ بالبريد يُفحص قبل الإرسال', (tester) async {
    var done = false;
    await tester.pumpWidget(
      _wrap(PasswordLoginScreen(onDone: () => done = true)),
    );
    await tester.pump(const Duration(milliseconds: 200));

    final fields = find.byType(TextField);
    await tester.enterText(fields.at(0), 'waleed');
    await tester.enterText(fields.at(1), '1234');
    await tester.pump();
    await tester.tap(find.text('دخول'));
    await tester.pump();
    expect(done, isFalse, reason: 'بريدٌ لا يصحّ وكلمةٌ قصيرة');

    await tester.enterText(fields.at(0), 'waleed@waleed.in');
    await tester.enterText(fields.at(1), '12345678');
    await tester.pump();
    await tester.tap(find.text('دخول'));
    await tester.pump();
    expect(done, isTrue);
  });

  /// **والتسجيلُ أربعةُ حقولٍ وإقرار** — ولا يُنشأ حسابٌ بلا موافقة.
  testWidgets('التسجيلُ يشترط الإقرارَ مع الحقول', (tester) async {
    var done = false;
    await tester.pumpWidget(_wrap(RegisterScreen(onDone: () => done = true)));
    await tester.pump(const Duration(milliseconds: 200));

    final fields = find.byType(TextField);
    await tester.enterText(fields.at(0), 'وليد');
    await tester.enterText(fields.at(1), '0551234567');
    await tester.enterText(fields.at(2), 'waleed@waleed.in');
    await tester.enterText(fields.at(3), '12345678');
    await tester.pump();

    await tester.tap(find.text('أنشئ الحساب'));
    await tester.pump();
    expect(done, isFalse, reason: 'لم يُقرّ بالشروط بعد');

    /* والإقرارُ آخرُ القائمة — فيُمرَّر إليه */
    await tester.drag(find.byType(ListView), const Offset(0, -300));
    await tester.pumpAndSettle();
    await tester.tap(find.textContaining('أوافق على شروط'));
    await tester.pump();
    await tester.tap(find.text('أنشئ الحساب'));
    await tester.pump();
    expect(done, isTrue);
  });

  testWidgets('لوحُ أبواب الدخول', (tester) async {
    tester.view.physicalSize = const Size(780, 1688);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(_wrap(const PasswordLoginScreen()));
    await tester.pump(const Duration(milliseconds: 200));
    await expectLater(
      find.byType(PasswordLoginScreen),
      matchesGoldenFile('goldens/login-password.png'),
    );

    await tester.pumpWidget(_wrap(const RegisterScreen()));
    await tester.pump(const Duration(milliseconds: 200));
    await expectLater(
      find.byType(RegisterScreen),
      matchesGoldenFile('goldens/register.png'),
    );
  });
}
