import 'package:flutter_test/flutter_test.dart';
import 'package:mazad/models/plate_query.dart';

/// **البحثُ يقبل ما يحضر المستخدمَ** — عربيًّا أو لاتينيًّا أو بأرقامٍ عربيّة.
void main() {
  _spec13();
  group('تطبيعُ ما كُتب', () {
    test('العربيُّ يُقرأ كما هو', () {
      final q = PlateQuery.parse('سعد');
      expect(q.letters, ['س', 'ع', 'د']);
      expect(q.latin, 'SED');
      expect(q.digits, '');
    });

    test('واللاتينيُّ يُردّ إلى مقابله العربيّ', () {
      expect(PlateQuery.parse('SED').letters, ['س', 'ع', 'د']);
      /* وصغيرُ الحروف مثلُ كبيرها — لا يُطالَب المستخدم بالضغط على Shift */
      expect(PlateQuery.parse('sed').letters, ['س', 'ع', 'د']);
    });

    test('والأرقامُ العربيّةُ تصير غربيّة', () {
      expect(PlateQuery.parse('١').digits, '1');
      expect(PlateQuery.parse('٤٠٤٠').digits, '4040');
    });

    test('ويُقرأ المختلطُ: حروفٌ وأرقامٌ معًا', () {
      final q = PlateQuery.parse('سعد ١');
      expect(q.letters, ['س', 'ع', 'د']);
      expect(q.digits, '1');
    });

    /*
     * **وأشكالُ الحرف تُردّ إلى صورته على اللوحة.**
     *
     * فاللوحةُ تحمل «ا» و«ه» و«ى»، والناسُ يكتبون «أ» و«ة» و«ي» — ومن كتب
     * «أ» يريد لوحةَ «ا»، ولو قُورن حرفًا بحرفٍ لم يجد شيئًا.
     */
    test('والهمزةُ والتاءُ المربوطةُ والياءُ تُردّ إلى صور اللوحة', () {
      expect(PlateQuery.parse('أ').letters, ['ا']);
      expect(PlateQuery.parse('ة').letters, ['ه']);
      expect(PlateQuery.parse('ي').letters, ['ى']);
    });

    test('وما ليس من السبعةَ عشر يُهمَل', () {
      /* «ج» ليست من حروف اللوحات — فلا تُقحَم في البحث */
      expect(PlateQuery.parse('جج').letters, isEmpty);
    });
  });

  group('المطابقة', () {
    bool hit(String query, {String letters = 'س ع د', String number = '1'}) =>
        PlateQuery.parse(query)
            .matches(plateLetters: letters, plateNumber: number);

    test('استعلامٌ فارغٌ يُطابق كلَّ شيء', () {
      expect(hit(''), isTrue);
    });

    test('والمطابقةُ احتواءٌ بالترتيب لا تساوٍ', () {
      expect(hit('س'), isTrue, reason: 'من كتب «س» يريد كلَّ لوحةٍ فيها سين');
      expect(hit('سد'), isTrue, reason: 'بترتيبها ولو تخلّلها غيرُها');
      expect(hit('دس'), isFalse, reason: 'والترتيبُ معتبر');
    });

    test('والرقمُ يُطابق جزءًا من الرقم', () {
      expect(hit('4', number: '4040'), isTrue);
      expect(hit('404', number: '4040'), isTrue);
      expect(hit('77', number: '4040'), isFalse);
    });

    test('ويُطابق الحرفُ والرقمُ معًا', () {
      expect(hit('سعد 1'), isTrue);
      expect(hit('سعد 9'), isFalse);
    });

    test('واللاتينيُّ يُطابق لوحةً عربيّة', () {
      expect(hit('SED'), isTrue);
    });
  });
}

/// **ما نصّت عليه §١٣ من حزمة التسليم** — البندُ المُلزِم.
///
/// «يطابق الحروف بالترتيب ولو غير متجاورة (س+د تجد «س ع د»)، ويقبل حرفًا أو
/// أكثر أو أرقامًا وحدها أو الاثنين، عربيًا أو لاتينيًا أو بأرقام عربية،
/// ويتجاهل المسافات و«ـ». الترتيب: تطابق تام ← يبدأ بـ ← يحتوي متجاورًا ←
/// الباقي.»
void _spec13() {
  bool hit(String q, String letters, String number) =>
      PlateQuery.parse(q).matches(plateLetters: letters, plateNumber: number);

  int tier(String q, String letters, String number) =>
      PlateQuery.parse(q).relevance(plateLetters: letters, plateNumber: number);

  group('§١٣ — المطابقة', () {
    test('حرفان غيرُ متجاورين يجدان الثالثيّة', () {
      expect(hit('سد', 'س ع د', '1'), isTrue);
      /* وبالترتيب لا بالاجتماع: «د س» ليست «س ع د» */
      expect(hit('دس', 'س ع د', '1'), isFalse);
    });

    test('وحرفٌ واحدٌ يكفي', () => expect(hit('س', 'س ع د', '1'), isTrue));

    test('وأرقامٌ وحدها', () {
      expect(hit('1', 'س ع د', '415'), isTrue);
      expect(hit('٤١', 'س ع د', '415'), isTrue);
    });

    test('والاثنان معًا', () {
      expect(hit('س 1', 'س ع د', '415'), isTrue);
      expect(hit('س 9', 'س ع د', '415'), isFalse);
    });

    test('واللاتينيُّ كالعربيّ', () {
      expect(hit('SD', 'س ع د', '1'), isTrue);
      expect(hit('sed', 'س ع د', '1'), isTrue);
    });

    test('وتُتجاهل المسافاتُ والتطويل', () {
      expect(hit('س  د', 'س ع د', '1'), isTrue);
      expect(hit('سـعـد', 'س ع د', '1'), isTrue);
      expect(hit('س-د', 'س ع د', '1'), isTrue);
    });
  });

  group('§١٣ — الترتيب', () {
    test('تطابقٌ تامٌّ ثمّ يبدأ بـ ثمّ متجاورٌ ثمّ الباقي', () {
      /* الاستعلامُ «س د» على أربع لوحات */
      expect(tier('سد', 'س د', '1'), 0, reason: 'تطابقٌ تامّ');
      expect(tier('سد', 'س د ر', '1'), 1, reason: 'يبدأ بـ');
      expect(tier('سد', 'ر س د', '1'), 2, reason: 'يحتوي متجاورًا');
      expect(tier('سد', 'س ع د', '1'), 3, reason: 'بالترتيب غيرَ متجاور');
    });

    test('والأرقامُ لها الرتبُ نفسُها', () {
      expect(tier('41', 'س ع د', '41'), 0);
      expect(tier('41', 'س ع د', '415'), 1);
      expect(tier('41', 'س ع د', '941'), 2);
    });

    /// **والرتبةُ أسوأُ الجزأين** — فحروفٌ تامّةٌ لا تشفع لرقمٍ بعيد.
    test('وأسوأُ الجزأين هو الرتبة', () {
      expect(tier('سعد 1', 'س ع د', '1'), 0);
      expect(tier('سعد 1', 'س ع د', '15'), 1);
      expect(tier('سعد 1', 'س ع د', '915'), 2);
    });

    test('وبلا بحثٍ تستوي اللوحاتُ كلُّها', () {
      expect(tier('', 'س ع د', '1'), 0);
      expect(tier('', 'ر ر ر', '9999'), 0);
    });
  });
}
