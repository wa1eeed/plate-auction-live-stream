import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../design/tokens.dart';
import '../../models/listing.dart';
import '../plate_card.dart';

/// **قسمٌ بكاروسيل** — ترويسةٌ ثمّ كروتٌ تُسحب أفقيًّا.
///
/// والترويسةُ سطرٌ صغيرٌ ملوّنٌ فوق العنوان: «مباشر الآن» فوق «مزادات جارية».
/// والهامشُ الداخليُّ مع هامشٍ سالبٍ مقابل، **حتى لا يُقصّ ظلُّ الكرت** عند
/// حافّة المنطقة القابلة للتمرير.
class SectionCarousel extends StatelessWidget {
  const SectionCarousel({
    super.key,
    required this.eyebrow,
    required this.eyebrowColor,
    required this.title,
    required this.listings,
    required this.serverTime,
    this.onSeeAll,
  });

  final String eyebrow;
  final Color eyebrowColor;
  final String title;
  final List<Listing> listings;
  final DateTime serverTime;
  final VoidCallback? onSeeAll;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 18),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      eyebrow,
                      style: AppText.body(
                        11.5,
                        color: eyebrowColor,
                        weight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(title, style: AppText.heading(19)),
                  ],
                ),
              ),
              GestureDetector(
                onTap: onSeeAll,
                behavior: HitTestBehavior.opaque,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 7,
                  ),
                  decoration: BoxDecoration(
                    border: Border.all(color: AppColors.divider),
                    borderRadius: BorderRadius.circular(AppRadii.pill),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('عرض الكل', style: AppText.body(12)),
                      const SizedBox(width: 2),
                      const Icon(LucideIcons.chevronLeft, size: 16),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        SizedBox(
          height: 232,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(18, 0, 18, 0),
            itemCount: listings.length,
            separatorBuilder: (_, _) => const SizedBox(width: 12),
            itemBuilder: (context, i) => SizedBox(
              width: 268,
              child: PlateCard(
                listing: listings[i],
                serverTime: serverTime,
                onFollow: () {},
              ),
            ),
          ),
        ),
      ],
    );
  }
}
