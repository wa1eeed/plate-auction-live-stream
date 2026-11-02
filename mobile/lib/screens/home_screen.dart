import 'package:flutter/material.dart';

import '../design/tokens.dart';
import '../models/listing.dart';
import '../widgets/home/guarantees_bar.dart';
import '../widgets/home/home_banners.dart';
import '../widgets/home/home_header.dart';
import '../widgets/home/pending_bar.dart';
import '../widgets/home/section_carousel.dart';
import '../widgets/home/stories_strip.dart';

/// **الشاشةُ الرئيسيّة** — §5.1.
class HomeScreen extends StatelessWidget {
  const HomeScreen({
    super.key,
    required this.listings,
    required this.serverTime,
    this.onOpenStory,
  });

  /// ما يُعرض في السوق — يُقسَّم هنا على الأقسام الثلاثة.
  final List<Listing> listings;

  /// وقتُ الخادم — مرجعُ كلّ عدّاد.
  final DateTime serverTime;

  /// تُفتح قصّةٌ في عارضٍ يملأ الشاشة.
  final ValueChanged<Story>? onOpenStory;

  @override
  Widget build(BuildContext context) {
    final now = serverTime;
    /*
     * **والأقسامُ تُشتقّ من المعروض لا تُجلب مستقلّةً.**
     *
     * فثلاثُ ندواتٍ للخادم في فتحةٍ واحدة تُبطئ أوّلَ شاشةٍ يراها
     * المستخدم، والتقسيمُ بطريقة البيع يُحسب هنا بلا كلفة.
     */
    final auctions = listings
        .where((l) => l.saleType == SaleType.auction)
        .toList();
    /* عدّادُ بطاقة البنر الثاني يقرأ **أقربَ مزادٍ فعليّ** لا رقمًا مكتوبًا */
    /* وأقربُ مزادٍ قد لا يكون — فيُحتاط له */
    final ends = auctions.map((l) => l.endsAt).whereType<DateTime>().toList()
      ..sort();
    final nearestEnd = ends.isEmpty
        ? now.add(const Duration(hours: 5))
        : ends.first;

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
        StoriesStrip(onOpen: onOpenStory),
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
          listings: listings
              .where((l) => l.saleType == SaleType.fixed)
              .toList(),
          serverTime: now,
        ),
        const SizedBox(height: 22),
        SectionCarousel(
          eyebrow: 'قدّم سومك',
          eyebrowColor: AppColors.neutral700,
          title: 'على السوم',
          listings: listings
              .where((l) => l.saleType == SaleType.offers)
              .toList(),
          serverTime: now,
        ),
        const SizedBox(height: 22),
        const GuaranteesBar(),
      ],
    );
  }
}
