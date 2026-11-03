import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mazad/widgets/plate.dart';

/// **كلُّ حرفٍ عربيٍّ فوق ما يقابله من اللاتينيّ تمامًا** — أوّلُ قواعد اللوحة.
///
/// ولا تُقاس بالعين: الحرفان يبدوان متجاورين في اللقطة وهما على عمودين
/// مختلفين، والفرقُ بضعةُ بكسلات. فتُقاس المواضعُ المرسومة نفسُها.
import 'font_sheet.dart';

void main() {
  /*
   * **ويُقاس على الخطّ المحزوم لا على Arial.**
   *
   * فـArial لم يعد يُحزم — أبل تردّ تضمينَه (`ITMS-91198`) — ويُرسم من
   * خطوط النظام في iOS. وبيئةُ الفحص بلا خطوط نظام، فالمقيسُ هنا هو ما
   * يراه مَن لا Arial عنده: أندرويد.
   */
  setUpAll(() => loadPlateFont('assets/fonts/plate-noto-bold.ttf'));

  /// يُرجع مراكزَ المحارف المطلوبة على المحور الأفقيّ، بترتيب ظهورها.
  Future<List<(String, double)>> centers(
    WidgetTester tester,
    SaudiPlate plate,
    List<String> glyphs,
  ) async {
    await tester.pumpWidget(
      Directionality(
        /* والتطبيقُ كلُّه عربيٌّ — فاللوحةُ تُختبر داخل اتّجاهه لا خارجه */
        textDirection: TextDirection.rtl,
        child: MediaQuery(
          data: const MediaQueryData(size: Size(390, 844)),
          child: Center(child: SizedBox(width: 320, child: plate)),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final out = <(String, double)>[];
    for (final g in glyphs) {
      final finder = find.text(g);
      expect(finder, findsWidgets, reason: 'لم يُرسم المحرف «$g»');
      final box = tester.getRect(finder.first);
      out.add((g, box.center.dx));
    }
    return out;
  }

  testWidgets('الطويلة: الحرفُ العربيُّ فوق مقابله، والرقمُ فوق مقابله', (
    tester,
  ) async {
    const plate = SaudiPlate(letters: 'ق و س', number: '4040');

    /* ق→G · و→U · س→S — ولكلٍّ عمودُه */
    for (final (ar, en) in [('ق', 'G'), ('و', 'U'), ('س', 'S')]) {
      final found = await centers(tester, plate, [ar, en]);
      expect(
        found[0].$2,
        moreOrLessEquals(found[1].$2, epsilon: 0.5),
        reason: '«$ar» ليس فوق «$en»',
      );
    }
  });

  testWidgets('والترتيبُ يسار→يمين حسب اللاتينيّ لا حسب قراءة العربيّة', (
    tester,
  ) async {
    const plate = SaudiPlate(letters: 'ق و س', number: '4040');
    final found = await centers(tester, plate, ['G', 'U', 'S']);

    /*
     * **واللوحةُ تُقرأ من اليسار** — النموذجُ يكتب `dir="ltr"` على جذرها.
     * فأوّلُ حرفٍ في «ق و س» يقع يسارًا، ولو كان التطبيق كلُّه عربيًّا.
     */
    expect(
      found[0].$2,
      lessThan(found[1].$2),
      reason: 'G يجب أن تسبق U يسارًا',
    );
    expect(
      found[1].$2,
      lessThan(found[2].$2),
      reason: 'U يجب أن تسبق S يسارًا',
    );
  });

  testWidgets('والرقمُ لا ينقلب: 4040 تبقى 4040', (tester) async {
    const plate = SaudiPlate(letters: 'ق و س', number: '2846');
    final found = await centers(tester, plate, ['2', '8', '4', '6']);
    for (var i = 1; i < found.length; i++) {
      expect(
        found[i - 1].$2,
        lessThan(found[i].$2),
        reason: 'خانةُ «${found[i - 1].$1}» يجب أن تسبق «${found[i].$1}»',
      );
    }
  });

  testWidgets('والأرقامُ تقع يسارَ الحروف — كما في الصورة المرجعيّة', (
    tester,
  ) async {
    const plate = SaudiPlate(letters: 'ك ط ع', number: '4040');
    final found = await centers(tester, plate, ['4', 'K']);
    expect(found[0].$2, lessThan(found[1].$2));
  });
}
