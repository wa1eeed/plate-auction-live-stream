import 'package:flutter/material.dart';

import '../../design/tokens.dart';

/// **مجموعةُ أزرارٍ واحدةٌ منها نشطة** — نوعُ اللوحة والإصدار وما أشبههما.
///
/// والنشطُ بخلفيةٍ داكنةٍ ونصٍّ فاتح، وغيرُه شفّافٌ على `surface`. وثلاثةُ
/// أزرارٍ ظاهرةٍ معًا أوضحُ من قائمةٍ تُفتح: الخياراتُ قليلةٌ ومعلومةٌ، ومن
/// رآها كلَّها عرف ما لا يختاره أيضًا.
class SegmentedRow<T> extends StatelessWidget {
  const SegmentedRow({
    super.key,
    required this.options,
    required this.value,
    required this.onChanged,
    this.height = 40,
  });

  /// القيمةُ ونصُّها.
  final List<(T, String)> options;

  final T value;
  final ValueChanged<T> onChanged;
  final double height;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(4),
    decoration: BoxDecoration(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(AppRadii.pill),
    ),
    child: Row(
      children: options.map((o) {
        final active = o.$1 == value;
        return Expanded(
          child: GestureDetector(
            onTap: () => onChanged(o.$1),
            behavior: HitTestBehavior.opaque,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              height: height,
              decoration: BoxDecoration(
                color: active ? AppColors.text : Colors.transparent,
                borderRadius: BorderRadius.circular(AppRadii.pill),
              ),
              alignment: Alignment.center,
              child: Text(
                o.$2,
                style: AppText.body(
                  13.5,
                  weight: FontWeight.w700,
                  color: active ? AppColors.bg : AppColors.text,
                ),
              ),
            ),
          ),
        );
      }).toList(),
    ),
  );
}
