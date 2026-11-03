import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../design/tokens.dart';
import '../../models/listing.dart';

/// **الشريطُ السفليُّ لصفحة اللوحة** — يتبدّل بالحال والدور (§5.4).
///
/// **والمالكُ لا يزايد ولا يشتري ولا يسوم على لوحته** — يطّلع فقط. وسطرُ
/// القفلِ يقوله صراحةً: زرٌّ مُعطَّلٌ بلا سببٍ يُقرأ عطبًا، ومن لا يعرف
/// أنّ المنعَ مقصودٌ يُعيد المحاولة.
class ListingActionBar extends StatelessWidget {
  const ListingActionBar({
    super.key,
    required this.listing,
    required this.increment,
    this.onBid,
    this.onBuy,
    this.onOffer,
    this.offerPending = false,
  });

  final Listing listing;

  /// خطوةُ الزيادة بالهللات.
  final int increment;

  final ValueChanged<int>? onBid;
  final VoidCallback? onBuy;
  final VoidCallback? onOffer;

  /// سومٌ قُدّم ولم يُردَّ عليه بعد.
  final bool offerPending;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      decoration: const BoxDecoration(
        color: AppColors.bg,
        border: Border(top: BorderSide(color: AppColors.divider)),
      ),
      child: SafeArea(top: false, child: _body()),
    );
  }

  Widget _body() {
    if (listing.mine) return const _OwnerNote();

    return switch (listing.saleType) {
      SaleType.auction => _BidRow(
        listing: listing,
        increment: increment,
        onBid: onBid,
      ),
      SaleType.fixed => _Primary(label: 'اشترِ الآن', onTap: onBuy),
      SaleType.offers =>
        offerPending
            ? _Primary(
                label: 'حدّث سومك',
                hint: 'بإنتظار رد البائع',
                onTap: onOffer,
              )
            : _Primary(label: 'قدّم سومك', onTap: onOffer),
    };
  }
}

/// **سطرُ القفل** — صريحٌ لا زرٌّ مُعطَّل.
class _OwnerNote extends StatelessWidget {
  const _OwnerNote();

  @override
  Widget build(BuildContext context) => Row(
    children: [
      const Icon(LucideIcons.lock, size: 16, color: AppColors.neutral600),
      const SizedBox(width: 8),
      Expanded(
        child: Text(
          'هذه لوحتك — تطّلع على تفاصيلها فقط، ولا تملك المزايدة أو '
          'الشراء أو السوم عليها.',
          style: AppText.body(12, color: AppColors.neutral700),
        ),
      ),
    ],
  );
}

/// زرٌّ أساسيٌّ، وفوقه سطرٌ صغيرٌ عند الحاجة.
class _Primary extends StatelessWidget {
  const _Primary({required this.label, this.hint, this.onTap});

  final String label;
  final String? hint;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    behavior: HitTestBehavior.opaque,
    child: Container(
      height: hint == null ? 52 : 58,
      decoration: BoxDecoration(
        color: AppColors.accent,
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if (hint != null)
            Text(hint!, style: AppText.body(10.5, color: AppColors.accent200)),
          Text(
            label,
            style: AppText.body(
              15,
              color: Colors.white,
              weight: FontWeight.w700,
            ),
          ),
        ],
      ),
    ),
  );
}

/// **صفُّ المزايدة**: [− مبلغ +] · «زايد» · سطرُ أقلِّ مزايدةٍ والزيادة.
class _BidRow extends StatefulWidget {
  const _BidRow({required this.listing, required this.increment, this.onBid});

  final Listing listing;
  final int increment;
  final ValueChanged<int>? onBid;

  @override
  State<_BidRow> createState() => _BidRowState();
}

class _BidRowState extends State<_BidRow> {
  late int _amount = _minimum;

  /// **المطلوبةُ**: السعرُ الحاليُّ + الزيادة إن كانت ثَمّ مزايدات، وإلّا الافتتاح.
  int get _minimum => widget.listing.bids > 0
      ? widget.listing.price + widget.increment
      : widget.listing.price;

  void _step(int by) {
    setState(() {
      final next = _amount + by;
      /* ولا ينزل تحت المطلوبة — فزرُّ «‑» يقف عندها */
      _amount = next < _minimum ? _minimum : next;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            GestureDetector(
              onTap: () => widget.onBid?.call(_amount),
              behavior: HitTestBehavior.opaque,
              child: Container(
                height: 52,
                padding: const EdgeInsets.symmetric(horizontal: 22),
                decoration: BoxDecoration(
                  color: AppColors.accent,
                  borderRadius: BorderRadius.circular(AppRadii.pill),
                ),
                alignment: Alignment.center,
                child: Text(
                  'زايد',
                  style: AppText.body(
                    15,
                    color: Colors.white,
                    weight: FontWeight.w700,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Container(
                height: 52,
                decoration: BoxDecoration(
                  color: AppColors.neutral100,
                  borderRadius: BorderRadius.circular(AppRadii.pill),
                ),
                child: Row(
                  children: [
                    _StepButton(
                      icon: LucideIcons.plus,
                      onTap: () => _step(widget.increment),
                    ),
                    Expanded(
                      child: Text(
                        _money(_amount),
                        textAlign: TextAlign.center,
                        style: AppText.money(17),
                      ),
                    ),
                    _StepButton(
                      icon: LucideIcons.minus,
                      onTap: () => _step(-widget.increment),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: Text(
                'أقل مزايدة ${_money(_minimum)} · الزيادة ${_money(widget.increment)}',
                style: AppText.body(11.5, color: AppColors.neutral700),
              ),
            ),
            /*
             * **ورابطُ «مزايدة تلقائية حتى سقف» رُفع — ولا يُعاد حتى تُبنى.**
             *
             * فالوكالةُ في المزايدة (§5.3) تلزمها آلةٌ في الخادم تردّ عن
             * صاحبها بأقلّ زيادةٍ حتى سقفه، ولا وجودَ لها. ورابطٌ يُضغط فلا
             * يقع شيءٌ أسوأُ من رابطٍ ليس فيه: الأوّلُ يُقرأ عطبًا، والثاني
             * ميزةٌ لم تصل. وهي مقيَّدةٌ في `TASKS.md`.
             */
          ],
        ),
      ],
    );
  }

  String _money(int halalas) => (halalas ~/ 100).toString().replaceAllMapped(
    RegExp(r'(\d)(?=(\d{3})+$)'),
    (m) => '${m[1]},',
  );
}

class _StepButton extends StatelessWidget {
  const _StepButton({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    behavior: HitTestBehavior.opaque,
    child: Container(
      width: 40,
      height: 40,
      margin: const EdgeInsets.symmetric(horizontal: 6),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        shape: BoxShape.circle,
      ),
      child: Icon(icon, size: 18),
    ),
  );
}
