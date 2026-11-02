import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../design/tokens.dart';
import '../../models/wallet.dart';

/// ما اختاره المستخدم: مبلغٌ وطريقة.
typedef TopUpChoice = (int amountRiyals, bool byCard);

/// **ورقةُ شحن الرصيد** — §5.8 من حزمة التسليم.
///
/// ثلاثةُ مبالغَ في شبكةٍ ثلاثيّة، ومربّعُها ‎٦٤‎ بحدٍّ ‎١٫٥‎ وزاويةِ كرت.
/// وما زاد على النموذج فلأنّ النموذج يزيد الرصيدَ فورًا، والحقيقةُ أنّ
/// للشحن طريقتين تُطفئهما الإدارةُ من لوحتها — فلا بدّ أن يُقال أيُّهما
/// حاضرةٌ قبل أن يختار المبلغ، لا أن يُرَدّ طلبُه بعده.
Future<TopUpChoice?> showTopUpSheet(
  BuildContext context,
  PaymentOptions options,
) {
  return showModalBottomSheet<TopUpChoice>(
    context: context,
    backgroundColor: AppColors.bg,
    isScrollControlled: true,
    barrierColor: AppColors.neutral900.withValues(alpha: 0.45),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.sheet)),
    ),
    builder: (context) => _TopUpSheet(options: options),
  );
}

class _TopUpSheet extends StatefulWidget {
  const _TopUpSheet({required this.options});

  final PaymentOptions options;

  @override
  State<_TopUpSheet> createState() => _TopUpSheetState();
}

class _TopUpSheetState extends State<_TopUpSheet> {
  /// المبالغُ الثلاثةُ من التصميم — بالريال.
  static const _amounts = [5000, 10000, 25000];

  int? _picked;
  late bool _byCard = widget.options.cardEnabled;

  @override
  Widget build(BuildContext context) {
    final o = widget.options;

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
          Text('اشحن رصيدك', style: AppText.heading(22)),
          const SizedBox(height: 12),
          Text(
            o.none
                ? 'لا طريقة شحن مفعّلة الآن — تواصل مع الإدارة.'
                : _subtitle(o),
            style: AppText.body(13, color: AppColors.neutral700),
          ),
          if (!o.none) ...[
            const SizedBox(height: 12),
            _grid(),
            /* والطريقةُ تُختار حين تُتاح الاثنتان — لا سؤالَ بلا خيار */
            if (o.cardEnabled && o.bankEnabled) ...[
              const SizedBox(height: 12),
              _methods(),
            ],
            if (!_byCard && o.bank != null) ...[
              const SizedBox(height: 12),
              _bank(o.bank!),
            ],
            const SizedBox(height: 14),
            _confirm(),
          ],
        ],
      ),
    );
  }

  String _subtitle(PaymentOptions o) {
    if (o.cardEnabled && o.bankEnabled) {
      return 'مدى · Apple Pay · بطاقة ائتمانية — أو حوالة بنكية';
    }
    return o.cardEnabled
        ? 'مدى · Apple Pay · بطاقة ائتمانية'
        : 'حوالة بنكية — يُضاف رصيدك بعد توثيق الإدارة';
  }

  /// شبكةٌ ثلاثيّةٌ بفاصلِ ‎٨‎ ومربّعِ ‎٦٤‎.
  Widget _grid() => Row(
    children: [
      for (final (i, amount) in _amounts.indexed) ...[
        if (i != 0) const SizedBox(width: 8),
        Expanded(
          child: GestureDetector(
            onTap: () => setState(() => _picked = amount),
            behavior: HitTestBehavior.opaque,
            child: Container(
              height: 64,
              decoration: BoxDecoration(
                color: AppColors.neutral100,
                border: Border.all(
                  color: _picked == amount
                      ? AppColors.accent
                      : AppColors.divider,
                  width: 1.5,
                ),
                borderRadius: BorderRadius.circular(AppRadii.card),
              ),
              alignment: Alignment.center,
              child: Text(
                _money(amount),
                style: AppText.digits(20, weight: FontWeight.w700),
              ),
            ),
          ),
        ),
      ],
    ],
  );

  Widget _methods() => Row(
    children: [
      Expanded(child: _method('بطاقة', LucideIcons.creditCard, true)),
      const SizedBox(width: 8),
      Expanded(child: _method('حوالة', LucideIcons.landmark, false)),
    ],
  );

  Widget _method(String label, IconData icon, bool card) {
    final active = _byCard == card;

    return GestureDetector(
      onTap: () => setState(() => _byCard = card),
      behavior: HitTestBehavior.opaque,
      child: Container(
        height: 46,
        decoration: BoxDecoration(
          color: active ? AppColors.accent100 : AppColors.neutral100,
          border: Border.all(
            color: active ? AppColors.accent : AppColors.divider,
            width: 1.5,
          ),
          borderRadius: BorderRadius.circular(AppRadii.pill),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 16,
              color: active ? AppColors.accent900 : AppColors.text,
            ),
            const SizedBox(width: 7),
            Text(
              label,
              style: AppText.body(
                13.5,
                weight: FontWeight.w700,
                color: active ? AppColors.accent900 : AppColors.text,
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// **بياناتُ الحساب تُعرض قبل التأكيد لا بعده.**
  ///
  /// فمن اختار الحوالةَ يحتاج الآيبانَ ليحوّل — وورقةٌ تُغلق ثمّ تطلب منه
  /// العودةَ إلى «عملياتي» ليقرأه تجعله يحوّل من ذاكرته أو لا يحوّل.
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
        if (bank.instructions.isNotEmpty) ...[
          const SizedBox(height: 8),
          Text(
            bank.instructions,
            style: AppText.body(
              11.5,
              color: AppColors.neutral700,
            ).copyWith(height: 1.6),
          ),
        ],
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

  Widget _confirm() {
    final ready = _picked != null;

    return GestureDetector(
      onTap: ready ? () => Navigator.pop(context, (_picked!, _byCard)) : null,
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
          child: Text(
            ready
                ? '${_byCard ? 'ادفع' : 'سجّل حوالة'} ${_money(_picked!)} ر.س'
                : 'اختر مبلغًا',
            style: AppText.heading(18).copyWith(color: AppColors.neutral100),
          ),
        ),
      ),
    );
  }

  static String _money(int riyals) => riyals.toString().replaceAllMapped(
    RegExp(r'(\d)(?=(\d{3})+$)'),
    (m) => '${m[1]},',
  );
}
