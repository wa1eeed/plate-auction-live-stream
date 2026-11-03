import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../design/tokens.dart';
import '../../models/checkout.dart';
import '../../models/wallet.dart';

/// **ورقةُ سداد الصفقة** — تُفتح من «سدّد الآن» في شاشة الصفقة.
///
/// **وكانت المرحلةُ تُسمّى ولا يُسدَّد فيها شيء**: بطاقةُ النداء تقول
/// «سدّد من محفظتك أو بحوالة بنكية» ولا زرَّ تحتها — فيفتحها المشتري
/// ويقرأ ما عليه ثمّ يخرج كما دخل.
///
/// **والمطلوبُ يأتي محسوبًا من الخادم** مع تفصيله، فلا يُعرَض رقمٌ هنا
/// ثمّ يُخصم غيرُه هناك.
Future<PayMethod?> showPaySheet(BuildContext context, CheckoutInfo info) {
  return showModalBottomSheet<PayMethod>(
    context: context,
    backgroundColor: AppColors.bg,
    isScrollControlled: true,
    barrierColor: AppColors.neutral900.withValues(alpha: 0.45),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.sheet)),
    ),
    builder: (context) => _PaySheet(info: info),
  );
}

class _PaySheet extends StatefulWidget {
  const _PaySheet({required this.info});

  final CheckoutInfo info;

  @override
  State<_PaySheet> createState() => _PaySheetState();
}

class _PaySheetState extends State<_PaySheet> {
  late PayMethod? _picked = widget.info.preferred;

