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
    this.availableHalalas = 0,
    this.pendingCount = 0,
    this.pendingFirst,
    this.hasUnread = false,
    this.onOpenStory,
    this.onOpen,
    this.onOpenWallet,
    this.onOpenNotifications,
    this.onOpenPending,
  });

  /// ما يُعرض في السوق — يُقسَّم هنا على الأقسام الثلاثة.
  final List<Listing> listings;

  /// وقتُ الخادم — مرجعُ كلّ عدّاد.
  final DateTime serverTime;

  /// تُفتح قصّةٌ في عارضٍ يملأ الشاشة.
  /// **الرصيدُ المتاحُ من الخادم** — وكان رقمًا مكتوبًا في الشاشة.
  final int availableHalalas;

  /// ما ينتظر ردَّه — وبصفره يُخفى الشريطُ بدل أن يَعِد بثلاثةٍ لا توجد.
  final int pendingCount;
  final String? pendingFirst;

  final bool hasUnread;

  final ValueChanged<Story>? onOpenStory;

  /// **تُفتح صفحةُ اللوحة من كرت الكاروسيل** — وبدونه كروتٌ لا تُضغط.
  final ValueChanged<Listing>? onOpen;

  final VoidCallback? onOpenWallet;
  final VoidCallback? onOpenNotifications;
  final VoidCallback? onOpenPending;

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
        HomeHeader(
          availableHalalas: availableHalalas,
          hasUnread: hasUnread,
          onWallet: onOpenWallet,
          onNotifications: onOpenNotifications,
        ),
        const SizedBox(height: 22),
        StoriesStrip(onOpen: onOpenStory),
        const SizedBox(height: 22),
        /* وما لا ينتظر ردًّا لا يُعلَن عنه شريطٌ يقول «ثلاثةُ أمور» */
        if (pendingCount > 0) ...[
          PendingBar(
            count: pendingCount,
            title:
                '$pendingCount ${pendingCount == 1 ? 'أمر' : 'أمور'}'
                ' بانتظار ردّك',
            first: pendingFirst ?? '',
            onTap: onOpenPending,
          ),
          const SizedBox(height: 22),
        ],
        HomeBanners(
          nearestAuctionEnd: nearestEnd,
          availableHalalas: availableHalalas,
        ),
        const SizedBox(height: 22),
        SectionCarousel(
          eyebrow: 'مباشر الآن',
          eyebrowColor: AppColors.accent,
          title: 'مزادات جارية',
          listings: auctions,
          serverTime: now,
          onOpen: onOpen,
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
          onOpen: onOpen,
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
          onOpen: onOpen,
        ),
        const SizedBox(height: 22),
        const GuaranteesBar(),
      ],
    );
  }
}
