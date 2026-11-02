import 'package:flutter/material.dart';

import '../../design/tokens.dart';
import '../../models/order.dart';
import '../listing/bid_log.dart' show formatStamp;

/// **سكّةُ الصفقة** — خمسُ محطّاتٍ وتحت كلٍّ ختمُها (§5.7).
///
/// **والختمُ تحت كلّ محطّةٍ: التاريخُ سطرًا والوقتُ سطرًا.** فسكّةٌ بلا
/// أختامٍ تقول «أين نحن» ولا تقول «متى» — ومن يفتح صفقةً بعد شهرٍ ليحتجّ
/// بتأخّرٍ يحتاج الوقتَ لا الترتيب.
class OrderRail extends StatelessWidget {
  const OrderRail({super.key, required this.order});

  final OrderView order;

  @override
  Widget build(BuildContext context) {
    final stations = order.stations;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 6),
      child: Stack(
        children: [
          /* المسارُ الرماديُّ بين مركزَي الطرفين — ‎١٠٪‎ من كلّ جهة */
          Positioned(
            top: 10,
            left: 0,
            right: 0,
            child: FractionallySizedBox(
              widthFactor: 0.8,
              child: Container(
                height: 6,
                decoration: BoxDecoration(
                  color: AppColors.neutral300,
                  borderRadius: BorderRadius.circular(AppRadii.pill),
                ),
              ),
            ),
          ),
          Positioned(
            top: 10,
            left: 0,
            right: 0,
            child: FractionallySizedBox(
              widthFactor: 0.8,
              alignment: AlignmentDirectional.centerStart,
              child: FractionallySizedBox(
                widthFactor: order.fill,
                alignment: AlignmentDirectional.centerStart,
                child: Container(
                  height: 6,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [AppColors.accent, AppColors.accent2_600],
                      stops: [0, 0.7],
                    ),
                    borderRadius: BorderRadius.circular(AppRadii.pill),
                  ),
                ),
              ),
            ),
          ),
          Row(
            children: stations
                .map((s) => Expanded(child: _Station(s)))
                .toList(),
          ),
        ],
      ),
    );
  }
}

class _Station extends StatelessWidget {
  const _Station(this.station);

  final Station station;

  @override
  Widget build(BuildContext context) {
    final (size, color, border) = switch (station.state) {
      StationState.done => (14.0, AppColors.accent2_600, null),
      StationState.current => (
        20.0,
        AppColors.neutral100,
        Border.all(color: AppColors.accent, width: 4),
      ),
      StationState.pending => (10.0, AppColors.neutral400, null),
      StationState.failed => (14.0, AppColors.danger, null),
    };

    return Column(
      children: [
        SizedBox(
          height: 26,
          child: Center(
            child: Container(
              width: size,
              height: size,
              decoration: BoxDecoration(
                color: color,
                shape: BoxShape.circle,
                border: border,
              ),
            ),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          station.label,
          style: AppText.body(
            12,
            weight: station.state == StationState.current
                ? FontWeight.w700
                : FontWeight.w500,
            color: station.state == StationState.pending
                ? AppColors.neutral600
                : AppColors.text,
          ),
        ),
        const SizedBox(height: 6),
        SizedBox(
          height: 24,
          child: station.at == null
              ? const SizedBox.shrink()
              : Column(
                  children: _stamp(station.at!)
                      .map(
                        (line) => Text(
                          line,
                          textAlign: TextAlign.center,
                          style: AppText.digits(
                            9,
                            weight: FontWeight.w500,
                            color: AppColors.neutral600,
                          ),
                        ),
                      )
                      .toList(),
                ),
        ),
      ],
    );
  }

  /// يقسم الختمَ سطرين: التاريخُ ثمّ الوقت.
  List<String> _stamp(DateTime at) => formatStamp(at).split(' · ');
}
