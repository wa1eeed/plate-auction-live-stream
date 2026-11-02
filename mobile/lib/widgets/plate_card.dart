import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../design/tokens.dart';
import '../models/listing.dart';
import 'countdown.dart';
import 'plate.dart';

/// **كرتُ اللوحة** — §5.2، بتخطيطٍ **ثابتٍ لا يتغيّر**.
///
/// والثباتُ قرارٌ صريح: صفّان ثابتان (الحالة↔العدّاد، السعر↔عدد المزايدات)،
/// ومنطقةُ اللوحة بارتفاعٍ ثابت. **فلا يتغيّر ارتفاعُ الكرت** بتغيّر نوع
/// اللوحة ولا بطول السعر — وشبكةٌ ترقص أسطرُها كلّما مرّت لوحةٌ أطولَ رقمًا
/// تُقرأ مضطربةً، ومن يمسح السوقَ بعينه يفقد مكانَه في كلّ صفّ.
class PlateCard extends StatelessWidget {
  const PlateCard({
    super.key,
    required this.listing,
    required this.serverTime,
    this.onTap,
    this.onFollow,
    this.plateAreaHeight = 80,
    this.compact = false,
  });

  final Listing listing;
  final DateTime serverTime;
  final VoidCallback? onTap;
  final VoidCallback? onFollow;

  /// ارتفاعُ منطقة اللوحة — ‎٨٠‎ في الرئيسية و‎٦٠‎ في المعرض.
  final double plateAreaHeight;

  /// المعرضُ: كرتان في الصفّ، ونوعُ البيع مكان الحالة.
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.neutral100,
          borderRadius: BorderRadius.circular(AppRadii.cardOutlined),
          border: Border.all(color: AppColors.divider),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _head(),
            _plateArea(),
            Container(height: 1, color: AppColors.divider),
            _facts(),
          ],
        ),
      ),
    );
  }

  /// نوعُ اللوحة يمينًا، والجرسُ في الزاوية اليسرى العليا.
  Widget _head() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(10, 8, 6, 0),
      child: Row(
        children: [
          _Dot(color: _saleColor),
          const SizedBox(width: 5),
          Text(_kindLabel, style: AppText.body(11.5, weight: FontWeight.w600)),
          if (listing.format == PlateFormat.sport) ...[
            const SizedBox(width: 5),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: AppColors.neutral800,
                borderRadius: BorderRadius.circular(AppRadii.pill),
              ),
              child: Text(
                'سبورت',
                style: AppText.body(
                  9,
                  color: Colors.white,
                  weight: FontWeight.w600,
                ),
              ),
            ),
          ],
          const Spacer(),
          if (onFollow != null)
            GestureDetector(
              onTap: onFollow,
              behavior: HitTestBehavior.opaque,
              child: Padding(
                padding: const EdgeInsets.all(4),
                child: Icon(
                  listing.following ? LucideIcons.bellRing : LucideIcons.bell,
                  size: 18,
                  color: listing.following
                      ? AppColors.accent700
                      : AppColors.neutral600,
                ),
              ),
            ),
        ],
      ),
    );
  }

  /// **اللوحةُ في منتصف حاويةٍ ثابتة الارتفاع** أيًّا كان إصدارُها.
  Widget _plateArea() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(10, 0, 10, 8),
      child: Column(
        children: [
          SizedBox(
            height: plateAreaHeight,
            child: Center(
              child: Container(
                decoration: BoxDecoration(
                  color: AppColors.neutral200,
                  borderRadius: BorderRadius.circular(AppRadii.plateInset),
                ),
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 6,
                ),
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
          Text(
            listing.reference,
            style: AppText.digits(
              11,
              weight: FontWeight.w500,
              color: AppColors.neutral600,
            ),
          ),
        ],
      ),
    );
  }

  /// صفّان ثابتان: [الحالة ↔ العدّاد] ثمّ [السعر ↔ عدد المزايدات].
  Widget _facts() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            height: 34,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                if (compact) _saleChip() else _standingChip(),
                const Spacer(),
                if (listing.endsAt != null)
                  AuctionCountdown(
                    endsAt: listing.endsAt!,
                    serverTime: serverTime,
                  ),
              ],
            ),
          ),
          const SizedBox(height: 6),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _priceLabel,
                      style: AppText.body(10.5, color: AppColors.neutral600),
                    ),
                    const SizedBox(height: 2),
                    _Money(halalas: listing.price),
                  ],
                ),
              ),
              if (listing.saleType == SaleType.auction)
                Text(
                  '${listing.bids} مزايدة',
                  style: AppText.body(11, color: AppColors.neutral700),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _standingChip() {
    final (label, bg, fg) = switch (listing.standing) {
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
      BidStanding.none => (
        _saleLabel,
        AppColors.neutral200,
        AppColors.neutral800,
      ),
    };
    return _Chip(label: label, bg: bg, fg: fg, dot: _saleColor);
  }

  Widget _saleChip() => _Chip(
    label: _saleLabel,
    bg: AppColors.neutral200,
    fg: AppColors.neutral800,
    dot: _saleColor,
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

/// نقطةُ طريقة البيع — ‎٦–٨‎ بكسل بجانب الاسم.
class _Dot extends StatelessWidget {
  const _Dot({required this.color});
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
    width: 7,
    height: 7,
    decoration: BoxDecoration(color: color, shape: BoxShape.circle),
  );
}

class _Chip extends StatelessWidget {
  const _Chip({
    required this.label,
    required this.bg,
    required this.fg,
    required this.dot,
  });

  final String label;
  final Color bg;
  final Color fg;
  final Color dot;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
    decoration: BoxDecoration(
      color: bg,
      borderRadius: BorderRadius.circular(AppRadii.pill),
    ),
    child: Text(
      label,
      style: AppText.body(11, color: fg, weight: FontWeight.w600),
    ),
  );
}

/// **المبلغُ ومعه «ر.س» أصغرَ وأفتح** — §2.1.
///
/// و`nowrap` على السعر: لا يلتفّ ولا يُقصّ مهما طال، فالكرتُ لا يتبدّل
/// تخطيطُه بطول الرقم.
class _Money extends StatelessWidget {
  const _Money({required this.halalas});
  final int halalas;

  @override
  Widget build(BuildContext context) {
    final riyals = halalas ~/ 100;
    final text = riyals.toString().replaceAllMapped(
      RegExp(r'(\d)(?=(\d{3})+$)'),
      (m) => '${m[1]},',
    );
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.baseline,
      textBaseline: TextBaseline.alphabetic,
      children: [
        Text(text, style: AppText.money(16.5), maxLines: 1, softWrap: false),
        const SizedBox(width: 3),
        Text('ر.س', style: AppText.body(10.5, color: AppColors.neutral600)),
      ],
    );
  }
}
