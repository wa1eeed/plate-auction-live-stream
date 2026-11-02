import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mazad/design/tokens.dart';
import 'package:mazad/models/wallet.dart';
import 'package:mazad/widgets/wallet/top_up_sheet.dart';

import 'font_sheet.dart';

const _bank = BankDetails(
  name: 'مصرف الراجحي',
  accountName: 'سوق تداول اللوحات',
  iban: 'SA0380000000608010167519',
  accountNumber: '608010167519',
  instructions: 'اكتب رقم العملية في خانة الملاحظات.',
);

/// يفتح الورقةَ ويُعيد ما اختاره المستخدم.
Future<TopUpChoice?> _open(WidgetTester tester, PaymentOptions options) async {
  TopUpChoice? picked;

  await tester.pumpWidget(
    MaterialApp(
      debugShowCheckedModeBanner: false,
      home: Directionality(
        textDirection: TextDirection.rtl,
        child: Scaffold(
          backgroundColor: AppColors.bg,
          body: Builder(
            builder: (context) => Center(
              child: GestureDetector(
                onTap: () async =>
                    picked = await showTopUpSheet(context, options),
                child: const Text('افتح'),
              ),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pump(const Duration(milliseconds: 200));
  await tester.tap(find.text('افتح'));
  await tester.pumpAndSettle();
  return picked;
}

void main() {
  setUpAll(loadAllFonts);

  /// **ثلاثةُ مبالغَ كما في التصميم** — ‎٥٬٠٠٠‎ و‎١٠٬٠٠٠‎ و‎٢٥٬٠٠٠‎.
  testWidgets('المبالغُ الثلاثةُ تُعرض', (tester) async {
    await _open(
      tester,
      const PaymentOptions(cardEnabled: true, bankEnabled: false),
    );

    expect(find.text('اشحن رصيدك'), findsOneWidget);
    expect(find.text('5,000'), findsOneWidget);
    expect(find.text('10,000'), findsOneWidget);
    expect(find.text('25,000'), findsOneWidget);
  });

  /// **ولا يُؤكَّد قبل اختيار مبلغ.**
  testWidgets('الزرُّ يقول «اختر مبلغًا» حتّى يُختار', (tester) async {
    await _open(
      tester,
      const PaymentOptions(cardEnabled: true, bankEnabled: false),
    );
    expect(find.text('اختر مبلغًا'), findsOneWidget);

    await tester.tap(find.text('10,000'));
    await tester.pumpAndSettle();
    expect(find.text('ادفع 10,000 ر.س'), findsOneWidget);
  });

  testWidgets('وما يُختار يعود للمنادي', (tester) async {
    TopUpChoice? got;
    await tester.pumpWidget(
      MaterialApp(
        home: Directionality(
          textDirection: TextDirection.rtl,
          child: Scaffold(
            body: Builder(
              builder: (context) => Center(
                child: GestureDetector(
                  onTap: () async => got = await showTopUpSheet(
                    context,
                    const PaymentOptions(cardEnabled: true, bankEnabled: false),
                  ),
                  child: const Text('افتح'),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 200));
    await tester.tap(find.text('افتح'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('25,000'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('ادفع 25,000 ر.س'));
    await tester.pumpAndSettle();

    expect(got, (25000, true));
  });

  /// **ولا تُعرض طريقةٌ أطفأتها الإدارة** — ولا يُسأل عن خيارٍ واحد.
  group('الطرائقُ تتبع الخادم', () {
    testWidgets('بطاقةٌ وحدها: لا سؤالَ ولا آيبان', (tester) async {
      await _open(
        tester,
        const PaymentOptions(cardEnabled: true, bankEnabled: false),
      );
      expect(find.text('بطاقة'), findsNothing);
      expect(find.text('حوالة'), findsNothing);
      expect(find.textContaining('SA03'), findsNothing);
    });

    testWidgets('وحوالةٌ وحدها: الآيبانُ ظاهرٌ قبل التأكيد', (tester) async {
      await _open(
        tester,
        const PaymentOptions(
          cardEnabled: false,
          bankEnabled: true,
          bank: _bank,
        ),
      );

      expect(find.text('مصرف الراجحي'), findsOneWidget);
      expect(find.text('SA0380000000608010167519'), findsOneWidget);
      expect(find.textContaining('توثيق الإدارة'), findsOneWidget);

      await tester.tap(find.text('5,000'));
      await tester.pumpAndSettle();
      /* ونصُّ الزرّ يتبع الطريقة — لا «ادفع» لحوالةٍ تُسجَّل */
      expect(find.text('سجّل حوالة 5,000 ر.س'), findsOneWidget);
    });

    testWidgets('والاثنتان: يُسأل ويتبدّل النصّ', (tester) async {
      await _open(
        tester,
        const PaymentOptions(cardEnabled: true, bankEnabled: true, bank: _bank),
      );

      expect(find.text('بطاقة'), findsOneWidget);
      expect(find.text('حوالة'), findsOneWidget);
      /* والبطاقةُ أوّلًا — فالآيبانُ مستورٌ حتّى تُختار الحوالة */
      expect(find.text('SA0380000000608010167519'), findsNothing);

      await tester.tap(find.text('حوالة'));
      await tester.pumpAndSettle();
      expect(find.text('SA0380000000608010167519'), findsOneWidget);
    });

    /// **ولا طريقةَ مفعّلة: يُقال ذلك ولا تُعرض مبالغُ لا تُشحن.**
    testWidgets('ولا شيء: تُقال العلّةُ بلا أزرار', (tester) async {
      await _open(
        tester,
        const PaymentOptions(cardEnabled: false, bankEnabled: false),
      );

      expect(find.textContaining('لا طريقة شحن مفعّلة'), findsOneWidget);
      expect(find.text('5,000'), findsNothing);
      expect(find.text('اختر مبلغًا'), findsNothing);
    });
  });

  testWidgets('لوحُ ورقة الشحن', (tester) async {
    tester.view.physicalSize = const Size(780, 1688);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);

    await _open(
      tester,
      const PaymentOptions(cardEnabled: true, bankEnabled: true, bank: _bank),
    );
    await tester.tap(find.text('10,000'));
    await tester.pumpAndSettle();

    await expectLater(
      find.byType(BottomSheet),
      matchesGoldenFile('goldens/top-up.png'),
    );
  });
}
