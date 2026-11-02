import 'package:flutter_test/flutter_test.dart';
import 'package:mazad/widgets/listing/bid_log.dart';

/// **الاسمُ يُقنَّع، والوقتُ كاملٌ بصيغةِ ‎١٢‎ ساعة.**
void main() {
  group('تقنيعُ الاسم', () {
    test('يُبقي الاسمَ الأوّلَ وحرفَ الثاني', () {
      expect(maskName('خالد عبدالله'), 'خالد ع*****');
    });

    test('واسمٌ واحدٌ يُستر ما بعد حرفين', () {
      expect(maskName('سعد'), 'سع*');
    });

    test('ولا يُستر ما طولُه حرفان', () {
      expect(maskName('سع'), 'سع');
    });

    test('ويُحتمل الفراغُ بلا سقوط', () {
      expect(maskName('   '), '—');
    });
  });

  /*
   * **والوقتُ كاملٌ لا نسبيّ.**
   *
   * «قبل ساعتين» لا يُحتجّ به حين يُختلف في مزاد، والكشفُ يُراجَع بعد شهر.
   */
  group('ختمُ الوقت', () {
    test('بصيغةِ dd/mm/yyyy · hh:mm:ss ص|م', () {
      expect(formatStamp(DateTime(2026, 11, 2, 13, 2, 14)),
          '02/11/2026 · 01:02:14 م');
      expect(formatStamp(DateTime(2026, 1, 9, 5, 29, 53)),
          '09/01/2026 · 05:29:53 ص');
    });

    test('ومنتصفُ الليل ١٢ ص لا ٠٠', () {
      expect(formatStamp(DateTime(2026, 11, 2, 0, 5, 1)),
          '02/11/2026 · 12:05:01 ص');
    });

    test('والظهرُ ١٢ م', () {
      expect(formatStamp(DateTime(2026, 11, 2, 12, 0, 0)),
          '02/11/2026 · 12:00:00 م');
    });
  });
}
