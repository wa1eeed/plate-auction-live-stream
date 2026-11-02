import 'package:flutter_test/flutter_test.dart';
import 'package:mazad/models/plate_query.dart';

/// **البحثُ يقبل ما يحضر المستخدمَ** — عربيًّا أو لاتينيًّا أو بأرقامٍ عربيّة.
void main() {
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
