import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../design/tokens.dart';
import '../models/listing.dart';
import 'countdown.dart';
import 'plate.dart';

/// **صفُّ السوق** — §5.3، وهو غيرُ كرت الرئيسية.
///
/// **واللوحةُ تأخذ ‎٥٦٪‎ من العرض** والباقي للسعر والعدّاد والحالة. والقائمةُ
/// صفّيّةٌ لا شبكيّة: من يمسح السوق يقارن الأسعارَ عمودًا واحدًا، وشبكةٌ
/// بعمودين تُجبره على القفز يمينًا ويسارًا في كلّ صفّ.
class MarketRowCard extends StatelessWidget {
  const MarketRowCard({
    super.key,
    required this.listing,
    required this.serverTime,
    this.onTap,
    this.onWatch,
  });

  final Listing listing;
  final DateTime serverTime;
  final VoidCallback? onTap;
  final VoidCallback? onWatch;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppRadii.card),
        ),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              /* اللوحةُ ‎٥٦٪‎، وتحتها سطرُ طريقة البيع ونوع اللوحة */
              Expanded(flex: 56, child: _plateSide()),
              const SizedBox(width: 12),
              Expanded(flex: 44, child: _factsSide()),
            ],
          ),
        ),
      ),
    );
  }

  Widget _plateSide() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        /* حاويةُ اللوحة بنسبةِ ‎١٦:٧‎ وحشوةٍ أفقيّةٍ ‎١٠‎ */
        AspectRatio(
          aspectRatio: 16 / 7,
          child: Container(
            decoration: BoxDecoration(
              color: AppColors.neutral200,
              borderRadius: BorderRadius.circular(AppRadii.plateInset),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 10),
            child: Center(
              child: SaudiPlate(
                letters: listing.letters,
                number: listing.number,
                kind: listing.kind,
                format: listing.format,
                emblem: listing.emblem,
              ),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: Row(
            children: [
              Container(
                width: 7,
                height: 7,
                decoration: BoxDecoration(
                  color: _saleColor,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 5),
              Text(
                _saleLabel,
                style: AppText.body(11.5, weight: FontWeight.w700),
              ),
              const SizedBox(width: 10),
              Flexible(
                child: Text(
                  _kindLabel,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(11.5, color: AppColors.neutral700),
                ),
              ),
              if (listing.format == PlateFormat.sport) ...[
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 7,
                    vertical: 1,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.text,
                    borderRadius: BorderRadius.circular(AppRadii.pill),
                  ),
                  child: Text(
                    'سبورت',
                    style: AppText.body(
                      10,
                      color: AppColors.bg,
                      weight: FontWeight.w700,
                    ).copyWith(letterSpacing: 0.2),
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _factsSide() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _priceLabel,
                    style: AppText.body(11, color: AppColors.neutral700),
                  ),
                  const SizedBox(height: 1),
                  Text(
                    _priceText,
                    maxLines: 1,
                    softWrap: false,
                    style: AppText.money(20)
                        .copyWith(height: 1.1, letterSpacing: -0.2),
                  ),
                  const SizedBox(height: 1),
                  Text(
                    'ر.س',
                    style: AppText.body(11, color: AppColors.neutral700),
                  ),
                ],
              ),
            ),
            /*
             * **ولا يُرسَم الجرسُ بلا نداء** — كما في `PlateCard`.
             *
             * فزرٌّ يُرى ويُضغط ولا يقع شيءٌ يُقرأ عطبًا، وغيابُه يُقرأ
             * ميزةً لم تصل. ولا متابعةَ في الخادم أصلًا (TASKS.md).
             */
            if (onWatch != null)
              GestureDetector(
                onTap: onWatch,
                behavior: HitTestBehavior.opaque,
                child: Container(
                  width: 32,
                  height: 32,
                  decoration: const BoxDecoration(
                    color: AppColors.neutral100,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    listing.following ? LucideIcons.bellRing : LucideIcons.bell,
                    size: 15,
                    color: listing.following
                        ? AppColors.accent700
                        : AppColors.neutral600,
                  ),
                ),
              ),
          ],
        ),
        if (listing.endsAt != null) ...[
          const SizedBox(height: 6),
          AuctionCountdown(endsAt: listing.endsAt!, serverTime: serverTime),
        ],
        if (_status != null) ...[
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
            decoration: BoxDecoration(
              color: _status!.$2,
              borderRadius: BorderRadius.circular(AppRadii.pill),
            ),
            child: Text(
              _status!.$1,
              style: AppText.body(
                11,
                color: _status!.$3,
                weight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ],
    );
  }

  (String, Color, Color)? get _status => switch (listing.standing) {
    BidStanding.top => (
      'أنت الأعلى',
      AppColors.accent2_200,
      AppColors.accent2_800,
    ),
    BidStanding.outbid => (
      'تجاوزك أحد',
      AppColors.accent100,
      AppColors.accent800,
    ),
    BidStanding.none when listing.settlementPending => (
      'محجوزة بانتظار الدفع',
      AppColors.neutral300,
      AppColors.neutral800,
    ),
    BidStanding.none => null,
  };

  String get _priceText => (listing.price ~/ 100).toString().replaceAllMapped(
    RegExp(r'(\d)(?=(\d{3})+$)'),
    (m) => '${m[1]},',
  );

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

  String get _priceLabel => switch (listing.saleType) {
    SaleType.auction => 'أعلى مزايدة',
    SaleType.fixed => 'السعر',
    SaleType.offers => 'السعر المطلوب',
  };
}
