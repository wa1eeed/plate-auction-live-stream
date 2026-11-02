import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../design/tokens.dart';
import '../models/wallet.dart';
import '../widgets/listing/bid_log.dart' show formatStamp;
import '../widgets/plate.dart';

/// **شاشةُ المحفظة** — §5.8.
class WalletScreen extends StatelessWidget {
  const WalletScreen({super.key, required this.wallet, this.onBack});

  final WalletView wallet;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 10),
          child: Row(
            children: [
              GestureDetector(
                onTap: onBack,
                behavior: HitTestBehavior.opaque,
                child: Container(
                  width: 42,
                  height: 42,
                  decoration: const BoxDecoration(
                    color: AppColors.surface,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(LucideIcons.arrowRight, size: 20),
                ),
              ),
              const SizedBox(width: 10),
              Text('المحفظة', style: AppText.heading(24)),
            ],
          ),
        ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 90),
            children: [
              _balanceCard(),
              const SizedBox(height: 16),
              _actions(),
              if (wallet.deposits.isNotEmpty) ...[
                const SizedBox(height: 16),
                Text('عرابين محجوزة الآن', style: AppText.heading(19)),
                const SizedBox(height: 8),
                for (final d in wallet.deposits) ...[
                  _HeldCard(deposit: d),
                  const SizedBox(height: 8),
                ],
              ],
              const SizedBox(height: 8),
              Text('كشف الحساب', style: AppText.heading(19)),
              const SizedBox(height: 8),
              _ledger(),
            ],
          ),
        ),
      ],
    );
  }

  /// **البطاقةُ الكبيرة** — المتاحُ أوّلًا، والكلّيُّ والمحجوزُ خانتين تحته.
  Widget _balanceCard() => ClipRRect(
    borderRadius: BorderRadius.circular(AppRadii.banner),
    child: Container(
      color: AppColors.text,
      child: Stack(
        children: [
          PositionedDirectional(
            start: -60,
            top: -90,
            child: Container(
              width: 180,
              height: 180,
              decoration: const BoxDecoration(
                color: AppColors.accent2_600,
                shape: BoxShape.circle,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Opacity(
                  opacity: 0.8,
                  child: Text(
                    'المتاح',
                    style: AppText.body(12.5, color: AppColors.bg),
                  ),
                ),
                const SizedBox(height: 14),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Flexible(
                      child: Text(
                        _money(wallet.available),
                        maxLines: 1,
                        softWrap: false,
                        style: AppText.money(40).copyWith(
                          color: AppColors.bg,
                          height: 1,
                          letterSpacing: -0.4,
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text('ر.س', style: AppText.body(15, color: AppColors.bg)),
                  ],
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(child: _miniBox('الرصيد الكلي', wallet.balance)),
                    const SizedBox(width: 8),
                    Expanded(child: _miniBox('محجوز كعرابين', wallet.held)),
                  ],
                ),
                const SizedBox(height: 14),

                /// **والمحجوزُ ما زال ملكك** — فلا يُقرأ خصمًا.
                Opacity(
                  opacity: 0.85,
                  child: Text(
                    'المحجوز ما زال ملكك — يعود متاحًا حين يُحسم مزاده.',
                    style: AppText.body(
                      12,
                      color: AppColors.bg,
                    ).copyWith(height: 1.6),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );

  Widget _miniBox(String label, int amount) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
    decoration: BoxDecoration(
      color: AppColors.bg.withValues(alpha: 0.12),
      borderRadius: BorderRadius.circular(10),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Opacity(
          opacity: 0.8,
          child: Text(label, style: AppText.body(11.5, color: AppColors.bg)),
        ),
        const SizedBox(height: 2),
        Text(
          _money(amount),
          style: AppText.money(16).copyWith(color: AppColors.bg),
        ),
      ],
    ),
  );

  Widget _actions() => Row(
    children: [
      Expanded(
        child: _Button(
          label: 'اشحن رصيدك',
          color: AppColors.accent,
          textColor: AppColors.neutral100,
        ),
      ),
      const SizedBox(width: 8),
      Expanded(
        child: _Button(
          label: 'اطلب سحبًا',
          color: AppColors.neutral100,
          textColor: AppColors.text,
        ),
      ),
    ],
  );

  Widget _ledger() => Container(
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
    decoration: BoxDecoration(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(AppRadii.card),
    ),
    child: Column(
      children: [
        for (var i = 0; i < wallet.ledger.length; i++) ...[
          _LedgerRow(entry: wallet.ledger[i]),
          if (i != wallet.ledger.length - 1)
            Container(height: 1, color: AppColors.divider),
        ],
      ],
    ),
  );

  static String _money(int halalas) => (halalas ~/ 100)
      .toString()
      .replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+$)'), (m) => '${m[1]},');
}

class _Button extends StatelessWidget {
  const _Button({
    required this.label,
    required this.color,
    required this.textColor,
  });

  final String label;
  final Color color;
  final Color textColor;

  @override
  Widget build(BuildContext context) => Container(
    height: 48,
    decoration: BoxDecoration(
      color: color,
      borderRadius: BorderRadius.circular(AppRadii.pill),
    ),
    alignment: Alignment.center,
    child: Text(
      label,
      style: AppText.body(16, color: textColor, weight: FontWeight.w700),
    ),
  );
}

/// عربونٌ محجوزٌ — **ومعه سببُه**.
class _HeldCard extends StatelessWidget {
  const _HeldCard({required this.deposit});

  final HeldDeposit deposit;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(AppRadii.card),
    ),
    child: Row(
      children: [
        Container(
          width: 142,
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            color: AppColors.neutral200,
            borderRadius: BorderRadius.circular(AppRadii.plateInset),
          ),
          child: SaudiPlate(
            letters: deposit.letters,
            number: deposit.number,
            kind: deposit.kind,
            format: deposit.format,
            emblem: deposit.emblem,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${WalletScreen._money(deposit.amount)} ر.س',
                style: AppText.body(15, weight: FontWeight.w700),
              ),
              const SizedBox(height: 2),
              Text(
                deposit.why,
                style: AppText.body(
                  12,
                  color: AppColors.neutral700,
                ).copyWith(height: 1.5),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

/// سطرُ كشفٍ — **بمرجعه وختمه وحاله**.
class _LedgerRow extends StatelessWidget {
  const _LedgerRow({required this.entry});

  final LedgerEntry entry;

  @override
  Widget build(BuildContext context) {
    final incoming = entry.amount > 0;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  entry.title,
                  style: AppText.body(13, weight: FontWeight.w700),
                ),
                const SizedBox(height: 3),
                Row(
                  children: [
                    Text(
                      '${WalletScreen._money(entry.amount.abs())} ر.س',
                      style: AppText.digits(
                        12,
                        weight: FontWeight.w600,
                        color: incoming
                            ? AppColors.accent2_700
                            : AppColors.neutral800,
                      ),
                    ),
                    if (entry.note != null) ...[
                      Text(
                        ' · ',
                        style: AppText.body(12, color: AppColors.neutral600),
                      ),
                      Flexible(
                        child: Text(
                          entry.note!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppText.body(12, color: AppColors.neutral700),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 3),
                Directionality(
                  textDirection: TextDirection.ltr,
                  child: Text(
                    formatStamp(entry.at),
                    style: AppText.digits(
                      10.5,
                      weight: FontWeight.w500,
                      color: AppColors.neutral600,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(
            entry.status,
            style: AppText.body(11.5, color: AppColors.neutral700),
          ),
        ],
      ),
    );
  }
}
