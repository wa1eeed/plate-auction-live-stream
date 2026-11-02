import 'package:flutter_test/flutter_test.dart';
import 'package:mazad/api/mapping.dart';
import 'package:mazad/models/listing.dart';
import 'package:mazad/widgets/plate.dart';

/// **ما يصل من الخادم يُحوَّل في موضعٍ واحد** — وبقيمه الحقيقيّة.
void main() {
  /* عيّنةٌ منسوخةٌ من ردّ `api/listings` الفعليّ */
  const sample = {
    'id': 'lst_c5c65fa80d874511be89',
    'reference': 'L26-00002',
    'plate': {
      'plateType': 'private',
      'plateFormat': 'long',
      'arabicLetters': 'رر',
      'latinLetters': 'RR',
      'plateNumbers': '77',
      'emblem': 'palm-swords-black',
      'customEmblemUrl': null,
    },
    'saleType': 'auction',
    'status': 'active',
    'displayPrice': 4500000,
    'priceLabel': 'أعلى مزايدة',
    'bidCount': 1,
    'offerCount': 0,
    'endsAt': '2026-11-05 07:42:32.351+00',
    'remainingMs': 221035025,
    'sellerName': 'سارة القحطاني',
    'isMine': false,
    'createdAt': '2026-09-20 03:53:45.393+00',
    'settlementPending': false,
  };

  test('اللوحةُ تُحوَّل بحقولها كلِّها', () {
    final l = ApiMapping.listing(Map<String, dynamic>.from(sample));
    expect(l.id, 'lst_c5c65fa80d874511be89');
    expect(l.reference, 'L26-00002');
    expect(l.letters, 'رر');
    expect(l.number, '77');
    expect(l.kind, PlateKind.private);
    expect(l.format, PlateFormat.long);
    expect(l.emblem, PlateEmblem.palm);
    expect(l.saleType, SaleType.auction);
    expect(l.price, 4500000);
    expect(l.bids, 1);
    expect(l.mine, isFalse);
  });

  /*
   * **والوقتُ يصل بصيغتين**: بفراغٍ بين التاريخ والساعة، وبـ`T`.
   *
   * و`DateTime.parse` يرفض الأولى — فلو تُركت لظهر السوقُ بلا عدّادات.
   */
  group('تحليلُ الوقت', () {
    test('يقبل صيغةَ الفراغ', () {
      final t = ApiMapping.time('2026-11-05 07:42:32.351+00');
      expect(t, isNotNull);
      expect(t!.toUtc().year, 2026);
      expect(t.toUtc().month, 11);
      expect(t.toUtc().day, 5);
      expect(t.toUtc().hour, 7);
    });

    test('ويقبل صيغةَ T', () {
      expect(ApiMapping.time('2026-11-02T18:18:48.203Z'), isNotNull);
    });

    test('وما ليس وقتًا يُرجع null لا يرمي', () {
      expect(ApiMapping.time(null), isNull);
      expect(ApiMapping.time(''), isNull);
      expect(ApiMapping.time('ليس وقتًا'), isNull);
      expect(ApiMapping.time(42), isNull);
    });
  });

  /// **وما لا يُعرف يُردّ إلى الافتراضيّ** — لا يُفرغ السوق.
  group('القيمُ المجهولة', () {
    test('شعارٌ جديدٌ يُرسم بالنخلة', () {
      expect(ApiMapping.emblem('شيء-جديد'), PlateEmblem.palm);
      expect(ApiMapping.emblem(null), PlateEmblem.palm);
    });

    test('وإصدارٌ جديدٌ يُرسم طويلة', () {
      expect(ApiMapping.format('unknown'), PlateFormat.long);
    });

    test('ونوعٌ جديدٌ يُرسم خصوصي', () {
      expect(ApiMapping.kind('taxi'), PlateKind.private);
    });
  });

  test('وكلُّ شعارٍ معروفٍ يُحوَّل', () {
    expect(ApiMapping.emblem('palm-swords-gold'), PlateEmblem.gold);
    expect(ApiMapping.emblem('vision-2030'), PlateEmblem.vision);
    expect(ApiMapping.emblem('dereyah'), PlateEmblem.dereyah);
    expect(ApiMapping.emblem('madaen'), PlateEmblem.madaen);
  });

  test('وحقولٌ ناقصةٌ لا تُسقط التحويل', () {
    final l = ApiMapping.listing(const {});
    expect(l.id, '');
    expect(l.letters, '');
    expect(l.price, 0);
    expect(l.endsAt, isNull);
  });
}
