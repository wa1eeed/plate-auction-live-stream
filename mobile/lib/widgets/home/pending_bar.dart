import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../design/tokens.dart';

/// **شريطُ «بانتظار ردّك»** — يظهر إن كان على المستخدم شيء.
///
/// ويحمل أوّلَ عنوانٍ منها لا العددَ وحده: «٣ أمور» لا تقول ما هي، ومن قرأها
/// يفتح «نشاطي» ليعرف — فيُقال له هنا.
class PendingBar extends StatelessWidget {
  const PendingBar({
    super.key,
    required this.count,
    required this.title,
    required this.first,
    this.onTap,
  });

  final int count;
  final String title;
  final String first;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 18),
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: AppColors.accent200,
            borderRadius: BorderRadius.circular(AppRadii.banner),
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: const BoxDecoration(
                  color: AppColors.accent,
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Text(
                    '$count',
                    style: AppText.digits(16, color: AppColors.neutral100),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: AppText.heading(15)
                          .copyWith(color: AppColors.accent900),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      first,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body(12.5, color: AppColors.accent900),
                    ),
                  ],
                ),
              ),
              const Icon(
                LucideIcons.chevronLeft,
                size: 22,
                color: AppColors.accent900,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
