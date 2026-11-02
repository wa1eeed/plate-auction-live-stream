import 'package:flutter/material.dart';

import '../design/tokens.dart';
import '../models/demo_data.dart';
import '../widgets/home/guarantees_bar.dart';
import '../widgets/home/home_banners.dart';
import '../widgets/home/home_header.dart';
import '../widgets/home/pending_bar.dart';
import '../widgets/home/section_carousel.dart';
import '../widgets/home/stories_strip.dart';

/// **الشاشةُ الرئيسيّة** — §5.1.
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key, this.onOpenStory});

  /// تُفتح قصّةٌ في عارضٍ يملأ الشاشة.
  final ValueChanged<Story>? onOpenStory;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final auctions = demoAuctions(now);
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
          listings: demoFixed(now),
          serverTime: now,
        ),
        const SizedBox(height: 22),
        SectionCarousel(
          eyebrow: 'قدّم سومك',
          eyebrowColor: AppColors.neutral700,
          title: 'على السوم',
          listings: demoOffers(now),
          serverTime: now,
        ),
        const SizedBox(height: 22),
        const GuaranteesBar(),
      ],
    );
  }
}
