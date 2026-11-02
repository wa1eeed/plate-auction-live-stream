import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mazad/design/tokens.dart';
import 'package:mazad/widgets/plate.dart';

/// **لوحُ مقارنةِ خطّ اللوحة** — لا يحرس شيئًا، يُري الفرقَ بالعين.
///
/// والحزمةُ تشترط Arial Bold، وهو مُلكُ Monotype لا يُشحن بلا ترخيص.
/// فالسؤالُ الذي يُجاب هنا: ماذا يُفقد لو شُحن بديلٌ حرٌّ بدله؟
///
/// **ولا يلزم تغييرُ المكوّن**: `FontLoader` يسجّل الملفَّ تحت اسم عائلةٍ
/// نُسمّيه نحن — فيُحمَّل البديلُ تحت [AppFonts.plate] نفسِه، فترسم اللوحةُ
/// به وهي لا تدري.
///
/// **ولكلّ خطٍّ ملفُّ فحصٍ مستقلّ**، لأنّ `flutter test` يُجري كلَّ ملفٍّ في
/// عزلته: وتسجيلُ عائلتين باسمٍ واحدٍ في عمليّةٍ واحدة يُبقي الأوّلَ غالبًا،
/// فتخرج اللقطتان متطابقتين ويُظنّ أن لا فرق. وقع ذلك فعلًا.
Future<void> loadPlateFont(String file) async {
  if (!File(file).existsSync()) fail('ناقصٌ: $file — انظر docs/FLUTTER_APP.md');
  await (FontLoader(AppFonts.plate)..addFont(rootBundle.load(file))).load();
}

const _cases = <SaudiPlate>[
  SaudiPlate(letters: 'ق و س', number: '4040'),
  SaudiPlate(letters: 'ك ط ع', number: '1234', format: PlateFormat.standard),
  SaudiPlate(letters: 'ب ه ص', number: '2846'),
];

Future<void> shootPlateSheet(WidgetTester tester, String name) async {
  tester.view.physicalSize = const Size(800, 1100);
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    Directionality(
      textDirection: TextDirection.rtl,
      child: MediaQuery(
        data: const MediaQueryData(size: Size(400, 550)),
        child: Align(
          alignment: Alignment.topCenter,
          child: Container(
            width: 400,
            color: AppColors.bg,
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (final p in _cases) ...[
                  Container(
                    decoration: BoxDecoration(
                      color: AppColors.neutral200,
                      borderRadius: BorderRadius.circular(AppRadii.plateInset),
                    ),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 8,
                    ),
                    child: p,
                  ),
                  const SizedBox(height: 16),
                ],
              ],
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
  await tester.pumpAndSettle();
  await expectLater(
    find.byType(Column).first,
    matchesGoldenFile('goldens/$name.png'),
  );
}
