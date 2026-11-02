import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mazad/design/tokens.dart';
import 'package:mazad/screens/settings_screen.dart';
import 'package:mazad/widgets/settings/ios_switch.dart';

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

  testWidgets('لوحُ الإعدادات', (tester) async {
    tester.view.physicalSize = const Size(780, 1688);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(_wrap(const SettingsScreen()));
    await tester.pump(const Duration(milliseconds: 300));

    await expectLater(
      find.byType(SettingsScreen),
      matchesGoldenFile('goldens/settings.png'),
    );
  });

  /// **والجوالُ موثّقٌ للقراءة** — تغييرُه يُغيّر هويّةَ الدخول.
  testWidgets('الجوالُ لا يُحرَّر من هنا', (tester) async {
    await tester.pumpWidget(_wrap(const SettingsScreen()));
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.text('موثّق · يُغيَّر عبر الدعم'), findsOneWidget);
  });

  /// **ومفتاحُ التنبيهات يعمل.**
  testWidgets('المفتاحُ يتبدّل بالضغط', (tester) async {
    await tester.pumpWidget(_wrap(const SettingsScreen()));
    await tester.pump(const Duration(milliseconds: 300));

    /*
     * **وما تحت الطيّة غيرُ مبنيٍّ أصلًا** — فلا يكفي `ensureVisible`،
     * وهو يشترط وجودَ العنصر في الشجرة. فيُمرَّر حتى يُبنى ثمّ يُنقر.
     */
    /*
     * **ويُمرَّر بالسحب لا بـ`scrollUntilVisible`.**
     *
     * فهي تشترط مطابقًا واحدًا، والمفاتيحُ خمسة؛ و`.first` على باحثٍ فارغٍ
     * يرمي بدل أن يُرجع فراغًا، فلا تصلح معه أيضًا.
     */
    final sw = find.byType(IosSwitch);
    final list = find.byType(Scrollable).first;
    for (var i = 0; i < 8 && sw.evaluate().isEmpty; i++) {
      await tester.drag(list, const Offset(0, -400));
      await tester.pumpAndSettle();
    }
    expect(sw, findsWidgets, reason: 'لم تُبنَ المفاتيحُ بعد التمرير');

    final before = tester.widget<IosSwitch>(sw.first).value;
    await tester.tap(sw.first);
    await tester.pumpAndSettle();
    expect(tester.widget<IosSwitch>(sw.first).value, !before);
  });

  /// **ولا يُحذف الحسابُ وعليك معلّق** — ولكلِّ مانعٍ وجهتُه.
  testWidgets('المعلّقاتُ تمنع الحذفَ وتُسمّى', (tester) async {
    await tester.pumpWidget(
      _wrap(
        const SettingsScreen(
          blockers: [DeletionBlocker('عربون محجوز', '11,500 ر.س على 3 مزادات')],
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 300));

    await tester.scrollUntilVisible(
      find.text('حذف الحساب'),
      400,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('حذف الحساب'));
    await tester.pumpAndSettle();

    expect(find.text('لا يمكن حذف حسابك الآن'), findsOneWidget);
    expect(find.text('عربون محجوز'), findsOneWidget);
    expect(find.text('علّق حسابي واطلب الحذف'), findsNothing);
  });

  /// **وبلا معلّقاتٍ يُشرح ما يقع قبل أن يقع.**
  testWidgets('بلا معلّقات: شرحٌ وإقرارٌ ثمّ زرّ', (tester) async {
    await tester.pumpWidget(_wrap(const SettingsScreen()));
    await tester.pump(const Duration(milliseconds: 300));

    await tester.scrollUntilVisible(
      find.text('حذف الحساب'),
      400,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('حذف الحساب'));
    await tester.pumpAndSettle();

    expect(find.textContaining('يُعلَّق حسابك فورًا'), findsOneWidget);
    expect(find.textContaining('30 يومًا'), findsWidgets);
    expect(find.text('علّق حسابي واطلب الحذف'), findsOneWidget);
  });

  testWidgets('لا تفيض الإعداداتُ على عرض 360', (tester) async {
    tester.view.physicalSize = const Size(720, 1600);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      _wrap(const SettingsScreen(), size: const Size(360, 800)),
    );
    await tester.pump(const Duration(milliseconds: 300));
    expect(tester.takeException(), isNull);
  });
}
