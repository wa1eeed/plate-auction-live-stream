import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mazad/widgets/sell/letter_slots.dart';
import 'package:mazad/widgets/plate.dart';
import 'package:mazad/design/tokens.dart';
import 'package:mazad/screens/sell_screen.dart';

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
  _slotDirection();
  setUpAll(loadAllFonts);

  testWidgets('لوحُ إضافة لوحة', (tester) async {
    tester.view.physicalSize = const Size(780, 1688);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(_wrap(const SellScreen()));
    await tester.runAsync(() async {
      for (final e in find.byType(Image).evaluate()) {
        await precacheImage((e.widget as Image).image, e);
      }
    });
    await tester.pump(const Duration(milliseconds: 400));

    await expectLater(
      find.byType(SellScreen),
      matchesGoldenFile('goldens/sell.png'),
    );
  });

  /// **والدراجةُ اعتياديّةٌ دائمًا** — فيُخفى اختيارُ الإصدار لها.
  testWidgets('الدراجةُ تُخفي الإصدار', (tester) async {
    await tester.pumpWidget(_wrap(const SellScreen()));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('الإصدار'), findsOneWidget);

    await tester.tap(find.text('دراجة'));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('الإصدار'), findsNothing);
  });

  /// **والشعارُ للطويلة الخصوصيّ وحدها.**
  testWidgets('الشعارُ يظهر للطويلة الخصوصيّ لا لغيرها', (tester) async {
    await tester.pumpWidget(_wrap(const SellScreen()));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('شعار المنتصف'), findsOneWidget);

    await tester.tap(find.text('رياضية'));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('شعار المنتصف'), findsNothing);

    await tester.tap(find.text('نقل خاص'));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('شعار المنتصف'), findsNothing);
  });

  /// **والرياضيّةُ إنجليزيٌّ فقط** — يُقال صراحةً لا يُكتشف بعد النشر.
  testWidgets('الرياضيةُ تُنبّه أنّها إنجليزي فقط', (tester) async {
    await tester.pumpWidget(_wrap(const SellScreen()));
    await tester.pump(const Duration(milliseconds: 300));

    await tester.tap(find.text('رياضية'));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.textContaining('إنجليزي فقط'), findsOneWidget);
  });

  /// **ولا تُفتح الخانةُ الثانيةُ قبل الأولى.**
  testWidgets('خاناتُ الحروف تُفتح بالتتابع', (tester) async {
    await tester.pumpWidget(_wrap(const SellScreen()));
    await tester.pump(const Duration(milliseconds: 300));

    /* الأولى وحدها تحمل «اختر» — وهي المفتوحة */
    expect(find.text('اختر'), findsOneWidget);

    /*
     * وتُنقر الخانةُ نفسُها لا الصفُّ الحاوي — فبينها فراغ.
     * **وتُجلَب إلى المنظور أوّلًا**: ما بُني خارج الشاشة يُوجَد بالبحث
     * ولا يُصيبه النقر، فيمرّ الفحصُ بتحذيرٍ لا بخطأ.
     */
    await tester.ensureVisible(find.text('اختر'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('اختر'));
    await tester.pumpAndSettle();
    expect(find.text('اختر الحرف'), findsOneWidget);
  });

  testWidgets('لا تفيض الشاشةُ على عرض 360', (tester) async {
    tester.view.physicalSize = const Size(720, 1600);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      _wrap(const SellScreen(), size: const Size(360, 800)),
    );
    await tester.pump(const Duration(milliseconds: 300));
    expect(tester.takeException(), isNull);
  });
}

/// **الخاناتُ واللوحةُ بالاتّجاه نفسِه** — وهو ما انقلب في أوّل تجربةٍ
/// على جهاز.
///
/// فاللوحةُ تُرسم `dir="ltr"` كما في حزمة التسليم: أوّلُ حرفٍ يسارًا وتحته
/// مقابلُه اللاتينيّ. وكان صفُّ الخانات يتبع اتّجاه التطبيق (عربيٌّ، فأولاها
/// يمينًا) — فيملأ المستخدمُ اليمنى أوّلًا ويراها في المعاينة يسارًا،
/// فتبدو اللوحةُ مقلوبةً وهي تطابق ما أُدخل.
void _slotDirection() {
  testWidgets('أوّلُ خانةٍ وأوّلُ حرفٍ في اللوحة كلاهما يسارًا', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(900, 700);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      MaterialApp(
        home: Directionality(
          textDirection: TextDirection.rtl,
          child: Scaffold(
            body: Column(
              children: [
                LetterSlots(letters: const ['ق', 'و', 'س'], onChanged: (_) {}),
                const SizedBox(height: 40),
                const SizedBox(
                  height: 110,
                  child: SaudiPlate(letters: 'قوس', number: '1234'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    double x(String ch, int skip) =>
        (find.text(ch).evaluate().elementAt(skip).renderObject! as RenderBox)
            .localToGlobal(Offset.zero)
            .dx;

    /* الظهورُ الأوّلُ في الخانات والثاني في اللوحة */
    expect(x('ق', 0) < x('س', 0), isTrue, reason: 'أوّلُ خانةٍ يسارًا');
    expect(x('ق', 1) < x('س', 1), isTrue, reason: 'وأوّلُ حرفٍ في اللوحة كذلك');
  });
}
