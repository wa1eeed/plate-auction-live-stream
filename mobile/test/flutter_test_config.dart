import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';

/// **إعدادُ الحزمة كلِّها** — يُنادى قبل كلّ ملفّ فحصٍ في `test/`.
///
/// **واللوحاتُ تُقارَن بحدٍّ لا بتطابقٍ تامّ.**
///
/// فراسمُ الخطوط يختلف بين جهازٍ وآخرَ وبين إصدارَي نظام: اللوحاتُ وُلّدت
/// على macOS هنا، وخادمُ البوّابة يرسم بفروقٍ لا تُرى — ‎٣٣‎ إلى ‎٦٣‎ بكسلًا
/// من ستّمئة ألف، أي ‎٠٫٠١٪‎. فكانت الحزمةُ تسقط في البوّابة وهي سليمة.
///
/// **والحدُّ ‎٠٫٢٪‎ يُفرّق الضوضاءَ من الانحدار**: عنصرٌ يتزحزح أو لونٌ يتبدّل
/// أو نصٌّ يتغيّر يُنتج آلافَ البكسلات — عشراتِ الأضعاف. وما دون ذلك ليس
/// تغييرًا في التصميم بل في الراسم.
///
/// **ولا تُعطَّل اللوحاتُ في البوّابة**: عطبُ تخطيطٍ يُدخله تعديلٌ في مكتبةٍ
/// أو ترقيةُ Flutter لا يكشفه فحصُ أنواعٍ ولا فحصُ وجودِ نصّ — واللوحةُ
/// وحدها تراه.
Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  /*
   * **ومجلّدُ الأساس يُؤخذ من المقارِن القائم لا يُبنى بيد.**
   *
   * فـ`flutter_test` يضع مقارِنًا موجَّهًا إلى ملفّ الفحص الجاري، ومنه
   * يُشتقّ المجلّد. وبناؤه من `Directory.current` يُخطئ حين يُستدعى الفحصُ
   * من جذر المشروع لا من `test/` — فلا تُوجد اللوحاتُ أصلًا، وتسقط كلُّها
   * بـ«ملفٌّ غير موجود» بدل أن تُقارَن.
   */
  final current = goldenFileComparator;
  if (current is LocalFileComparator) {
    goldenFileComparator = _Tolerant(
      Uri.parse('${current.basedir}placeholder.dart'),
      0.002,
    );
  }
  await testMain();
}

class _Tolerant extends LocalFileComparator {
  _Tolerant(super.testFile, this.tolerance);

  /// الكسرُ المسموح من مجموع البكسلات.
  final double tolerance;

  @override
  Future<bool> compare(Uint8List imageBytes, Uri golden) async {
    final result = await GoldenFileComparator.compareLists(
      imageBytes,
      await getGoldenBytes(golden),
    );

    if (result.passed || result.diffPercent <= tolerance) {
      result.dispose();
      return true;
    }

    final error = await generateFailureOutput(result, golden, basedir);
    result.dispose();
    throw FlutterError(error);
  }
}
