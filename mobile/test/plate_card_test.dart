import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mazad/design/tokens.dart';
import 'package:mazad/models/listing.dart';
import 'package:mazad/widgets/plate.dart';
import 'package:mazad/widgets/plate_card.dart';

import 'font_sheet.dart';

final _serverTime = DateTime.utc(2026, 10, 30, 10);

Listing _listing({
  String number = '1',
  PlateFormat format = PlateFormat.long,
  PlateKind kind = PlateKind.private,
  int price = 125000000,
  SaleType sale = SaleType.auction,
  int bids = 23,
  BidStanding standing = BidStanding.top,
}) => Listing(
  id: 'lst_1',
  reference: 'L26-00418',
  letters: 'ق و س',
  number: number,
  kind: kind,
  format: format,
  emblem: PlateEmblem.palm,
  saleType: sale,
  price: price,
  bids: bids,
  endsAt: _serverTime.add(const Duration(days: 2, hours: 5, minutes: 23)),
  standing: standing,
);

Widget _wrap(Widget child) => Directionality(
  textDirection: TextDirection.rtl,
  child: MediaQuery(
    data: const MediaQueryData(size: Size(390, 844)),
    child: Container(
      color: AppColors.bg,
      padding: const EdgeInsets.all(14),
      child: child,
    ),
  ),
);

void main() {
  setUpAll(loadAllFonts);

  /// **لا يتغيّر ارتفاعُ أيّ كرتٍ بتغيّر نوع اللوحة ولا بطول السعر** —
  /// شرطٌ في قائمة القبول، وجُرّب بـ‎8,000‎ و‎1,250,000‎.
  testWidgets('ارتفاعُ الكرت ثابتٌ مهما تبدّلت اللوحةُ والسعر', (tester) async {
    final heights = <String, double>{};

    Future<void> measure(String name, Listing listing) async {
      await tester.pumpWidget(
        _wrap(PlateCard(listing: listing, serverTime: _serverTime)),
      );
      await tester.pumpAndSettle();
      heights[name] = tester.getSize(find.byType(PlateCard)).height;
    }

    await measure('طويلة', _listing());
    await measure('اعتيادية', _listing(format: PlateFormat.standard));
    await measure('رياضية', _listing(format: PlateFormat.sport));
    await measure('دراجة', _listing(kind: PlateKind.motorcycle));
    await measure('نقل', _listing(kind: PlateKind.transport));
    await measure('سعرٌ قصير', _listing(price: 800000));
    await measure('سعرٌ طويل', _listing(price: 125000000));
    await measure('رقمٌ بأربع خانات', _listing(number: '4040'));

    final distinct = heights.values.toSet();
    expect(
      distinct.length,
      1,
      reason:
          'اختلفت الارتفاعات: '
          '${heights.entries.map((e) => "${e.key}=${e.value}").join(" · ")}',
    );
  });

  /// **ولا تمريرَ أفقيًّا عند ‎360‎** — شرطٌ آخر في قائمة القبول.
  testWidgets('لا يفيض الكرتُ على عرض 360', (tester) async {
    await tester.pumpWidget(
      Directionality(
        textDirection: TextDirection.rtl,
        child: MediaQuery(
          data: const MediaQueryData(size: Size(360, 800)),
          child: Container(
            color: AppColors.bg,
            padding: const EdgeInsets.all(14),
            child: PlateCard(
              listing: _listing(number: '4040', price: 125000000),
              serverTime: _serverTime,
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });

  testWidgets('لوحُ كروت اللوحات', (tester) async {
    tester.view.physicalSize = const Size(800, 1900);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      _wrap(
        Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            PlateCard(
              listing: _listing(),
              serverTime: _serverTime,
              onFollow: () {},
            ),
            const SizedBox(height: 12),
            PlateCard(
              listing: _listing(
                format: PlateFormat.sport,
                sale: SaleType.fixed,
                standing: BidStanding.none,
                price: 3500000,
                bids: 0,
              ),
              serverTime: _serverTime,
              onFollow: () {},
            ),
            const SizedBox(height: 12),
            PlateCard(
              listing: _listing(
                format: PlateFormat.standard,
                number: '4040',
                sale: SaleType.offers,
                standing: BidStanding.none,
                price: 8000000,
                bids: 0,
              ),
              serverTime: _serverTime,
            ),
          ],
        ),
      ),
    );

    await tester.runAsync(() async {
      for (final e in find.byType(Image).evaluate()) {
        await precacheImage((e.widget as Image).image, e);
      }
    });
    await tester.pumpAndSettle();

    await expectLater(
      find.byType(Column).first,
      matchesGoldenFile('goldens/plate-cards.png'),
    );
  });
}
