import 'package:flutter/material.dart';

import '../design/tokens.dart';
import '../models/listing.dart';
import '../widgets/home/guarantees_bar.dart';
import '../widgets/home/home_banners.dart';
import '../widgets/home/home_header.dart';
import '../widgets/home/pending_bar.dart';
import '../widgets/home/section_carousel.dart';
import '../widgets/home/stories_strip.dart';
import '../widgets/plate.dart';

/// **الشاشةُ الرئيسيّة** — §5.1.
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final auctions = _auctions(now);
    /* عدّادُ بطاقة البنر الثاني يقرأ **أقربَ مزادٍ فعليّ** لا رقمًا مكتوبًا */
    final nearestEnd = auctions
        .map((l) => l.endsAt!)
        .reduce((a, b) => a.isBefore(b) ? a : b);

    return ListView(
      /*
       * **وهامشٌ سفليٌّ يسع الزرَّ الطافي.**
       *
       * فزرُّ «اعرض لوحتك» يرتفع ‎٣٠‎ بكسلًا فوق الشريط، فيقع على آخر عنصرٍ
       * في الصفحة ويحجب سطرَه الأوسط. ولا يُزاح الزرُّ — موضعُه قرارُ
       * التصميم — بل يُفسَح له فيمرّ المحتوى من تحته.
       */
      padding: const EdgeInsets.only(bottom: 76),
      children: [
        const SizedBox(height: 6),
        const HomeHeader(availableHalalas: 3850000, hasUnread: true),
        const SizedBox(height: 22),
        const StoriesStrip(),
        const SizedBox(height: 22),
        const PendingBar(
          count: 3,
          title: '3 أمور بانتظار ردّك',
          first: 'أكّد بياناتك لنقل الملكية',
        ),
        const SizedBox(height: 22),
        HomeBanners(nearestAuctionEnd: nearestEnd, availableHalalas: 3850000),
        const SizedBox(height: 22),
        SectionCarousel(
          eyebrow: 'مباشر الآن',
          eyebrowColor: AppColors.accent,
          title: 'مزادات جارية',
          listings: auctions,
          serverTime: now,
        ),
        const SizedBox(height: 22),
        SectionCarousel(
          eyebrow: 'بسعر ثابت',
          eyebrowColor: AppColors.accent2_600,
          title: 'بيع مباشر',
          listings: _fixed(now),
          serverTime: now,
        ),
        const SizedBox(height: 22),
        SectionCarousel(
          eyebrow: 'قدّم سومك',
          eyebrowColor: AppColors.neutral700,
          title: 'على السوم',
          listings: _offers(now),
          serverTime: now,
        ),
        const SizedBox(height: 22),
        const GuaranteesBar(),
      ],
    );
  }
}

/* بياناتٌ تجريبيّةٌ ريثما تُربط `api/listings` — بذرةُ النموذج نفسُها */

List<Listing> _auctions(DateTime now) => [
  Listing(
    id: '1',
    reference: 'L26-00421',
    letters: 'س ع د',
    number: '1',
    kind: PlateKind.private,
    format: PlateFormat.long,
    emblem: PlateEmblem.palm,
    saleType: SaleType.auction,
    price: 125000000,
    bids: 23,
    endsAt: now.add(const Duration(days: 2, hours: 5, minutes: 23)),
    standing: BidStanding.top,
  ),
  Listing(
    id: '2',
    reference: 'L26-00418',
    letters: 'ق و س',
    number: '4040',
    kind: PlateKind.private,
    format: PlateFormat.standard,
    emblem: PlateEmblem.palm,
    saleType: SaleType.auction,
    price: 8000000,
    bids: 7,
    endsAt: now.add(const Duration(hours: 3, minutes: 12)),
  ),
  Listing(
    id: '3',
    reference: 'L26-00410',
    letters: 'ر ر',
    number: '77',
    kind: PlateKind.private,
    format: PlateFormat.long,
    emblem: PlateEmblem.vision,
    saleType: SaleType.auction,
    price: 47500000,
    bids: 41,
    endsAt: now.add(const Duration(days: 1, hours: 2)),
    standing: BidStanding.outbid,
  ),
];

List<Listing> _fixed(DateTime now) => [
  const Listing(
    id: '4',
    reference: 'L26-00399',
    letters: 'ن ق ل',
    number: '5566',
    kind: PlateKind.transport,
    format: PlateFormat.sport,
    emblem: PlateEmblem.palm,
    saleType: SaleType.fixed,
    price: 3500000,
  ),
  const Listing(
    id: '5',
    reference: 'L26-00381',
    letters: 'ك ط ع',
    number: '1234',
    kind: PlateKind.private,
    format: PlateFormat.standard,
    emblem: PlateEmblem.palm,
    saleType: SaleType.fixed,
    price: 12000000,
    settlementPending: true,
  ),
];

List<Listing> _offers(DateTime now) => [
  const Listing(
    id: '6',
    reference: 'L26-00355',
    letters: 'ح د',
    number: '9',
    kind: PlateKind.motorcycle,
    format: PlateFormat.standard,
    emblem: PlateEmblem.palm,
    saleType: SaleType.offers,
    price: 2200000,
  ),
  const Listing(
    id: '7',
    reference: 'L26-00344',
    letters: 'ب ه ا',
    number: '2846',
    kind: PlateKind.private,
    format: PlateFormat.long,
    emblem: PlateEmblem.dereyah,
    saleType: SaleType.offers,
    price: 6400000,
  ),
];
