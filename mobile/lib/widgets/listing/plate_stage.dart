import 'package:flutter/material.dart';

import '../../design/tokens.dart';
import '../../models/listing.dart';
import '../plate.dart';

/// **منصّةُ اللوحة** — صدرُ صفحة اللوحة (§5.4).
///
/// وهالةٌ خضراءُ ‎٢٠٠×٢٠٠‎ تخرج من الزاوية، وسطرُ طريقةِ البيع والنوع
/// والإصدار أعلى اليمين، وعددُ المشاهدين بنقطةٍ نابضةٍ أعلى اليسار.
class PlateStage extends StatelessWidget {
  const PlateStage({super.key, required this.listing, this.viewers});

  final Listing listing;

  /// عددُ من يشاهدون الآن — `null` لغير الحيّ.
  final int? viewers;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadii.card),
      child: Container(
        color: AppColors.surface,
        child: Stack(
          children: [
            /* هالةٌ تخرج من الزاوية: ‎٢٠٠‎ قطرًا، عند ‎‑٧٠/‑٩٠‎ */
            PositionedDirectional(
              end: -70,
              top: -90,
              child: Opacity(
                opacity: 0.6,
                child: Container(
                  width: 200,
                  height: 200,
                  decoration: const BoxDecoration(
                    color: AppColors.accent200,
                    shape: BoxShape.circle,
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 34, 16, 18),
              child: Column(
                children: [
                  const SizedBox(height: 8),
                  SaudiPlate(
                    letters: listing.letters,
                    number: listing.number,
                    kind: listing.kind,
                    format: listing.format,
                    emblem: listing.emblem,
                  ),
                  if (listing.mine) ...[
                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.neutral100,
                        borderRadius: BorderRadius.circular(AppRadii.pill),
                      ),
                      child: Text(
                        'تابعة لك',
                        style: AppText.body(12, weight: FontWeight.w700),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            PositionedDirectional(
              top: 12,
              start: 14,
              child: Row(
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: _saleColor,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    _saleLabel,
                    style: AppText.body(12, weight: FontWeight.w700),
                  ),
                  Text(
                    ' · $_kindLabel · $_formatLabel',
                    style: AppText.body(
                      12,
                      weight: FontWeight.w500,
                      color: AppColors.neutral700,
                    ),
                  ),
                ],
              ),
            ),
            if (viewers != null)
              PositionedDirectional(
                top: 10,
                end: 12,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.neutral100,
                    borderRadius: BorderRadius.circular(AppRadii.pill),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const _PulseDot(),
                      const SizedBox(width: 6),
                      Text(
                        '$viewers يشاهدون',
                        style: AppText.body(11.5, weight: FontWeight.w700),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Color get _saleColor => switch (listing.saleType) {
    SaleType.auction => AppColors.accent,
    SaleType.fixed => AppColors.accent2,
    SaleType.offers => AppColors.neutral700,
  };

  String get _saleLabel => switch (listing.saleType) {
    SaleType.auction => 'مزاد',
    SaleType.fixed => 'بيع مباشر',
    SaleType.offers => 'سوم',
  };

  String get _kindLabel => switch (listing.kind) {
    PlateKind.private => 'خصوصي',
    PlateKind.transport => 'نقل خاص',
    PlateKind.motorcycle => 'دراجة نارية',
  };

  String get _formatLabel => switch (listing.format) {
    PlateFormat.long => 'طويلة',
    PlateFormat.standard => 'اعتيادية',
    PlateFormat.sport => 'رياضية',
  };
}

/// نقطةٌ تنبض — `pulse 1.4s` على عدّاد المشاهدين.
class _PulseDot extends StatefulWidget {
  const _PulseDot();

  @override
  State<_PulseDot> createState() => _PulseDotState();
}

class _PulseDotState extends State<_PulseDot>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.disableAnimationsOf(context) && _c.isAnimating) {
      _c.stop();
    }
    return FadeTransition(
      opacity: Tween<double>(begin: 1, end: 0.35).animate(_c),
      child: Container(
        width: 7,
        height: 7,
        decoration: const BoxDecoration(
          color: AppColors.accent,
          shape: BoxShape.circle,
        ),
      ),
    );
  }
}
