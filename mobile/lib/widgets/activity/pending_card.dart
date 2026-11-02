import 'package:flutter/material.dart';

import '../../design/tokens.dart';
import '../../models/activity.dart';
import '../plate.dart';

/// **بطاقةُ «بانتظارك»** — §5.6.
///
/// **ووسمان تحت كلّ لوحة**: الدورُ بصيغة المخاطب ونوعُ الصفقة. فمن يفتح
/// «نشاطي» يرى عشرَ لوحاتٍ متشابهة ولا يعرف في أيّها هو البائعُ وفي أيّها
/// المشتري، ولا ما نوعُ الصفقة. **والنداءُ وحده لا يكفي**: «أكّد بياناتك»
/// تُقال للمشتري و«انقل الملكية» للبائع، ومن لم يُقل له دورُه قرأ النداءَ
/// ثمّ سأل: ولماذا أنا؟
class PendingCard extends StatelessWidget {
  const PendingCard({
    super.key,
    required this.item,
    this.onAct,
    this.onAccept,
    this.onDecline,
  });

  final PendingItem item;
  final VoidCallback? onAct;
  final VoidCallback? onAccept;
  final VoidCallback? onDecline;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadii.card),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              SizedBox(width: 140, child: _plateColumn()),
              const SizedBox(width: 12),
              Expanded(child: _textColumn()),
            ],
          ),
          const SizedBox(height: 12),
          if (item.kind == PendingKind.offer)
            Row(
              children: [
                Expanded(
                  child: _Button(
                    label: 'اقبل السوم',
                    color: AppColors.accent2_700,
                    onTap: onAccept,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _Button(
                    label: 'ارفض',
                    color: AppColors.neutral100,
                    textColor: AppColors.text,
                    onTap: onDecline,
                  ),
                ),
              ],
            )
          else
            _Button(label: item.cta, color: AppColors.accent, onTap: onAct),
        ],
      ),
    );
  }

  Widget _plateColumn() => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    mainAxisSize: MainAxisSize.min,
    children: [
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: AppColors.neutral200,
          borderRadius: BorderRadius.circular(AppRadii.plateInset),
        ),
        child: SaudiPlate(
          letters: item.letters,
          number: item.number,
          kind: item.plateKind,
          format: item.format,
          emblem: item.emblem,
        ),
      ),
      const SizedBox(height: 6),
      Wrap(
        spacing: 4,
        runSpacing: 4,
        children: [
          _Tag(
            label: item.role == ActorRole.buyer ? 'أنت المشتري' : 'أنت البائع',
            bg: item.role == ActorRole.buyer
                ? AppColors.accent2_200
                : AppColors.accent200,
            fg: item.role == ActorRole.buyer
                ? AppColors.accent2_800
                : AppColors.accent900,
          ),
          _Tag(
            label: item.saleLabel,
            bg: Colors.transparent,
            fg: AppColors.neutral800,
            border: true,
            dot: _saleColor,
          ),
        ],
      ),
    ],
  );

  Color get _saleColor => switch (item.saleLabel) {
    'بيع مباشر' => AppColors.accent2,
    'سوم' => AppColors.neutral700,
    _ => AppColors.accent,
  };

  Widget _textColumn() => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    mainAxisSize: MainAxisSize.min,
    children: [
      Text(
        item.kicker,
        style: AppText.body(
          11.5,
          color: AppColors.accent700,
          weight: FontWeight.w700,
        ),
      ),
      const SizedBox(height: 2),
      Text(
        item.title,
        style: AppText.body(
          14.5,
          weight: FontWeight.w700,
        ).copyWith(height: 1.35),
      ),
      const SizedBox(height: 2),
      Text(
        item.sub,
        style: AppText.body(
          12,
          color: AppColors.neutral700,
        ).copyWith(height: 1.5),
      ),
    ],
  );
}

class _Tag extends StatelessWidget {
  const _Tag({
    required this.label,
    required this.bg,
    required this.fg,
    this.border = false,
    this.dot,
  });

  final String label;
  final Color bg;
  final Color fg;
  final bool border;
  final Color? dot;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
    decoration: BoxDecoration(
      color: bg,
      borderRadius: BorderRadius.circular(AppRadii.pill),
      border: border ? Border.all(color: AppColors.divider) : null,
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (dot != null) ...[
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(color: dot, shape: BoxShape.circle),
          ),
          const SizedBox(width: 4),
        ],
        Text(
          label,
          maxLines: 1,
          softWrap: false,
          style: AppText.body(10.5, color: fg, weight: FontWeight.w700),
        ),
      ],
    ),
  );
}

class _Button extends StatelessWidget {
  const _Button({
    required this.label,
    required this.color,
    this.textColor = Colors.white,
    this.onTap,
  });

  final String label;
  final Color color;
  final Color textColor;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    behavior: HitTestBehavior.opaque,
    child: Container(
      height: 44,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      alignment: Alignment.center,
      child: Text(
        label,
        style: AppText.body(15, color: textColor, weight: FontWeight.w700),
      ),
    ),
  );
}
