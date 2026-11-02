import 'package:flutter/material.dart';

import '../../design/tokens.dart';

/// **مفتاحٌ بمقاس iOS** — ‎٥١×٣١‎ وإبهامٌ ‎٢٧‎ (§5.10).
class IosSwitch extends StatelessWidget {
  const IosSwitch({super.key, required this.value, required this.onChanged});

  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) => Semantics(
    toggled: value,
    child: GestureDetector(
      onTap: () => onChanged(!value),
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: 51,
        height: 31,
        decoration: BoxDecoration(
          color: value ? AppColors.accent : AppColors.neutral400,
          borderRadius: BorderRadius.circular(AppRadii.pill),
        ),
        child: AnimatedAlign(
          duration: const Duration(milliseconds: 200),
          alignment: value
              ? AlignmentDirectional.centerEnd
              : AlignmentDirectional.centerStart,
          child: Container(
            width: 27,
            height: 27,
            margin: const EdgeInsets.symmetric(horizontal: 2),
            decoration: const BoxDecoration(
              color: Colors.white,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  offset: Offset(0, 2),
                  blurRadius: 4,
                  color: Color(0x33000000),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}
