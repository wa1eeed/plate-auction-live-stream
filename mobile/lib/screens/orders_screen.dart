import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../design/tokens.dart';
import '../models/order.dart';
import '../widgets/listing/bid_log.dart' show formatStamp;
import '../widgets/plate.dart';

/// **شاشةُ «صفقاتي»** — §5.7، شاشةُ التسليم العاشرة.
///
/// **وصفّا «مشترياتي» و«مبيعاتي» في حسابي كانا بلا وجهة**: يُضغطان فلا
/// يقع شيء. والبياناتُ كانت حاضرةً (`api/orders` يردّ الجهتين)، والناقصُ
/// الشاشةُ التي تعرضها.
///
/// **وهي غيرُ «بانتظارك»**: ذاك يسأل «ماذا عليّ الآن؟» فيجمع ما ينتظر
/// ردَّك من الدورين، وهذه سجلٌّ كاملٌ لكلّ صفقةٍ مرّت — مكتملةً ومُلغاةً.
class OrdersScreen extends StatefulWidget {
  const OrdersScreen({
    super.key,
    required this.purchases,
    required this.sales,
    this.startOnSales = false,
    this.onBack,
    this.onOpen,
  });

  final List<OrderView> purchases;
  final List<OrderView> sales;

  /// يُفتح على «مبيعاتي» لمن جاء من صفّها.
  final bool startOnSales;

  final VoidCallback? onBack;
  final ValueChanged<OrderView>? onOpen;

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  late bool _sales = widget.startOnSales;

  List<OrderView> get _rows => _sales ? widget.sales : widget.purchases;

