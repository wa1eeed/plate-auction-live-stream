import 'package:flutter_test/flutter_test.dart';
import 'package:mazad/models/iban.dart';

/// **الآيبان يُنسَّق وأنت تكتب، ورسالةُ خطئه تقول ما ينقص.**
void main() {
  const good = 'SA0380000000608010167519';

  group('التنسيق', () {
    test('مجموعاتٌ من أربعة', () {
      expect(Iban.format(good), 'SA03 8000 0000 6080 1016 7519');
    });

    test('ويُقبل الملصوقُ بمسافاته وصغيرِ حروفه', () {
      expect(Iban.normalize('sa03 8000 0000 6080 1016 7519'), good);
      expect(Iban.isValid('sa03-8000-0000-6080-1016-7519'), isTrue);
    });
  });

  group('الصحّة', () {
    test('SA ثمّ اثنان وعشرون رقمًا', () {
      expect(Iban.isValid(good), isTrue);
      expect(Iban.isValid('SA038000000060801016751'), isFalse);
      expect(Iban.isValid('AE0380000000608010167519'), isFalse);
    });
  });

  /*
   * **ورسالةُ الخطأ تقول ما ينقص** — لا «آيبان غير صحيح».
   *
   * فمن كتب ثمانيةَ عشرَ رقمًا يريد أن يعرف كم بقي، لا أن يُعيد العدّ.
   */
  group('رسالةُ الخطأ', () {
    test('الفارغُ بلا رسالة — لا يُوبَّخ من لم يبدأ', () {
      expect(Iban.error(''), isNull);
    });

    test('وتقول كم بقي', () {
      expect(Iban.error('SA038000000060'), 'بقي 10 رقمًا');
    });

    test('وتقول كم زاد', () {
      expect(Iban.error('${good}99'), 'زادت 2 أرقام');
    });

    test('وتقول إن لم يبدأ بـ SA', () {
      expect(Iban.error('AE03'), 'يبدأ الآيبان السعودي بـ SA');
    });

    test('والمكتملُ بلا رسالة', () {
      expect(Iban.error(good), isNull);
    });
  });

  /// **واسمُ البنك من رمزه** — فيُطمئن من لصق آيبانًا أنّه آيبانُ بنكه.
  group('اسمُ البنك', () {
    test('يُشتقّ من رمزه فورَ اكتماله', () {
      expect(Iban.bankName(good), 'مصرف الراجحي');
      expect(Iban.bankName('SA6510'), 'البنك الأهلي السعودي');
    });

    test('ولا يُقال قبل اكتمال الرمز', () {
      expect(Iban.bankName('SA03'), isNull);
    });
  });

  /// **ويُحفظ مقنّعًا** — آخرُ أربعةٍ وحدها.
  test('التقنيعُ يُبقي الأوّلَ والآخر', () {
    expect(Iban.mask(good), 'SA03 •••• •••• 7519');
  });
}
