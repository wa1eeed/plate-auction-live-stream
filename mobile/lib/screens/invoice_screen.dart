import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../design/tokens.dart';
import '../models/order.dart';
import '../widgets/listing/bid_log.dart' show formatStamp;

/// **الفاتورةُ الضريبيّة المبسّطة** — §5.7.
///
/// **وقيمةُ اللوحة لا تدخلها**: المنصّةُ تفوتر عمولتَها وحدها، والثمنُ أمانةٌ
/// تمرّ بها إلى البائع. وفاتورةٌ بقيمة اللوحة تُقرأ بيعًا من المنصّة، وهي
/// وسيطٌ لا بائع — ويختلّ بها حسابُ الضريبة عند الطرفين.
class InvoiceScreen extends StatelessWidget {
  const InvoiceScreen({
    super.key,
    required this.order,
    required this.commission,
    this.onBack,
  });

  final OrderView order;

  /// العمولةُ بالهللات — قبل الضريبة.
  final int commission;

  final VoidCallback? onBack;

  /// ضريبةُ القيمة المضافة ‎١٥٪‎ **على العمولة وحدها**.
  int get _vat => commission * 15 ~/ 100;

  String get _number =>
      'INV-2026-${order.reference.substring(order.reference.length - 5)}';

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
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
              Expanded(
                child: Text('الفاتورة الضريبية', style: AppText.heading(20)),
              ),
              Container(
                height: 38,
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(
                  color: AppColors.neutral100,
                  border: Border.all(color: AppColors.divider),
                  borderRadius: BorderRadius.circular(AppRadii.pill),
                ),
                alignment: Alignment.center,
                child: Text(
                  'تنزيل PDF',
                  style: AppText.body(12.5, weight: FontWeight.w700),
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 90),
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 18,
                  vertical: 20,
                ),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.divider),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'سوق تداول اللوحات',
                                style: AppText.body(
                                  15,
                                  weight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'الرقم الضريبي 300000000000003',
                                style: AppText.digits(
                                  11,
                                  weight: FontWeight.w500,
                                  color: AppColors.neutral700,
                                ),
                              ),
                            ],
                          ),
                        ),
                        /* مكانُ رمز ZATCA — يُولَّد في الخادم */
                        Container(
                          width: 62,
                          height: 62,
                          decoration: BoxDecoration(
                            color: AppColors.neutral200,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(
                            LucideIcons.qrCode,
                            size: 28,
                            color: AppColors.neutral600,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Container(height: 1, color: AppColors.divider),
                    const SizedBox(height: 14),
                    _row('رقم الفاتورة', _number, mono: true),
                    _row('التاريخ', formatStamp(order.createdAt), mono: true),
                    _row('رقم الصفقة', order.reference, mono: true),
                    _row('اللوحة', '${order.letters} ${order.number}'),
                    _row('نوع البيع', order.source),
                    const SizedBox(height: 14),
                    Container(height: 1, color: AppColors.divider),
                    const SizedBox(height: 14),
                    _row(
                      order.youAreBuyer
                          ? 'عمولة المنصّة على المشتري (2٪)'
                          : 'عمولة المنصّة على البائع (2.5٪)',
                      '${_money(commission)} ر.س',
                    ),
                    _row('ضريبة القيمة المضافة (15٪)', '${_money(_vat)} ر.س'),
                    const SizedBox(height: 10),
                    Container(height: 1, color: AppColors.divider),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            'الإجمالي',
                            style: AppText.body(14, weight: FontWeight.w700),
                          ),
                        ),
                        Text(
                          '${_money(commission + _vat)} ر.س',
                          style: AppText.money(18),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.accent100,
                  borderRadius: BorderRadius.circular(AppRadii.card),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(
                      LucideIcons.info,
                      size: 16,
                      color: AppColors.accent800,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        order.youAreBuyer
                            ? 'قيمة اللوحة أمانة تُحوَّل للبائع ولا تدخل '
                                  'الفاتورة — المنصّة تفوتر عمولتها فقط.'
                            : 'قيمة اللوحة لا تدخل الفاتورة — المنصّة '
                                  'تفوتر عمولتها فقط.',
                        style: AppText.body(
                          12.5,
                          color: AppColors.accent900,
                        ).copyWith(height: 1.7),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _row(String label, String value, {bool mono = false}) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 5),
    child: Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: AppText.body(12.5, color: AppColors.neutral700),
          ),
        ),
        mono
            ? Directionality(
                textDirection: TextDirection.ltr,
                child: Text(
                  value,
                  style: AppText.digits(12.5, weight: FontWeight.w600),
                ),
              )
            : Text(value, style: AppText.body(12.5, weight: FontWeight.w600)),
      ],
    ),
  );

  static String _money(int halalas) => (halalas ~/ 100)
      .toString()
      .replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+$)'), (m) => '${m[1]},');
}
