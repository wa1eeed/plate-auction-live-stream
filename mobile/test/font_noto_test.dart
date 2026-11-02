import 'package:flutter_test/flutter_test.dart';

import 'font_sheet.dart';

/// اللوحةُ بـ**Noto Sans Arabic Bold** — حرٌّ (OFL)، يُشحن بلا قيد.
void main() {
  testWidgets('لوحُ Noto Sans Arabic', (tester) async {
    await loadPlateFont('assets/fonts/plate-noto-bold.ttf');
    await shootPlateSheet(tester, 'font-noto');
  });
}
