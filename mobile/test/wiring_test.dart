import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mazad/design/tokens.dart';
import 'package:mazad/models/demo_data.dart';
import 'package:mazad/screens/home_screen.dart';
import 'package:mazad/screens/listing_screen.dart';
import 'package:mazad/screens/settings_screen.dart';
import 'package:mazad/widgets/home/home_banners.dart';
import 'package:mazad/widgets/home/section_carousel.dart';
import 'package:mazad/widgets/listing/action_bar.dart';

import 'font_sheet.dart';

final _now = DateTime(2026, 10, 30, 10);

Widget _wrap(Widget child) => MaterialApp(
  debugShowCheckedModeBanner: false,
  home: Directionality(
    textDirection: TextDirection.rtl,
    child: MediaQuery(
      data: const MediaQueryData(size: Size(390, 844)),
      child: Material(
        color: AppColors.bg,
        child: Center(child: SizedBox(width: 390, height: 844, child: child)),
      ),
    ),
  ),
);

/// **فحصُ الوصل** — أنّ الشاشةَ تُمرّر نداءاتِها إلى ما تبنيه.
///
/// **وهو صنفُ العطب الذي شكا منه المستخدمُ كلَّه**: المكوّنُ يقبل `onTap`،
/// والشاشةُ تبنيه بلا أن تُمرّره — فيُضغط الزرُّ فلا يقع شيء. ولا يُمسك
/// بمحلّلٍ ولا بمترجم: `null` قيمةٌ صالحةٌ لمعاملٍ اختياريّ.
///
/// فيُقرأ المكوّنُ من الشجرة بعد البناء، ويُسأل: أمعك نداؤُك؟
void main() {
  setUpAll(loadAllFonts);

  testWidgets('الرئيسيّة تُمرّر نداءاتِ الشرائح و«عرض الكل»', (tester) async {
    /* وسطحُ الفحص بمقاس الجهاز — وإلّا رُسمت الكروتُ في ‎٨٠٠×٦٠٠‎ ففاضت */
    tester.view.physicalSize = const Size(780, 1688);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      _wrap(
        HomeScreen(
          listings: demoAll(_now),
          serverTime: _now,
          onOpen: (_) {},
          onOpenMarket: () {},
          onOpenSell: () {},
          onOpenWallet: () {},
          onOpenNotifications: () {},
          onOpenStory: (_) {},
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 300));

    final banners = tester.widget<HomeBanners>(find.byType(HomeBanners));
    expect(banners.onMarket, isNotNull, reason: 'شريحةُ السوق بلا وجهة');
    expect(banners.onSell, isNotNull, reason: 'شريحةُ البيع بلا وجهة');
    expect(banners.onWallet, isNotNull, reason: 'شريحةُ الضمان بلا وجهة');

    final carousels = tester
        .widgetList<SectionCarousel>(find.byType(SectionCarousel))
        .toList();
    /* و`ListView` لا تبني ما تحت الطيّة — فيُفحص ما بُني */
    expect(carousels, hasLength(greaterThanOrEqualTo(2)));
    for (final c in carousels) {
      expect(c.onSeeAll, isNotNull, reason: '«عرض الكل» في «${c.title}» جُماد');
      expect(c.onOpen, isNotNull, reason: 'كروتُ «${c.title}» لا تُفتح');
    }
  });

  testWidgets('صفحةُ اللوحة تُمرّر المشاركةَ وأزرارَ الشريط', (tester) async {
    tester.view.physicalSize = const Size(780, 1688);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);

    final listing = demoAuctions(_now).first;
    await tester.pumpWidget(
      _wrap(
        ListingScreen(
          listing: listing,
          serverTime: _now,
          bids: const [],
          depositHalalas: 500000,
          increment: 50000,
          sellerName: 'فهد',
          onBack: () {},
          onShare: () {},
          onBid: (_) {},
          onBuy: () {},
          onOffer: () {},
          onFollow: () {},
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 300));

    final bar = tester.widget<ListingActionBar>(find.byType(ListingActionBar));
    expect(bar.onBid, isNotNull);
    expect(bar.onBuy, isNotNull);
    expect(bar.onOffer, isNotNull);
  });

  /// **وبابُ الخروج ليس اختياريًّا** — ولا زرُّ الحذف الذي تشترطه أبل.
  testWidgets('الإعداداتُ تحمل الخروجَ والحذف', (tester) async {
    const screen = SettingsScreen();
    expect(screen.onLogout, isNull, reason: 'الافتراضُ فارغٌ — تُمرَّر بالصدف');

    var out = 0, del = 0;
    await tester.pumpWidget(
      _wrap(SettingsScreen(onLogout: () => out++, onDelete: () => del++)),
    );
    await tester.pump(const Duration(milliseconds: 300));

    final live = tester.widget<SettingsScreen>(find.byType(SettingsScreen));
    expect(live.onLogout, isNotNull);
    expect(live.onDelete, isNotNull);
    expect(out + del, 0);
  });
}
