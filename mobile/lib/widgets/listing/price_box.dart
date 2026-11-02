import 'dart:async';

import 'package:flutter/material.dart';

import '../../design/tokens.dart';
import '../../models/listing.dart';

/// حالُ السعر الأدنى — **لا يُعرض رقمُه أبدًا، بل بلوغُه فقط**.
enum ReserveState { none, met, notMet }

/// **صندوقُ السعر والعدّاد** — §5.4.
///
/// وخاناتُ العدّاد هنا أربعٌ كبيرةٌ (‎٢٤‎) لا صغيرةٌ كما في الكروت: الصفحةُ
/// مفتوحةٌ على لوحةٍ واحدة، فالوقتُ هو القرار.
class PriceBox extends StatefulWidget {
  const PriceBox({
    super.key,
    required this.listing,
    required this.serverTime,
    this.reserve = ReserveState.none,
  });

  final Listing listing;
  final DateTime serverTime;
  final ReserveState reserve;

  @override
  State<PriceBox> createState() => _PriceBoxState();
}

class _PriceBoxState extends State<PriceBox> with WidgetsBindingObserver {
  Timer? _timer;
  late Duration _left;
  late Duration _skew;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _skew = DateTime.now().difference(widget.serverTime);
    _read();
    _schedule();
  }

  @override
  void dispose() {
    _timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _read();
      _schedule();
    } else {
      _timer?.cancel();
      _timer = null;
    }
  }

  void _read() {
    final end = widget.listing.endsAt;
    if (end == null) return;
    final now = DateTime.now().subtract(_skew);
    setState(() => _left = end.difference(now));
  }

  void _schedule() {
    _timer?.cancel();
    if (widget.listing.endsAt == null || _left <= Duration.zero) return;
    final toEdge = 1000 - (_left.inMilliseconds % 1000);
    _timer = Timer(Duration(milliseconds: toEdge.clamp(50, 1000)), () {
      _read();
      _schedule();
    });
  }

  @override
  Widget build(BuildContext context) {
    final l = widget.listing;
    final left = (l.endsAt == null || _left.isNegative) ? Duration.zero : _left;

    /// **وتحمرُّ الخاناتُ في آخر عشر دقائق** — وهي نافذةُ القرار الأخيرة.
    final urgent = l.endsAt != null && left.inMinutes < 10;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.neutral100,
        borderRadius: BorderRadius.circular(AppRadii.banner),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _headLabel,
                      style: AppText.body(12, color: AppColors.neutral700),
                    ),
                    const SizedBox(height: 2),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Flexible(
                          child: Text(
                            _priceText,
                            maxLines: 1,
                            softWrap: false,
                            style: AppText.money(34)
                                .copyWith(height: 1, letterSpacing: -0.34),
                          ),
                        ),
                        const SizedBox(width: 5),
                        Text('ر.س', style: AppText.body(14)),
                      ],
                    ),
                  ],
                ),
              ),
              if (_standingChip != null) ...[
                const SizedBox(width: 10),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: _standingChip!.$2,
                    borderRadius: BorderRadius.circular(AppRadii.pill),
                  ),
                  child: Text(
                    _standingChip!.$1,
                    style: AppText.body(
                      12.5,
                      color: _standingChip!.$3,
                      weight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ],
          ),
          if (l.endsAt != null) ...[
            const SizedBox(height: 12),
            /* وأربعُ خاناتٍ متساويةٍ تُقرأ يسارًا: يوم · ساعة · دقيقة · ثانية */
            Directionality(
              textDirection: TextDirection.ltr,
              child: Row(
                children: [
                  _tile(left.inDays, 'يوم', urgent),
                  const SizedBox(width: 8),
                  _tile(left.inHours % 24, 'ساعة', urgent),
                  const SizedBox(width: 8),
                  _tile(left.inMinutes % 60, 'دقيقة', urgent),
                  const SizedBox(width: 8),
                  _tile(left.inSeconds % 60, 'ثانية', urgent),
                ],
              ),
            ),
          ],
          if (widget.reserve != ReserveState.none) ...[
            const SizedBox(height: 12),
            _note(
              widget.reserve == ReserveState.met
                  ? 'بلغت المزايدات سعر البيع — ستُرسى عند النهاية'
                  : 'لم تبلغ المزايدات سعر البيع بعد',
              widget.reserve == ReserveState.met
                  ? AppColors.accent2_100
                  : AppColors.surface,
              widget.reserve == ReserveState.met
                  ? AppColors.accent2_900
                  : AppColors.neutral800,
            ),
          ],
          if (l.saleType == SaleType.auction) ...[
            const SizedBox(height: 12),
            Text(
              'مزايدة في آخر دقيقتين تمدّد المزاد دقيقتين',
              style: AppText.body(12, color: AppColors.neutral700),
            ),
          ],
        ],
      ),
    );
  }

  Widget _note(String text, Color bg, Color fg) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
    decoration: BoxDecoration(
      color: bg,
      borderRadius: BorderRadius.circular(10),
    ),
    child: Text(
      text,
      style: AppText.body(12.5, color: fg, weight: FontWeight.w600),
    ),
  );

  Widget _tile(int value, String name, bool urgent) => Expanded(
    child: Container(
      padding: const EdgeInsets.symmetric(vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        children: [
          Text(
            value.toString().padLeft(2, '0'),
            style: AppText.digits(
              24,
              color: urgent ? AppColors.danger : AppColors.text,
            ),
          ),
          const SizedBox(height: 2),
          Text(name, style: AppText.body(10.5, color: AppColors.neutral700)),
        ],
      ),
    ),
  );

  (String, Color, Color)? get _standingChip =>
      switch (widget.listing.standing) {
        BidStanding.top => (
          'أنت الأعلى',
          AppColors.accent2_200,
          AppColors.accent2_900,
        ),
        BidStanding.outbid => (
          'تجاوزك أحد',
          AppColors.accent200,
          AppColors.accent900,
        ),
        BidStanding.none => null,
      };

  String get _headLabel => switch (widget.listing.saleType) {
    SaleType.auction => 'أعلى مزايدة · ${widget.listing.bids} مزايدة',
    SaleType.fixed => 'السعر',
    SaleType.offers => 'السعر المطلوب',
  };

  String get _priceText => (widget.listing.price ~/ 100)
      .toString()
      .replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+$)'), (m) => '${m[1]},');
}
