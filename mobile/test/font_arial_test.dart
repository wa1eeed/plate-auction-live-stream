import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import 'font_sheet.dart';

/// اللوحةُ بـ**Arial Bold** — ما صُمّم، وما يراه مستخدمُ iOS.
///
/// **ولا يُحزم الملفُّ في المستودع**: أبل تردّ تضمينَ Arial
/// (`ITMS-91198: Disallowed font`)، فهي تُرخّصه لنظامها وحده. ويُرسم في
/// iOS من خطوط النظام، ويُحزم Noto لمن لا Arial عنده.
///
/// فهذا اللوحُ **للمقارنة البصريّة عند من عنده الملفّ** — يُنسخ بـ
/// `tool/setup-fonts.sh` — ويُعلَّق عند غيره بدل أن يُسقط الحزمة.
void main() {
  testWidgets('لوحُ Arial Bold', (tester) async {
    const file = 'assets/fonts/plate-arial-bold.ttf';
    if (!File(file).existsSync()) {
      markTestSkipped('$file غيرُ موجود — وهو لا يُحزم ولا يُشحن');
      return;
    }
    await loadPlateFont(file);
    await shootPlateSheet(tester, 'font-arial');
  });
}