  /// **المجموعُ من المكتملة وحدها** — فصفقةٌ لم تُسدَّد لم يُدفع فيها شيء.
  int get _completedNet => _rows
      .where((o) => o.stage == OrderStage.done)
      .fold(0, (sum, o) => sum + (o.net ?? o.price));

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _header(),
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 0, 18, 8),
          child: _tabs(),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 0, 18, 10),
          child: Text(
            _sales
                ? 'مجموع عائدك المكتمل ${_money(_completedNet)} ر.س'
                : 'مجموع ما دفعته في صفقات مكتملة ${_money(_completedNet)} ر.س',
            textAlign: TextAlign.center,
            style: AppText.body(11.5, color: AppColors.neutral700),
          ),
        ),
        Expanded(child: _body()),
      ],
    );
  }

  Widget _header() => Padding(
    padding: const EdgeInsets.fromLTRB(18, 4, 18, 12),
    child: Row(
      children: [
        GestureDetector(
          onTap: widget.onBack,
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
        Text('صفقاتي', style: AppText.heading(26)),
      ],
    ),
  );

  Widget _tabs() => Container(
    padding: const EdgeInsets.all(4),
    decoration: BoxDecoration(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(AppRadii.card),
    ),
    child: Row(
      children: [
        Expanded(child: _tab('مشترياتي', widget.purchases.length, false)),
        Expanded(child: _tab('مبيعاتي', widget.sales.length, true)),
      ],
    ),
  );

  Widget _tab(String label, int count, bool sales) {
    final active = _sales == sales;

    return GestureDetector(
      onTap: () => setState(() => _sales = sales),
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: active ? AppColors.text : Colors.transparent,
          borderRadius: BorderRadius.circular(22),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Text(
              label,
              style: AppText.body(
                13,
                weight: FontWeight.w700,
                color: active ? AppColors.bg : AppColors.text,
              ),
            ),
            const SizedBox(width: 5),
            Opacity(
              opacity: 0.75,
              child: Text(
                '$count',
                style: AppText.digits(
                  11,
                  weight: FontWeight.w700,
                  color: active ? AppColors.bg : AppColors.text,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _body() {
    if (_rows.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 48),
        child: Column(
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: const BoxDecoration(
                color: AppColors.surface,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                LucideIcons.receipt,
                size: 30,
                color: AppColors.neutral700,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _sales ? 'لم تبع لوحةً بعد' : 'لم تشترِ لوحةً بعد',
              textAlign: TextAlign.center,
              style: AppText.heading(19),
            ),
            const SizedBox(height: 4),
            Text(
              'تصفّح السوق وابدأ',
              textAlign: TextAlign.center,
              style: AppText.body(13, color: AppColors.neutral700),
            ),
          ],
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(18, 0, 18, 90),
      itemCount: _rows.length,
      separatorBuilder: (_, _) => const SizedBox(height: 10),
      itemBuilder: (context, i) => _OrderCard(
        order: _rows[i],
        onTap: () => widget.onOpen?.call(_rows[i]),
      ),
    );
  }

  static String _money(int halalas) => (halalas ~/ 100)
      .toString()
      .replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+$)'), (m) => '${m[1]},');
}

/// كرتُ صفقةٍ واحدة — اللوحةُ يسارًا، ورقمُها وتاريخُها وسعرُها يمينًا.
class _OrderCard extends StatelessWidget {
  const _OrderCard({required this.order, this.onTap});

  final OrderView order;
  final VoidCallback? onTap;

  bool get _done => order.stage == OrderStage.done;

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    behavior: HitTestBehavior.opaque,
    child: Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadii.card),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: _facts()),
              const SizedBox(width: 10),
              Container(
                width: 132,
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
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
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              /* وحالُ الصفقة أوّلُ ما يُقرأ — فهي سببُ فتح السجلّ */
              Flexible(
                child: _Tag(
                  label: order.stageChip,
                  bg: _done ? AppColors.accent2_200 : AppColors.accent200,
                  fg: _done ? AppColors.accent2_800 : AppColors.accent900,
                ),
              ),
              const Spacer(),
              _Tag(
                label: order.source,
                bg: Colors.transparent,
                fg: AppColors.neutral800,
                border: true,
              ),
              const SizedBox(width: 4),
              _Tag(
                label: order.youAreBuyer ? 'أنت المشتري' : 'أنت البائع',
                bg: order.youAreBuyer
                    ? AppColors.accent2_200
                    : AppColors.accent200,
                fg: order.youAreBuyer
                    ? AppColors.accent2_800
                    : AppColors.accent900,
              ),
            ],
          ),
        ],
      ),
    ),
  );

  Widget _facts() => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    mainAxisSize: MainAxisSize.min,
    children: [
      Text(
        '${order.reference} · ${formatStamp(order.createdAt)}',
        style: AppText.digits(10.5, color: AppColors.neutral600),
      ),
      const SizedBox(height: 4),
      Row(
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        children: [
          Text(_money(order.price), style: AppText.money(19)),
          const SizedBox(width: 3),
          Text('ر.س', style: AppText.body(11, color: AppColors.neutral700)),
        ],
      ),
      const SizedBox(height: 2),
      /* و«المدفوع» غيرُ الثمن: العربونُ خُصم منه والعمولةُ أُضيفت إليه */
      Text(
        '${order.youAreBuyer ? 'المدفوع' : 'عائدك'} '
        '${_money(order.net ?? order.price)} ر.س',
        style: AppText.body(11.5, color: AppColors.neutral700),
      ),
    ],
  );

  static String _money(int halalas) => (halalas ~/ 100)
      .toString()
      .replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+$)'), (m) => '${m[1]},');
}

class _Tag extends StatelessWidget {
  const _Tag({
    required this.label,
    required this.bg,
    required this.fg,
    this.border = false,
  });

  final String label;
  final Color bg;
  final Color fg;
  final bool border;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(
      color: bg,
      borderRadius: BorderRadius.circular(AppRadii.pill),
      border: border ? Border.all(color: AppColors.divider) : null,
    ),
    child: Text(
      label,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: AppText.body(10.5, weight: FontWeight.w700, color: fg),
    ),
  );
}
