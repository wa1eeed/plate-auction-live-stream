import 'package:flutter_test/flutter_test.dart';

import 'font_sheet.dart';

/// اللوحةُ بـ**Arial Bold** — ما صُمّم، ويحتاج ترخيصًا للشحن.
void main() {
  testWidgets('لوحُ Arial Bold', (tester) async {
    await loadPlateFont('assets/fonts/plate-arial-bold.ttf');
    await shootPlateSheet(tester, 'font-arial');
  });
}
