import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../design/tokens.dart';

/// **بطاقةُ المحفظة** — بنسبةِ بطاقةٍ بنكيّةٍ `1.586:1` (§5.9).
///
/// **ورقمُ العضويّة مكان رقم البطاقة**: شكلٌ يعرفه كلُّ أحدٍ، فيُقرأ المتاحُ
/// فيه بلا تعلّم. وليست بطاقةَ دفعٍ ولا تُوهم بذلك — لا شعارَ شبكةٍ ولا
/// تاريخَ انتهاء.
class BankCard extends StatelessWidget {
  const BankCard({
    super.key,
    required this.membershipNumber,
    required this.holderName,
    required this.available,
    required this.balance,
    required this.held,
    this.onOpenWallet,
  });

  final String membershipNumber;
  final String holderName;
  final int available;
  final int balance;
  final int held;
  final VoidCallback? onOpenWallet;

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: 1.586 / 1,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topRight,
              end: Alignment.bottomLeft,
              colors: [AppColors.accent700, AppColors.accent900],
            ),
          ),
          child: Stack(
            children: [
              PositionedDirectional(
                start: -80,
                bottom: -150,
                child: Opacity(
                  opacity: 0.35,
                  child: Container(
                    width: 260,
                    height: 260,
                    decoration: const BoxDecoration(
                      color: AppColors.accent600,
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
              ),
              PositionedDirectional(
                end: -50,
                top: -60,
                child: Container(
                  width: 180,
                  height: 180,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: AppColors.neutral100.withValues(alpha: 0.18),
                      width: 1.5,
                    ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 18,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Opacity(
                                opacity: 0.75,
                                child: Text(
                                  'محفظة',
                                  style: AppText.body(
                                    12,
                                    color: AppColors.neutral100,
                                  ),
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'سوق تداول اللوحات',
                                style: AppText.heading(16).copyWith(
                                  color: AppColors.neutral100,
                                  height: 1.1,
                                ),
                              ),
                            ],
                          ),
                        ),
                        // **وزرُّ المحفظة في الزاوية** — البطاقةُ ملخّصٌ،
                        // والتفصيلُ خلفها بضغطة.
                        GestureDetector(
                          onTap: onOpenWallet,
                          behavior: HitTestBehavior.opaque,
                          child: Container(
                            height: 34,
                            padding: const EdgeInsets.symmetric(horizontal: 14),
                            decoration: BoxDecoration(
                              color: AppColors.neutral100.withValues(
                                alpha: 0.14,
                              ),
                              borderRadius: BorderRadius.circular(
                                AppRadii.pill,
                              ),
                              border: Border.all(
                                color: AppColors.neutral100.withValues(
                                  alpha: 0.35,
                                ),
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  'المحفظة',
                                  style: AppText.body(
                                    12.5,
                                    color: AppColors.neutral100,
                                    weight: FontWeight.w700,
                                  ),
                                ),
                                const SizedBox(width: 6),
                                const Icon(
                                  LucideIcons.chevronLeft,
                                  size: 15,
                                  color: AppColors.neutral100,
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                    Row(
                      children: [
                        const _GoldChip(),
                        const SizedBox(width: 12),
                        Opacity(
                          opacity: 0.85,
                          child: Directionality(
                            textDirection: TextDirection.ltr,
                            child: Text(
                              membershipNumber,
                              style: AppText.digits(
                                13,
                                weight: FontWeight.w500,
                                color: AppColors.neutral100,
                              ).copyWith(letterSpacing: 2.34),
                            ),
                          ),
                        ),
                      ],
                    ),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Opacity(
                                opacity: 0.75,
                                child: Text(
                                  'المتاح',
                                  style: AppText.body(
                                    11.5,
                                    color: AppColors.neutral100,
                                  ),
                                ),
                              ),
                              const SizedBox(height: 2),
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.baseline,
                                textBaseline: TextBaseline.alphabetic,
                                children: [
                                  Flexible(
                                    child: Text(
                                      _money(available),
                                      maxLines: 1,
                                      softWrap: false,
                                      style: AppText.money(30).copyWith(
                                        color: AppColors.neutral100,
                                        height: 1,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    'ر.س',
                                    style: AppText.body(
                                      13,
                                      color: AppColors.neutral100,
                                      weight: FontWeight.w600,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 10),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Opacity(
                              opacity: 0.75,
                              child: Text(
                                'الرصيد ${_money(balance)}',
                                style: AppText.digits(
                                  11.5,
                                  weight: FontWeight.w500,
                                  color: AppColors.neutral100,
                                ),
                              ),
                            ),
                            Opacity(
                              opacity: 0.75,
                              child: Text(
                                'محجوز ${_money(held)}',
                                style: AppText.digits(
                                  11.5,
                                  weight: FontWeight.w500,
                                  color: AppColors.neutral100,
                                ),
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              holderName,
                              style: AppText.body(
                                11.5,
                                color: AppColors.neutral100,
                                weight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static String _money(int halalas) => (halalas ~/ 100)
      .toString()
      .replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+$)'), (m) => '${m[1]},');
}

/// الشريحةُ الذهبيّة — أربعُ خاناتٍ داخل مستطيلٍ متدرّج.
class _GoldChip extends StatelessWidget {
  const _GoldChip();

  @override
  Widget build(BuildContext context) => Container(
    width: 42,
    height: 32,
    padding: const EdgeInsets.all(5),
    decoration: BoxDecoration(
      gradient: const LinearGradient(
        begin: Alignment.topRight,
        end: Alignment.bottomLeft,
        colors: [Color(0xFFE9D9A6), Color(0xFFB9A160), Color(0xFFE6D39B)],
        stops: [0, 0.55, 1],
      ),
      borderRadius: BorderRadius.circular(6),
      border: Border.all(color: const Color(0x26000000)),
    ),
    child: GridView.count(
      crossAxisCount: 2,
      mainAxisSpacing: 2,
      crossAxisSpacing: 2,
      physics: const NeverScrollableScrollPhysics(),
      children: List.generate(
        4,
        (_) => DecoratedBox(
          decoration: BoxDecoration(
            border: Border.all(color: const Color(0x2E000000)),
            borderRadius: BorderRadius.circular(2),
          ),
        ),
      ),
    ),
  );
}