  @override
  Widget build(BuildContext context) {
    final info = widget.info;

    return Padding(
      padding: EdgeInsets.only(
        left: 18,
        right: 18,
        top: 18,
        bottom: MediaQuery.viewInsetsOf(context).bottom + 22,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('سدّد الصفقة', style: AppText.heading(22)),
          const SizedBox(height: 4),
          Text(
            '${info.plateLabel} · البائع ${info.sellerName}',
            style: AppText.body(12.5, color: AppColors.neutral700),
          ),
          const SizedBox(height: 12),
          _due(info),
          const SizedBox(height: 12),
          if (info.none)
            Text(
              'لا وسيلة سداد متاحة الآن — تواصل مع الإدارة.',
              style: AppText.body(13, color: AppColors.neutral700),
            )
          else ...[
            for (final option in info.methods) ...[
              _method(option),
              const SizedBox(height: 8),
            ],
            if (_picked == PayMethod.bank && info.bank != null) ...[
              const SizedBox(height: 4),
              _bank(info.bank!),
            ],
            const SizedBox(height: 10),
            _confirm(info),
          ],
        ],
      ),
    );
  }

  /// **المطلوبُ كبيرًا، وتفصيلُه تحته** — فلا يُسأل عن فرقٍ بين رقمين.
  Widget _due(CheckoutInfo info) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: AppColors.neutral100,
      borderRadius: BorderRadius.circular(AppRadii.banner),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'المطلوب الآن',
          style: AppText.body(12, color: AppColors.neutral700),
        ),
        const SizedBox(height: 2),
        Text('${_money(info.due)} ر.س', style: AppText.money(28)),
        const SizedBox(height: 10),
        _line('قيمة اللوحة', info.price),
        /* وما لا وجود له لا يُعرَض صفرًا — السومُ والبيعُ المباشر بلا عربون */
        if (info.depositApplied > 0)
          _line('العربون المخصوم', -info.depositApplied),
        if (info.commission > 0) _line('عمولتك وضريبتها', info.commission),
      ],
    ),
  );

  Widget _line(String label, int halalas) => Padding(
    padding: const EdgeInsets.only(top: 4),
    child: Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: AppText.body(12, color: AppColors.neutral700),
          ),
        ),
        Text(
          '${halalas < 0 ? '−' : ''}${_money(halalas.abs())}',
          style: AppText.digits(12.5, weight: FontWeight.w600),
        ),
      ],
    ),
  );

  /// **ووسيلةٌ معطَّلةٌ تظهر بسببها** — باهتةً لا محجوبة.
  Widget _method(PayOption option) {
    final active = _picked == option.method;

    return GestureDetector(
      onTap: option.available
          ? () => setState(() => _picked = option.method)
          : null,
      behavior: HitTestBehavior.opaque,
      child: Opacity(
        opacity: option.available ? 1 : 0.55,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
          decoration: BoxDecoration(
            color: active ? AppColors.accent100 : AppColors.neutral100,
            border: Border.all(
              color: active ? AppColors.accent : AppColors.divider,
              width: 1.5,
            ),
            borderRadius: BorderRadius.circular(AppRadii.card),
          ),
          child: Row(
            children: [
              Icon(
                _icon(option.method),
                size: 18,
                color: active ? AppColors.accent900 : AppColors.text,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      option.label,
                      style: AppText.body(13.5, weight: FontWeight.w700),
                    ),
                    const SizedBox(height: 1),
                    Text(
                      option.hint,
                      style: AppText.body(11, color: AppColors.neutral700),
                    ),
                  ],
                ),
              ),
              if (active) ...[
                const SizedBox(width: 8),
                const Icon(
                  LucideIcons.circleCheck,
                  size: 18,
                  color: AppColors.accent900,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  static IconData _icon(PayMethod m) => switch (m) {
    PayMethod.wallet => LucideIcons.wallet,
    PayMethod.card => LucideIcons.creditCard,
    PayMethod.bank => LucideIcons.landmark,
  };

  /// بياناتُ الحساب تُعرض قبل التأكيد — كما في ورقة الشحن.
  Widget _bank(BankDetails bank) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(AppRadii.card),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(bank.name, style: AppText.body(13.5, weight: FontWeight.w700)),
        const SizedBox(height: 2),
        Text(
          bank.accountName,
          style: AppText.body(12, color: AppColors.neutral700),
        ),
        const SizedBox(height: 10),
        GestureDetector(
          onTap: () => _copyIban(bank.iban),
          behavior: HitTestBehavior.opaque,
          child: Row(
            children: [
              Expanded(
                child: Directionality(
                  textDirection: TextDirection.ltr,
                  child: Text(
                    bank.iban,
                    style: AppText.digits(13, weight: FontWeight.w600),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              const Icon(LucideIcons.copy, size: 15),
            ],
          ),
        ),
      ],
    ),
  );

  Future<void> _copyIban(String iban) async {
    await Clipboard.setData(ClipboardData(text: iban));
    if (!mounted) return;
    ScaffoldMessenger.maybeOf(context)
      ?..hideCurrentSnackBar()
      ..showSnackBar(const SnackBar(content: Text('نُسخ الآيبان')));
  }

  Widget _confirm(CheckoutInfo info) {
    final ready = _picked != null;

    return GestureDetector(
      onTap: ready ? () => Navigator.pop(context, _picked) : null,
      behavior: HitTestBehavior.opaque,
      child: Opacity(
        opacity: ready ? 1 : 0.5,
        child: Container(
          height: 54,
          decoration: BoxDecoration(
            color: AppColors.accent,
            borderRadius: BorderRadius.circular(AppRadii.pill),
          ),
          alignment: Alignment.center,
          child: Text(switch (_picked) {
            PayMethod.wallet => 'ادفع ${_money(info.due)} ر.س من محفظتك',
            PayMethod.card => 'افتح صفحة الدفع',
            PayMethod.bank => 'سجّل حوالة ${_money(info.due)} ر.س',
            null => 'اختر وسيلة',
          }, style: AppText.heading(17).copyWith(color: AppColors.neutral100)),
        ),
      ),
    );
  }

  static String _money(int halalas) => (halalas ~/ 100)
      .toString()
      .replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+$)'), (m) => '${m[1]},');
}
