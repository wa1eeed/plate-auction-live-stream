import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mazad/design/tokens.dart';
import 'package:mazad/models/demo_data.dart';
import 'package:mazad/models/listing.dart';
import 'package:mazad/screens/listing_screen.dart';
import 'package:mazad/widgets/listing/price_box.dart';

import 'font_sheet.dart';

final _now = DateTime(2026, 10, 30, 10);

Widget _wrap(Widget child, {Size size = const Size(390, 844)}) => MaterialApp(
  debugShowCheckedModeBanner: false,
  home: Directionality(
    textDirection: TextDirection.rtl,
    child: MediaQuery(
      data: MediaQueryData(size: size),
      child: Material(
        color: AppColors.bg,
        child: Center(
          child: SizedBox(width: size.width, height: size.height, child: child),
        ),
      ),
    ),
  ),
);

ListingScreen _screen({Listing? listing}) => ListingScreen(
  listing: listing ?? demoAuctions(_now).first,
  serverTime: _now,
  viewers: 100,
  depositHalalas: 500000,
  reserve: ReserveState.notMet,
  sellerName: 'وليد المطيري',
  bids: demoBids(_now),
);

void main() {
  setUpAll(loadAllFonts);

  testWidgets('لوحُ صفحة اللوحة', (tester) async {
    tester.view.physicalSize = const Size(780, 1688);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(_wrap(_screen()));
    await tester.runAsync(() async {
      for (final e in find.byType(Image).evaluate()) {
        await precacheImage((e.widget as Image).image, e);
      }
    });
    await tester.pump(const Duration(milliseconds: 200));

    await expectLater(
      find.byType(ListingScreen),
      matchesGoldenFile('goldens/listing.png'),
    );
  });

  /// **والمالكُ لا يزايد ولا يشتري ولا يسوم** — سطرُ قفلٍ صريحٌ لا زرٌّ معطَّل.
  testWidgets('المالكُ يرى سطرَ القفل لا زرَّ المزايدة', (tester) async {
    final mine = demoAuctions(_now).first;
    await tester.pumpWidget(
      _wrap(
        _screen(
          listing: Listing(
            id: mine.id,
            reference: mine.reference,
            letters: mine.letters,
            number: mine.number,
            kind: mine.kind,
            format: mine.format,
            emblem: mine.emblem,
            saleType: mine.saleType,
            price: mine.price,
            bids: mine.bids,
            endsAt: mine.endsAt,
            mine: true,
          ),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 200));

    expect(find.text('زايد'), findsNothing);
    expect(find.textContaining('هذه لوحتك'), findsOneWidget);
  });

  /// **ولا يُعرض رقمُ السعر الأدنى أبدًا** — بلوغُه فقط.
  testWidgets('السعرُ الأدنى حالةٌ لا رقم', (tester) async {
    await tester.pumpWidget(_wrap(_screen()));
    await tester.pump(const Duration(milliseconds: 200));

    expect(find.text('لم تبلغ المزايدات سعر البيع بعد'), findsOneWidget);
  });

  testWidgets('لا تفيض الصفحةُ على عرض 360', (tester) async {
    tester.view.physicalSize = const Size(720, 1600);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(_wrap(_screen(), size: const Size(360, 800)));
    await tester.pump(const Duration(milliseconds: 200));
    expect(tester.takeException(), isNull);
  });
}
