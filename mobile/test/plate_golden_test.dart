import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mazad/design/tokens.dart';
import 'package:mazad/widgets/plate.dart';

/// **لوحٌ يعرض الإصدارات كلَّها** — يُقابل `reference/plate-reference.png`.
///
/// وقائمةُ القبول تشترط سبعًا: طويلة خصوصي/نقل، اعتياديّة خصوصي/نقل،
/// رياضيّة خصوصي/نقل، ودراجة.
Widget _sheet() {
  const cases = <(String, SaudiPlate)>[
    ('طويلة · خصوصي', SaudiPlate(letters: 'ق و س', number: '1')),
    ('طويلة · نقل خاص',
        SaudiPlate(letters: 'ق و س', number: '1', kind: PlateKind.transport)),
    ('اعتيادية · خصوصي',
        SaudiPlate(letters: 'ك ط ع', number: '4040', format: PlateFormat.standard)),
    ('اعتيادية · نقل خاص',
        SaudiPlate(
            letters: 'ك ط ع',
            number: '4040',
            kind: PlateKind.transport,
            format: PlateFormat.standard)),
    ('رياضية · خصوصي',
        SaudiPlate(letters: 'س ع د', number: '1', format: PlateFormat.sport)),
    ('رياضية · نقل خاص',
        SaudiPlate(
            letters: 'س ع د',
            number: '1',
            kind: PlateKind.transport,
            format: PlateFormat.sport)),
    ('دراجة نارية',
        SaudiPlate(letters: 'ب ح د', number: '77', kind: PlateKind.motorcycle)),
    ('الباء والهاء معًا',
        SaudiPlate(letters: 'ب ه ا', number: '2846')),
    ('شعار رؤية 2030',
        SaudiPlate(letters: 'ر س م', number: '2030', emblem: PlateEmblem.vision)),
  ];

  return Directionality(
    textDirection: TextDirection.rtl,
    child: Container(
      width: 420,
      color: AppColors.bg,
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final (label, plate) in cases) ...[
            Text(
              label,
              style: const TextStyle(
                fontSize: 11,
                color: AppColors.neutral700,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 6),
            /// الإطارُ الداخليّ الذي تجلس فيه اللوحة داخل الكرت —
            /// انحناء ٨، خلفية `neutral-200`، حشوةٌ أفقيّة ١٠.
            Container(
              decoration: BoxDecoration(
                color: AppColors.neutral200,
                borderRadius: BorderRadius.circular(AppRadii.plateInset),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              child: plate,
            ),
            const SizedBox(height: 14),
          ],
        ],
      ),
    ),
  );
}

/// **ويُحمَّل خطُّ اللوحة الحقيقيّ قبل اللقطة.**
///
/// فبيئةُ الفحص تستبدل بكلّ خطٍّ خطًّا بديلًا يرسم كلَّ محرفٍ مربّعًا فارغًا —
/// فلقطةٌ بلا تحميلٍ تحرس التخطيطَ وحده وتكذب في الحروف. وهي أوّلُ ما تشترطه
/// الحزمة: «Arial Bold فقط».
Future<void> _loadPlateFont() async {
  final loader = FontLoader(AppFonts.plate)
    ..addFont(rootBundle.load('assets/fonts/plate-arial-bold.ttf'));
  await loader.load();
}

void main() {
  setUpAll(() async {
    /* والملفّ مستثنًى من Git — فإن غاب يُقال سببُه لا يُسقط الفحصَ بغموض */
    if (!File('assets/fonts/plate-arial-bold.ttf').existsSync()) {
      fail(
        'خطُّ اللوحة غير موجود: assets/fonts/plate-arial-bold.ttf — '
        'انظر docs/FLUTTER_APP.md لنسخه محليًّا.',
      );
    }
    await _loadPlateFont();
  });

  testWidgets('لوحُ اللوحات السعوديّة', (tester) async {
    tester.view.physicalSize = const Size(840, 4000);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      MediaQuery(
        data: const MediaQueryData(size: Size(420, 2000)),
        child: Align(alignment: Alignment.topCenter, child: _sheet()),
      ),
    );

    /*
     * **وتُحمَّل الشعاراتُ قبل اللقطة.**
     *
     * فـ`Image.asset` يفكّ الصورةَ خارج خيط الفحص، و`pumpAndSettle` لا ينتظره —
     * فتخرج اللقطةُ بفراغٍ مكانَ الشعار، وهو خمسُ خياراتٍ في اللوحة الطويلة.
     */
    await tester.runAsync(() async {
      for (final element in find.byType(Image).evaluate()) {
        final image = element.widget as Image;
        await precacheImage(image.image, element);
      }
    });
    await tester.pumpAndSettle();

    await expectLater(
      find.byType(Column).first,
      matchesGoldenFile('goldens/plates.png'),
    );
  });
}
