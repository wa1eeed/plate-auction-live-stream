import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../design/tokens.dart';
import '../models/listing.dart';
import '../widgets/listing/action_bar.dart';
import '../widgets/listing/bid_log.dart';
import '../widgets/listing/plate_stage.dart';
import '../widgets/listing/price_box.dart';

/// **صفحةُ اللوحة** — §5.4.
class ListingScreen extends StatelessWidget {
  const ListingScreen({
    super.key,
    required this.listing,
    required this.serverTime,
    this.bids = const [],
    this.viewers,
    this.depositHalalas = 0,
    this.increment = 50000,
    this.reserve = ReserveState.none,
    this.sellerName = '—',
    this.onBack,
    this.onBid,
    this.onBuy,
    this.onOffer,
    this.onFollow,
    this.onShare,
  });

  final Listing listing;
  final DateTime serverTime;
  final List<BidEntry> bids;
  final int? viewers;

  /// العربونُ المحجوز لهذا المزاد.
  final int depositHalalas;

  final int increment;
  final ReserveState reserve;
  final String sellerName;
  final VoidCallback? onBack;

  /// وظائفُ اللوحة — تمرّ ببوّابة الحساب قبل أن تقع.
  final ValueChanged<int>? onBid;
  final VoidCallback? onBuy;
  final VoidCallback? onOffer;
  final VoidCallback? onFollow;

  /// **مشاركةُ رابط اللوحة** — وكان زرُّ المشاركة بلا نداء.
  final VoidCallback? onShare;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _header(),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
            children: [
              PlateStage(listing: listing, viewers: viewers),
              const SizedBox(height: 14),
              PriceBox(
                listing: listing,
                serverTime: serverTime,
                reserve: reserve,
              ),
              if (depositHalalas > 0) ...[
                const SizedBox(height: 14),
                _DepositCard(halalas: depositHalalas),
              ],
              if (listing.saleType == SaleType.auction) ...[
                const SizedBox(height: 14),
                BidLog(entries: bids),
              ],
              const SizedBox(height: 14),
              _SellerCard(name: sellerName),
            ],
          ),
        ),
        ListingActionBar(
          listing: listing,
          increment: increment,
          onBid: onBid,
          onBuy: onBuy,
          onOffer: onOffer,
        ),
      ],
    );
  }

  Widget _header() => Padding(
    padding: const EdgeInsets.fromLTRB(14, 4, 14, 8),
    child: Row(
      children: [
        _RoundButton(
          icon: LucideIcons.arrowRight,
          onTap: onBack,
          semantics: 'رجوع',
        ),
        Expanded(
          child: Text(
            listing.reference,
            textAlign: TextAlign.center,
            style: AppText.digits(
              12.5,
              weight: FontWeight.w500,
              color: AppColors.neutral700,
            ),
          ),
        ),
        _RoundButton(
          icon: LucideIcons.share,
          semantics: 'مشاركة',
          onTap: onShare,
        ),
        /*
         * **وجرسُ المتابعة رُفع** — كان `_RoundButton` بلا `onTap` أصلًا،
         * ولا متابعةَ في الخادم (TASKS.md). و`onFollow` يبقى في الواجهة
         * ليُوصَل حين تُبنى.
         */
      ],
    ),
  );
}

class _RoundButton extends StatelessWidget {
  const _RoundButton({required this.icon, required this.semantics, this.onTap});

  final IconData icon;
  final String semantics;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: semantics,
    child: GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        width: 42,
        height: 42,
        decoration: const BoxDecoration(
          color: AppColors.surface,
          shape: BoxShape.circle,
        ),
        child: Icon(icon, size: 19, color: AppColors.text),
      ),
    ),
  );
}

/// **بطاقةُ العربون** — تقول كم يُحجز، لا كم يُخصم.
class _DepositCard extends StatelessWidget {
  const _DepositCard({required this.halalas});
  final int halalas;

  @override
  Widget build(BuildContext context) {
    final money = (halalas ~/ 100).toString().replaceAllMapped(
      RegExp(r'(\d)(?=(\d{3})+$)'),
      (m) => '${m[1]},',
    );

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadii.card),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.neutral100,
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(
              LucideIcons.wallet,
              size: 17,
              color: AppColors.accent700,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'العربون $money ر.س',
                  style: AppText.body(13, weight: FontWeight.w700),
                ),
                const SizedBox(height: 2),
                Text(
                  'عربونك $money ر.س محجوز لهذا المزاد',
                  style: AppText.body(11.5, color: AppColors.neutral700),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// بطاقةُ البائع — تفتح معرضَه.
class _SellerCard extends StatelessWidget {
  const _SellerCard({required this.name});
  final String name;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: AppColors.neutral100,
      borderRadius: BorderRadius.circular(AppRadii.card),
    ),
    child: Row(
      children: [
        Container(
          width: 38,
          height: 38,
          decoration: const BoxDecoration(
            color: AppColors.surface,
            shape: BoxShape.circle,
          ),
          child: const Icon(LucideIcons.user, size: 18),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'البائع',
                style: AppText.body(11, color: AppColors.neutral700),
              ),
              const SizedBox(height: 2),
              Text(name, style: AppText.body(13.5, weight: FontWeight.w700)),
            ],
          ),
        ),
        const Icon(
          LucideIcons.chevronLeft,
          size: 20,
          color: AppColors.neutral600,
        ),
      ],
    ),
  );
}
