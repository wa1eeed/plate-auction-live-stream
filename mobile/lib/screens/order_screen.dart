import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../design/tokens.dart';
import '../models/order.dart';
import '../widgets/order/identity_form.dart';
import '../widgets/order/order_rail.dart';
import '../widgets/plate.dart';

/// **شاشةُ الصفقة** — §5.7.
class OrderScreen extends StatelessWidget {
  const OrderScreen({
    super.key,
    required this.order,
    this.counterpartPhone,
    this.counterpartId,
    this.onBack,
    this.onOpenChat,
    this.onOpenInvoice,
  });

  final OrderView order;

  /// جوالُ الطرف الآخر — يظهر بعد تأكيد المشتري بياناته.
  final String? counterpartPhone;

  /// رقمُ هوية المشتري — للبائع وحده، وبعد التأكيد.
  final String? counterpartId;

  final VoidCallback? onBack;
  final VoidCallback? onOpenChat;
  final VoidCallback? onOpenInvoice;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _header(),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
            children: [
              _identityCard(),
              const SizedBox(height: 14),
              _railCard(),
              const SizedBox(height: 14),
              if (order.stage == OrderStage.id && order.youAreBuyer)
                const IdentityForm()
              else
                _callCard(),
              const SizedBox(height: 14),
              _counterpartCard(),
              const SizedBox(height: 14),
              _links(),
            ],
          ),
        ),
      ],
    );
  }

  Widget _header() => Padding(
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
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'صفقة ${order.reference} · ${order.source}',
                style: AppText.body(12, color: AppColors.neutral700),
              ),
              Text(
                order.stageName,
                style: AppText.heading(20).copyWith(height: 1.2),
              ),
            ],
          ),
        ),
      ],
    ),
  );

  /// ترويسةُ الهويّة: اللوحةُ والمبلغُ والطرفان و«(أنت)».
  Widget _identityCard() => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(AppRadii.card),
    ),
    child: Row(
      children: [
        Container(
          width: 154,
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            color: AppColors.neutral200,
            borderRadius: BorderRadius.circular(AppRadii.plateInset),
          ),
          child: SaudiPlate(
            letters: order.letters,
            number: order.number,
            kind: order.plateKind,
            format: order.format,
            emblem: order.emblem,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('$_money ر.س', style: AppText.money(20)),
              const SizedBox(height: 3),
              _party('المشتري', order.buyerName),
              const SizedBox(height: 3),
              _party('البائع', order.sellerName),
            ],
          ),
        ),
      ],
    ),
  );

  Widget _party(String label, String name) => Row(
    children: [
      Text('$label ', style: AppText.body(12.5, color: AppColors.neutral700)),
      Flexible(
        child: Text(
          name,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: AppText.body(12.5),
        ),
      ),
    ],
  );

  /// «أين المال» ثمّ السكّة.
  Widget _railCard() => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: AppColors.neutral100,
      borderRadius: BorderRadius.circular(AppRadii.banner),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: const BoxDecoration(
                color: AppColors.accent2_200,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                LucideIcons.shield,
                size: 17,
                color: AppColors.accent2_800,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                order.moneyLine,
                style: AppText.body(14.5, weight: FontWeight.w700),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        OrderRail(order: order),
      ],
    ),
  );

  /// نداءُ المرحلة لمن ليس عليه نموذج.
  Widget _callCard() => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(AppRadii.banner),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(order.stageName, style: AppText.heading(17)),
        const SizedBox(height: 6),
        Text(
          _callSub,
          style: AppText.body(
            12,
            color: AppColors.neutral700,
          ).copyWith(height: 1.5),
        ),
      ],
    ),
  );

  String get _callSub => switch (order.stage) {
    OrderStage.pay =>
      order.youAreBuyer
          ? 'سدّد من محفظتك أو بحوالة بنكية — ويُحجز المبلغ أمانةً حتى تصلك اللوحة'
          : 'المشتري لم يسدّد بعد — والعربون محجوز حتى تنقضي المهلة',
    OrderStage.id =>
      'بانتظار المشتري ليؤكّد رقم هويته وتاريخ ميلاده — '
          'ولا يمكنك النقل في أبشر قبل وصولها',
    OrderStage.transfer =>
      order.youAreBuyer
          ? 'ينقلها البائع في أبشر ويرفع إثباتها، ومبلغك محجوز حتى ذلك'
          : 'افصل اللوحة عن سيارتك أولًا، ثم انقلها في أبشر وارفع الإثبات',
    OrderStage.review =>
      'رفع البائع الإثبات — والإدارة تتحقّق منه قبل تحويل المبلغ',
    OrderStage.done =>
      order.youAreBuyer
          ? 'اللوحة باسمك — ويمكنك عرضها في معرضك'
          : 'وصل عائدك بعد خصم العمولة وضريبتها',
    OrderStage.cancelled => 'عدل المشتري قبل السداد، وعاد العربون إليه',
    OrderStage.defaulted =>
      'انقضت مهلة السداد — فصودر جزءٌ من العربون وعاد الباقي',
  };

  /// **بطاقةُ الطرف الآخر — مقفلةٌ حتى يؤكّد المشتري بياناته.**
  ///
  /// فجوالُ الطرف الآخر واسمُه الكاملُ بياناتٌ شخصيّة، ولا تُكشف لمجرّد وقوع
  /// الصفقة — بل حين يصير التواصلُ لازمًا للنقل.
  Widget _counterpartCard() {
    final unlocked = counterpartPhone != null;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.neutral100,
        borderRadius: BorderRadius.circular(AppRadii.card),
      ),
      child: unlocked
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  order.youAreBuyer ? 'البائع' : 'المشتري',
                  style: AppText.body(11, color: AppColors.neutral700),
                ),
                const SizedBox(height: 2),
                Text(
                  order.youAreBuyer ? order.sellerName : order.buyerName,
                  style: AppText.body(13.5, weight: FontWeight.w700),
                ),
                const SizedBox(height: 6),
                Directionality(
                  textDirection: TextDirection.ltr,
                  child: Text(
                    counterpartPhone!,
                    style: AppText.digits(13, weight: FontWeight.w600),
                  ),
                ),
                if (!order.youAreBuyer && counterpartId != null) ...[
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Text(
                        'رقم الهوية ',
                        style: AppText.body(11.5, color: AppColors.neutral700),
                      ),
                      Directionality(
                        textDirection: TextDirection.ltr,
                        child: Text(
                          counterpartId!,
                          style: AppText.digits(13, weight: FontWeight.w700),
                        ),
                      ),
                      const SizedBox(width: 6),
                      const Icon(
                        LucideIcons.copy,
                        size: 14,
                        color: AppColors.accent700,
                      ),
                    ],
                  ),
                ],
              ],
            )
          : Row(
              children: [
                const Icon(
                  LucideIcons.lock,
                  size: 15,
                  color: AppColors.neutral600,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'بيانات الطرف الآخر تظهر بعد أن يؤكّد المشتري بياناته',
                    style: AppText.body(12, color: AppColors.neutral700),
                  ),
                ),
              ],
            ),
    );
  }

  /// **المحادثةُ والفاتورةُ تُفتحان من الصفقة** — لا من قائمةٍ عامّة.
  Widget _links() => Row(
    children: [
      Expanded(
        child: _LinkButton(
          icon: LucideIcons.messageCircle,
          label: 'محادثة',
          onTap: onOpenChat,
        ),
      ),
      const SizedBox(width: 8),
      Expanded(
        child: _LinkButton(
          icon: LucideIcons.receipt,
          label: 'الفاتورة الضريبية',
          onTap: onOpenInvoice,
        ),
      ),
    ],
  );

  String get _money => (order.price ~/ 100).toString().replaceAllMapped(
    RegExp(r'(\d)(?=(\d{3})+$)'),
    (m) => '${m[1]},',
  );
}

class _LinkButton extends StatelessWidget {
  const _LinkButton({required this.icon, required this.label, this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    behavior: HitTestBehavior.opaque,
    child: Container(
      height: 46,
      decoration: BoxDecoration(
        color: AppColors.neutral100,
        borderRadius: BorderRadius.circular(AppRadii.pill),
        border: Border.all(color: AppColors.divider),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 16),
          const SizedBox(width: 7),
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppText.body(13, weight: FontWeight.w700),
            ),
          ),
        ],
      ),
    ),
  );
}
