import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mazad/api/api_client.dart';
import 'package:mazad/api/api_scope.dart';
import 'package:mazad/api/mazad_api.dart';
import 'package:mazad/design/tokens.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mazad/screens/sell_screen.dart';

import 'font_sheet.dart';

late final MazadApi _api;

Widget _wrap(Widget child) => MaterialApp(
  debugShowCheckedModeBanner: false,
  home: ApiScope(
    api: _api,
    child: Directionality(
      textDirection: TextDirection.rtl,
      child: MediaQuery(
        data: const MediaQueryData(size: Size(390, 844)),
        child: Material(
          color: AppColors.bg,
          child: SizedBox(width: 390, height: 844, child: child),
        ),
      ),
    ),
  ),
);

/// **المسوّدةُ تُترجَم إلى لغة الخادم** — وهو موضعُ خطأٍ سهل.
void main() {
  setUpAll(() async {
    await loadAllFonts();
    _api = MazadApi(await ApiClient.create());
  });

  testWidgets('الاختياراتُ تُترجَم بأسماء الخادم', (tester) async {
    SellDraft? sent;
    await tester.pumpWidget(
      _wrap(
        SellScreen(
          onPublish: (d) async {
            sent = d;
            return true;
          },
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 300));

    /* نقلٌ خاصّ · رياضيّة */
    await tester.tap(find.text('نقل خاص'));
    await tester.pump(const Duration(milliseconds: 200));
    await tester.tap(find.text('رياضية'));
    await tester.pump(const Duration(milliseconds: 200));

    /*
     * ثلاثةُ حروفٍ من القائمة. و«اختر» على الخانة الأولى وحدها — فتُنقر
     * أيقونةُ `+` التي تحملها كلُّ خانةٍ فارغة.
     */
    /* وتُمرَّر القائمةُ أوّلًا — فالخاناتُ تحت الطيّة ولا تُبنى قبلها */
    await tester.drag(find.byType(ListView), const Offset(0, -260));
    await tester.pumpAndSettle();
    expect(
      find.byIcon(LucideIcons.plus),
      findsWidgets,
      reason: 'لم تُبنَ خاناتُ الحروف بعد التمرير',
    );

    for (final letter in ['ق', 'و', 'س']) {
      final plus = find.byIcon(LucideIcons.plus);
      await tester.tap(plus.first);
      await tester.pumpAndSettle();
      await tester.tap(find.text(letter).last);
      await tester.pumpAndSettle();
    }

    await tester.enterText(find.byType(TextField).last, '4040');
    await tester.pump(const Duration(milliseconds: 200));

    await tester.tap(find.textContaining('التالي: طريقة البيع'));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField).first, '35000');
    await tester.pump(const Duration(milliseconds: 200));
    await tester.tap(find.textContaining('التالي: المراجعة'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('انشر اللوحة'));
    await tester.pumpAndSettle();

    expect(sent, isNotNull, reason: 'لم تُرسَل المسوّدة');
    expect(sent!.plateType, 'transport');
    expect(sent!.plateFormat, 'sport');
    expect(sent!.plateNumbers, '4040');
    expect(sent!.saleType, 'auction');

    /*
     * **واللاتينيُّ يُحسب من العربيّ** — فالمخطَّطُ يشترطه، والخريطةُ معروفةٌ
     * في الواجهة: لا يُطالَب المستخدمُ بكتابة حروفه مرّتين.
     */
    expect(sent!.arabicLetters, 'قوس');
    expect(sent!.latinLetters, 'GUS');

    /*
     * **والمبلغُ بالريال لا بالهللة** في هذا المسار: المخطَّطُ يقرأه
     * `riyalField` ويضربه هو — وإرسالُ الهللات يُنشئ إعلانًا بمئة ضعفه.
     */
    expect(sent!.priceRiyals, 35000);

    /* والمدّةُ بالثواني — ثلاثةُ أيّامٍ افتراضًا */
    expect(sent!.durationSeconds, 3 * 24 * 60 * 60);
  });

  /// **ولا يُنشر بسعرٍ صفر** — إعلانٌ بلا سعرٍ يُردّ في الخادم.
  testWidgets('الزرُّ لا ينشر بلا سعر', (tester) async {
    var sent = false;
    await tester.pumpWidget(
      _wrap(
        SellScreen(
          onPublish: (_) async {
            sent = true;
            return true;
          },
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 300));
    expect(sent, isFalse);
  });
}
