import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mazad/design/tokens.dart';
import 'package:mazad/widgets/home/home_banners.dart';

import 'font_sheet.dart';

/// **البنراتُ الثلاثة** — §5.1، وارتفاعُها ثابتٌ ‎١٧٧‎ لا يكبر.
/* موعدٌ ثابتٌ فلا تتبدّل اللقطةُ بتبدّل الساعة */
final _end = DateTime.now().add(const Duration(hours: 5, minutes: 12));

void main() {
  setUpAll(loadAllFonts);

  testWidgets('ارتفاعُ البنر ثابتٌ ١٧٧', (tester) async {
    /*
     * **والعرضُ يُقيَّد بـ`SizedBox` لا بـ`MediaQuery`.**
     *
     * فـ`MediaQuery` يُعطي مقاييسَ يقرؤها المكوّن، ولا يفرض قيدَ تخطيط —
     * فتبقى شاشةُ الفحص على عرضها الافتراضيّ ‎٨٠٠‎، فيُقاس البنرُ على عرضٍ
     * لا يقع على جهاز. وقع ذلك فأخفى فيضًا حقيقيًّا كان يظهر على اللوحيّ.
     */
    await tester.pumpWidget(
      Directionality(
        textDirection: TextDirection.rtl,
        child: MediaQuery(
          data: const MediaQueryData(size: Size(390, 844)),
          child: Material(
            color: AppColors.bg,
            child: Center(
              child: SizedBox(
                width: 390,
                child: HomeBanners(nearestAuctionEnd: _end),
              ),
            ),
          ),
        ),
      ),
    );
    /* ولا `pumpAndSettle`: بطاقاتُ البنر الثاني تطفو بلا توقّف فلا تهدأ */
    await tester.pump(const Duration(milliseconds: 300));

    final box = tester.getSize(find.byType(PageView));
    expect(
      box.height,
      HomeBanners.height,
      reason: 'البنرُ لا يكبر — قرارٌ صريح',
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('لوحُ البنرات', (tester) async {
    tester.view.physicalSize = const Size(780, 1340);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);

    final controller = PageController(viewportFraction: 0.955);
    addTearDown(controller.dispose);

    await tester.pumpWidget(
      Directionality(
        textDirection: TextDirection.rtl,
        child: MediaQuery(
          data: const MediaQueryData(size: Size(390, 670)),
          child: Material(
            color: AppColors.bg,
            child: Align(
              alignment: Alignment.topCenter,
              child: SizedBox(
                width: 390,
                /* الثلاثةُ فوق بعضٍ، فتُقارَن في لقطةٍ واحدة */
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: const [
                    SizedBox(height: 10),
                    _One(index: 0),
                    SizedBox(height: 10),
                    _One(index: 1),
                    SizedBox(height: 10),
                    _One(index: 2),
                    SizedBox(height: 10),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );

    await tester.runAsync(() async {
      for (final e in find.byType(Image).evaluate()) {
        await precacheImage((e.widget as Image).image, e);
      }
    });
    await tester.pump(const Duration(milliseconds: 200));

    await expectLater(
      find.byType(Column).first,
      matchesGoldenFile('goldens/home-banners.png'),
    );
  });
}

/// بنرٌ واحدٌ بعينه — يُفتح `PageView` على صفحته ويُجمَّد.
class _One extends StatelessWidget {
  const _One({required this.index});
  final int index;

  @override
  /* والبنرُ ‎١٧٧‎ ومعه النقاطُ تحته: ‎١٠‎ فراغًا و‎٦‎ للنقطة */
  Widget build(BuildContext context) => SizedBox(
    height: HomeBanners.height + 16,
    child: _Frozen(index: index),
  );
}

class _Frozen extends StatefulWidget {
  const _Frozen({required this.index});
  final int index;

  @override
  State<_Frozen> createState() => _FrozenState();
}

class _FrozenState extends State<_Frozen> {
  @override
  Widget build(BuildContext context) {
    return _BannerAt(index: widget.index);
  }
}

/// يستخرج البنرَ المطلوبَ بفتح `HomeBanners` على صفحته.
class _BannerAt extends StatefulWidget {
  const _BannerAt({required this.index});
  final int index;

  @override
  State<_BannerAt> createState() => _BannerAtState();
}

class _BannerAtState extends State<_BannerAt> {
  @override
  Widget build(BuildContext context) => HomeBanners(
    initialPage: widget.index,
    nearestAuctionEnd: _end,
    availableHalalas: 3850000,
  );
}
