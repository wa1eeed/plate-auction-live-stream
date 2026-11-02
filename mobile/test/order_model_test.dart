import 'package:flutter_test/flutter_test.dart';
import 'package:mazad/models/order.dart';
import 'package:mazad/widgets/plate.dart';

final _t0 = DateTime(2026, 10, 30, 1, 2, 14);

OrderView _order({
  required OrderStage stage,
  bool buyer = true,
  DateTime? paid,
  DateTime? identity,
  DateTime? transfer,
  DateTime? released,
}) => OrderView(
  id: 'ord_1',
  reference: 'S26-00087',
  stage: stage,
  source: 'مزاد',
  letters: 'ق و س',
  number: '1',
  plateKind: PlateKind.private,
  format: PlateFormat.long,
  emblem: PlateEmblem.palm,
  price: 4100000,
  buyerName: 'وليد (أنت)',
  sellerName: 'فهد ع*****',
  youAreBuyer: buyer,
  createdAt: _t0,
  paidAt: paid,
  identityAt: identity,
  transferAt: transfer,
  releasedAt: released,
);

void main() {
  /// **وحالُ كلّ محطّةٍ مشتقٌّ من المرحلة لا محفوظٌ معها.**
  ///
  /// فحقلٌ يُكتب لكلّ محطّةٍ يُنسى تحديثُه مرّةً فتتناقض السكّةُ مع الحال.
  group('سكّةُ المحطّات الخمس', () {
    test('عند السداد: الأولى تمّت والثانية جارية', () {
      final s = _order(stage: OrderStage.pay).stations;
      expect(s.map((e) => e.label).toList(), [
        'طلب',
        'سداد',
        'نقل',
        'تأكيد',
        'تم',
      ]);
      expect(s[0].state, StationState.current);
      expect(s[1].state, StationState.pending);
    });

    test('وعند النقل: ما قبلها تمّ وهي جارية وما بعدها منتظر', () {
      final s = _order(
        stage: OrderStage.transfer,
        paid: _t0,
        identity: _t0,
      ).stations;
      expect(s[0].state, StationState.done);
      expect(s[1].state, StationState.done);
      expect(s[2].state, StationState.current);
      expect(s[3].state, StationState.pending);
      expect(s[4].state, StationState.pending);
    });

    test('وعند التمام: الخمسُ كلُّها تمّت', () {
      final s = _order(
        stage: OrderStage.done,
        paid: _t0,
        identity: _t0,
        transfer: _t0,
        released: _t0,
      ).stations;
      expect(s.every((e) => e.state == StationState.done), isTrue);
    });

    /*
     * **والمتعثّرةُ تقف عند آخر ما وقع** وتُوسَم التاليةُ حمراء — فمن يفتحها
     * بعد شهرٍ يرى أين انقطعت، لا سكّةً رماديّةً كاملة.
     */
    test('والمُغلقةُ تُوسَم التاليةَ متعثّرة', () {
      final s = _order(stage: OrderStage.defaulted).stations;
      expect(s[0].state, StationState.done, reason: 'الطلبُ وقع');
      expect(s[1].state, StationState.failed, reason: 'السدادُ تعثّر');
      expect(s[2].state, StationState.pending);
    });

    test('ونسبةُ الامتلاء تتبع ما تمّ', () {
      expect(_order(stage: OrderStage.pay).fill, 0);
      expect(
        _order(stage: OrderStage.transfer, paid: _t0, identity: _t0).fill,
        0.5,
      );
    });
  });

  /// **والنصوصُ بصيغة المخاطب، ولكلّ دورٍ نصُّه.**
  group('نصوصُ المرحلة بالدور', () {
    test('المشتري في مرحلة البيانات يُنادى هو', () {
      expect(_order(stage: OrderStage.id).stageName, 'بانتظارك لتأكيد بياناتك');
    });

    test('والبائعُ في المرحلة نفسِها ينتظر', () {
      expect(
        _order(stage: OrderStage.id, buyer: false).stageName,
        'بانتظار بيانات المشتري',
      );
    });

    test('وفي مرحلة النقل ينقلب الدور', () {
      expect(
        _order(stage: OrderStage.transfer).stageName,
        'الدور على البائع: نقل الملكية في أبشر',
      );
      expect(
        _order(stage: OrderStage.transfer, buyer: false).stageName,
        'بانتظارك لنقل الملكية',
      );
    });
  });

  /// **و«أين المال» جملةٌ صريحةٌ لا حالةٌ تُؤوَّل.**
  group('أين المال', () {
    test('قبل السداد لم يغادر محفظة المشتري', () {
      expect(
        _order(stage: OrderStage.pay).moneyLine,
        'لم يغادر المبلغ محفظتك بعد',
      );
      expect(
        _order(stage: OrderStage.pay, buyer: false).moneyLine,
        'لم يسدّد المشتري بعد',
      );
    });

    test('وبينهما محجوزٌ أمانةً لدى المنصّة', () {
      for (final stage in [
        OrderStage.id,
        OrderStage.transfer,
        OrderStage.review,
      ]) {
        expect(
          _order(stage: stage).moneyLine,
          'المبلغ محجوز أمانةً لدى المنصّة',
        );
      }
    });

    test('وبعد التمام يختلف بالدور', () {
      expect(_order(stage: OrderStage.done).moneyLine, 'ذهب المبلغ إلى البائع');
      expect(
        _order(stage: OrderStage.done, buyer: false).moneyLine,
        'وصل عائدك إلى محفظتك',
      );
    });
  });
}
