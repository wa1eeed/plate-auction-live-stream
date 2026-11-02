import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../design/tokens.dart';

/// **ترويسةُ الرئيسية** — شعارٌ واسمٌ · رقاقةُ المحفظة · جرسُ الإشعارات.
class HomeHeader extends StatelessWidget {
  const HomeHeader({
    super.key,
    required this.availableHalalas,
    this.hasUnread = false,
    this.onWallet,
    this.onNotifications,
  });

  final int availableHalalas;
  final bool hasUnread;
  final VoidCallback? onWallet;
  final VoidCallback? onNotifications;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 0, 18, 0),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: const BoxDecoration(
              color: AppColors.accent,
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Container(
                width: 22,
                height: 11,
                decoration: BoxDecoration(
                  border: Border.all(color: AppColors.neutral100, width: 2.5),
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text('سوق تداول اللوحات', style: AppText.heading(17)),
          ),
          _Pill(
            onTap: onWallet,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(LucideIcons.creditCard, size: 17),
                const SizedBox(width: 6),
                Text(
                  _riyals,
                  style: AppText.digits(13, weight: FontWeight.w600),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          _Pill(
            onTap: onNotifications,
            circle: true,
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                const Icon(LucideIcons.bell, size: 19),
                if (hasUnread)
                  PositionedDirectional(
                    top: -1,
                    end: -2,
                    child: Container(
                      width: 9,
                      height: 9,
                      decoration: BoxDecoration(
                        color: AppColors.accent,
                        shape: BoxShape.circle,
                        border: Border.all(color: AppColors.surface, width: 2),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String get _riyals => (availableHalalas ~/ 100).toString().replaceAllMapped(
    RegExp(r'(\d)(?=(\d{3})+$)'),
    (m) => '${m[1]},',
  );
}

class _Pill extends StatelessWidget {
  const _Pill({required this.child, this.onTap, this.circle = false});

  final Widget child;
  final VoidCallback? onTap;
  final bool circle;

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    behavior: HitTestBehavior.opaque,
    child: Container(
      height: 38,
      width: circle ? 38 : null,
      padding: circle ? null : const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Center(child: child),
    ),
  );
}
