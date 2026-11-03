import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mazad/design/tokens.dart';
import 'package:mazad/models/checkout.dart';
import 'package:mazad/models/wallet.dart';
import 'package:mazad/widgets/order/birth_date_field.dart';
import 'package:mazad/widgets/order/identity_form.dart';
import 'package:mazad/widgets/order/pay_sheet.dart';

import 'font_sheet.dart';

Widget _host(void Function(BuildContext) open) => MaterialApp(
  debugShowCheckedModeBanner: false,
  home: Directionality(
    textDirection: TextDirection.rtl,
    child: Builder(
      builder: (context) => Scaffold(
        backgroundColor: AppColors.bg,
        body: Center(
          child: GestureDetector(
            onTap: () => open(context),
            child: const Text('افتح'),
          ),
        ),
      ),
    ),
  ),
);

final _info = CheckoutInfo(
  due: 4183700,
  price: 4100000,
  depositApplied: 500000,
  commission: 583700,
  availableHalalas: 10355100,
  plateLabel: 'ق و س 1',
  sellerName: 'فهد ع*****',
  methods: const [
    PayOption(
      method: PayMethod.wallet,
      label: 'رصيد المحفظة',
      available: true,
      hint: 'رصيدك المتاح 103,551 ريال — يُخصم فورًا وتكتمل الصفقة',
    ),
    PayOption(
      method: PayMethod.card,
      label: 'بطاقة عبر Tap',
      available: true,
      hint: 'تحويل إلى صفحة الدفع الآمنة ثم العودة',
    ),
    PayOption(
      method: PayMethod.bank,
      label: 'حوالة بنكية',
      available: false,
      hint: 'غير مفعّلة حاليًا',
    ),
  ],
  bank: const BankDetails(
    name: 'مصرف الراجحي',
    accountName: 'شركة سكاي',
    iban: 'SA80 8000 0000 6080 1016 2300',
    accountNumber: '608010162300',
    instructions: '',
  ),
);

void main() {
  setUpAll(loadAllFonts);

  testWidgets('لوحُ ورقة السداد', (tester) async {
    tester.view.physicalSize = const Size(780, 1688);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(_host((c) => showPaySheet(c, _info)));
    await tester.tap(find.text('افتح'));
    await tester.pumpAndSettle();

    await expectLater(
      find.byType(BottomSheet),
      matchesGoldenFile('goldens/pay_sheet.png'),
    );
  });

  /// **والمطلوبُ يأتي محسوبًا من الخادم، وتفصيلُه تحته.**
  testWidgets('الورقةُ تعرض المطلوبَ وتفصيلَه', (tester) async {
    await tester.pumpWidget(_host((c) => showPaySheet(c, _info)));
    await tester.tap(find.text('افتح'));
    await tester.pumpAndSettle();

    expect(find.text('41,837 ر.س'), findsOneWidget);
    expect(find.text('41,000'), findsOneWidget, reason: 'قيمة اللوحة');
    expect(find.text('−5,000'), findsOneWidget, reason: 'العربون المخصوم');
    expect(find.text('5,837'), findsOneWidget, reason: 'العمولة وضريبتها');
  });

  /// **وأوّلُ وسيلةٍ متاحةٍ تُختار سلفًا**، والمعطَّلةُ لا تُختار.
  testWidgets('المعطَّلةُ تظهر بسببها ولا تُختار', (tester) async {
    PayMethod? picked;
    await tester.pumpWidget(
      _host((c) => showPaySheet(c, _info).then((m) => picked = m)),
    );
    await tester.tap(find.text('افتح'));
    await tester.pumpAndSettle();

    expect(find.text('غير مفعّلة حاليًا'), findsOneWidget);
    await tester.tap(find.text('حوالة بنكية'));
    await tester.pump();
    expect(find.text('ادفع 41,837 ر.س من محفظتك'), findsOneWidget);

    await tester.tap(find.text('بطاقة عبر Tap'));
    await tester.pump();
    await tester.tap(find.text('افتح صفحة الدفع'));
    await tester.pumpAndSettle();
    expect(picked, PayMethod.card);
  });

  testWidgets('لوحُ منتقي التاريخ', (tester) async {
    tester.view.physicalSize = const Size(780, 1688);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      _host((c) => showBirthDateSheet(c, BirthCalendar.hijri, null)),
    );
    await tester.tap(find.text('افتح'));
    await tester.pumpAndSettle();

    await expectLater(
      find.byType(BottomSheet),
      matchesGoldenFile('goldens/birth_sheet.png'),
    );
  });

  /// **ولا شهرَ ثلاثةَ عشر ولا ‎٣٠‎ فبراير** — وهو ما يُسقطه الانتقاء.
  testWidgets('الميلاديُّ يحدّ الأيّامَ بطول الشهر', (tester) async {
    BirthDate? picked;
    await tester.pumpWidget(
      _host(
        (c) => showBirthDateSheet(
          c,
          BirthCalendar.gregorian,
          null,
        ).then((d) => picked = d),
      ),
    );
    await tester.tap(find.text('افتح'));
    await tester.pumpAndSettle();

    /* ‎١٩٩٠‎ ليست كبيسة، ففبراير ‎٢٨‎ يومًا */
    expect(find.text('يناير'), findsOneWidget);
    await tester.drag(find.text('يناير'), const Offset(0, -40));
    await tester.pumpAndSettle();
    expect(find.text('فبراير'), findsOneWidget);

    await tester.tap(find.textContaining('اختر 1 فبراير 1990'));
    await tester.pumpAndSettle();
    expect(picked?.wire, '1990-02-01');
  });
}
