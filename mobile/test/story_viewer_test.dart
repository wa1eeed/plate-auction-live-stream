import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mazad/design/tokens.dart';
import 'package:mazad/screens/story_viewer.dart';
import 'package:mazad/widgets/home/stories_strip.dart';

import 'font_sheet.dart';

Widget _wrap(Widget child) => MaterialApp(
  debugShowCheckedModeBanner: false,
  home: Directionality(
    textDirection: TextDirection.rtl,
    child: MediaQuery(
      data: const MediaQueryData(size: Size(390, 844)),
      child: Material(
        color: AppColors.bg,
        child: Center(child: SizedBox(width: 390, height: 844, child: child)),
      ),
    ),
  ),
);

void main() {
  setUpAll(loadAllFonts);

  testWidgets('لوحُ عارض الستوري', (tester) async {
    tester.view.physicalSize = const Size(780, 1688);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(_wrap(const StoryViewer(stories: demoStories)));
    await tester.runAsync(() async {
      for (final e in find.byType(Image).evaluate()) {
        await precacheImage((e.widget as Image).image, e);
      }
    });
    await tester.pump(const Duration(milliseconds: 300));

    await expectLater(
      find.byType(StoryViewer),
      matchesGoldenFile('goldens/story.png'),
    );
    /* ويُوقَف المؤقّتُ قبل انتهاء الفحص فلا يبقى معلّقًا */
    await tester.pumpWidget(const SizedBox.shrink());
  });

  /// **ويتقدّم ذاتيًّا كلَّ خمسِ ثوانٍ.**
  testWidgets('القصّةُ تتقدّم وحدها', (tester) async {
    tester.view.physicalSize = const Size(780, 1688);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(_wrap(const StoryViewer(stories: demoStories)));
    await tester.pump();
    expect(find.text(demoStories.first.label), findsOneWidget);

    /*
     * **وتُزاد ثانيةٌ على المدّة.**
     *
     * فـ`pump` بمدّةٍ تساوي مدّةَ الحركة تقع على حافّتها تمامًا، والإطارُ
     * يُحسب قبل بلوغ النهاية — فلا يقع `completed`. وهذا حدُّ الإطار لا
     * عطبٌ في العارض.
     */
    await tester.pump(StoryViewer.slide + const Duration(seconds: 1));
    await tester.pump();
    expect(find.text(demoStories[1].label), findsOneWidget);

    await tester.pumpWidget(const SizedBox.shrink());
  });

  /// **والثلثُ الأوّل يرجع وما بعده يتقدّم.**
  testWidgets('النقرُ يتقدّم ويرجع بحسب موضعه', (tester) async {
    /*
     * **ويُثبَّت مقاسُ الشاشة قبل النقر بالإحداثيّات.**
     *
     * فشاشةُ الفحص الافتراضيّة ‎٨٠٠×٦٠٠‎، والعارضُ ‎٣٩٠‎ موضوعٌ في وسطها —
     * فتنزاح كلُّ نقطةٍ ‎٢٠٥‎ بكسلًا، ويقع ما حُسب يمينًا في اليسار.
     */
    tester.view.physicalSize = const Size(780, 1688);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(_wrap(const StoryViewer(stories: demoStories)));
    await tester.pump();

    /*
     * **والثلثان جهةُ التقدّم** — وهما في RTL يمينُ الشاشة حيث يبدأ الصفّ.
     * فالإبهامُ يقع حيث يُمسك الجهاز، والرجوعُ أندرُ فيُعطى الثلثَ.
     */
    await tester.tapAt(const Offset(300, 400));
    await tester.pump();
    await tester.pump();
    expect(find.text(demoStories[1].label), findsOneWidget);

    await tester.tapAt(const Offset(40, 400));
    await tester.pump();
    await tester.pump();
    expect(find.text(demoStories.first.label), findsOneWidget);

    await tester.pumpWidget(const SizedBox.shrink());
  });

  /// **وآخرُ قصّةٍ تُغلق العارض** — لا تقف على شاشةٍ لا تتقدّم.
  testWidgets('نهايةُ الأخيرة تُغلق', (tester) async {
    var closed = false;
    await tester.pumpWidget(
      _wrap(
        StoryViewer(
          stories: demoStories,
          initialIndex: demoStories.length - 1,
          onClose: () => closed = true,
        ),
      ),
    );
    await tester.pump();

    await tester.pump(StoryViewer.slide + const Duration(seconds: 1));
    await tester.pump();
    expect(closed, isTrue);

    await tester.pumpWidget(const SizedBox.shrink());
  });
}
