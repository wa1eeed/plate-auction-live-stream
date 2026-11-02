import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../design/tokens.dart';

/// تبويباتُ الشريط السفليّ.
enum AppTab { home, market, sell, activity, account }

/// **شريطُ تبويبٍ سفليٌّ موحّد** — §4.
///
/// **وموحّدٌ لأنّ المستخدم بائعٌ ومشترٍ معًا**: لا شريطَ للبيع وآخرَ للشراء.
/// ومن باع لوحةً اليوم يشتري غدًا، فتقسيمُ التطبيق بالدور يُجبره على اختيار
/// هويّةٍ لا يملكها.
class AppTabBar extends StatelessWidget {
  const AppTabBar({
    super.key,
    required this.current,
    required this.onSelect,
    this.pendingCount = 0,
  });

  final AppTab current;
  final ValueChanged<AppTab> onSelect;

  /// عددُ ما ينتظر ردَّك — بشارةٌ على «نشاطي».
  final int pendingCount;

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewPaddingOf(context).bottom;

    return Container(
      decoration: const BoxDecoration(
        color: AppColors.bg,
        border: Border(top: BorderSide(color: AppColors.divider)),
      ),
      padding: EdgeInsets.only(bottom: bottomInset),
      child: SizedBox(
        height: 58,
        child: Row(
          children: [
            _Item(
              tab: AppTab.home,
              icon: LucideIcons.house,
              label: 'الرئيسية',
              current: current,
              onSelect: onSelect,
            ),
            _Item(
              tab: AppTab.market,
              icon: LucideIcons.store,
              label: 'السوق',
              current: current,
              onSelect: onSelect,
            ),
            const _SellButtonSlot(),
            _Item(
              tab: AppTab.activity,
              icon: LucideIcons.zap,
              label: 'نشاطي',
              current: current,
              onSelect: onSelect,
              badge: pendingCount,
            ),
            _Item(
              tab: AppTab.account,
              icon: LucideIcons.user,
              label: 'حسابي',
              current: current,
              onSelect: onSelect,
            ),
          ],
        ),
      ),
    );
  }
}

/// الفراغُ الذي يشغله الزرُّ الدائريُّ البارز — يُرسم فوق الشريط لا فيه.
class _SellButtonSlot extends StatelessWidget {
  const _SellButtonSlot();

  @override
  Widget build(BuildContext context) => const Expanded(child: SizedBox());
}

/// **زرُّ «اعرض لوحتك»** — دائريٌّ بارزٌ في الوسط.
///
/// ويرتفع فوق الشريط بحدٍّ بلون الخلفية، فيبدو مقطوعًا منه لا ملصقًا عليه.
class SellButton extends StatelessWidget {
  const SellButton({super.key, required this.onTap});

  final VoidCallback onTap;

  static const diameter = 58.0;
  static const lift = 30.0;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Semantics(
        button: true,
        label: 'اعرض لوحتك',
        child: Container(
          width: diameter,
          height: diameter,
          decoration: BoxDecoration(
            color: AppColors.accent,
            shape: BoxShape.circle,
            border: Border.all(color: AppColors.bg, width: 4),
          ),
          child: const Icon(LucideIcons.plus, color: Colors.white, size: 30),
        ),
      ),
    );
  }
}

class _Item extends StatelessWidget {
  const _Item({
    required this.tab,
    required this.icon,
    required this.label,
    required this.current,
    required this.onSelect,
    this.badge = 0,
  });

  final AppTab tab;
  final IconData icon;
  final String label;
  final AppTab current;
  final ValueChanged<AppTab> onSelect;
  final int badge;

  @override
  Widget build(BuildContext context) {
    final active = current == tab;
    final color = active ? AppColors.accent700 : AppColors.neutral600;

    return Expanded(
      child: Semantics(
        selected: active,
        button: true,
        child: GestureDetector(
          onTap: () => onSelect(tab),
          behavior: HitTestBehavior.opaque,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Stack(
                clipBehavior: Clip.none,
                children: [
                  Icon(icon, size: 23, color: color),
                  if (badge > 0)
                    PositionedDirectional(
                      top: -4,
                      end: -7,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 4,
                          vertical: 1,
                        ),
                        constraints: const BoxConstraints(minWidth: 16),
                        decoration: BoxDecoration(
                          color: AppColors.accent,
                          borderRadius: BorderRadius.circular(AppRadii.pill),
                          border: Border.all(color: AppColors.bg, width: 1.5),
                        ),
                        child: Text(
                          '$badge',
                          textAlign: TextAlign.center,
                          style: AppText.digits(9.5, color: Colors.white),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 3),
              Text(label, style: AppText.body(10.5, color: color)),
            ],
          ),
        ),
      ),
    );
  }
}
