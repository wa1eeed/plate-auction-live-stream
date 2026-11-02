import 'package:flutter/material.dart';

import '../../design/tokens.dart';

/// **شريطُ الضمانات** — ثلاثُ خاناتٍ مقسومة (§5.1).
class GuaranteesBar extends StatelessWidget {
  const GuaranteesBar({super.key});

  static const _items = <(IconData, String)>[
    (Icons.verified_user_rounded, 'حماية الصفقات بضمان العربون'),
    (Icons.lock_rounded, 'حماية مزادك بسعر أدنى مخفي'),
    (Icons.receipt_long_rounded, 'كشف مزايدات مكشوف'),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 18),
      padding: const EdgeInsets.symmetric(vertical: 14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadii.card),
      ),
      child: Row(
        children: [
          for (var i = 0; i < _items.length; i++) ...[
            if (i > 0)
              Container(width: 1, height: 44, color: AppColors.divider),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Column(
                  children: [
                    Icon(_items[i].$1, size: 20, color: AppColors.accent700),
                    const SizedBox(height: 6),
                    Text(
                      _items[i].$2,
                      textAlign: TextAlign.center,
                      style: AppText.body(10.5, color: AppColors.neutral800),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
