import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../design/tokens.dart';
import '../models/activity.dart';
import '../models/listing.dart';
import '../widgets/activity/pending_card.dart';
import '../widgets/market_row_card.dart';

/// تاباتُ «نشاطي» الأربع.
enum ActivityTab { pending, bids, offers, watching }

/// **شاشةُ نشاطي** — §5.6.
///
/// **وتابُ «بانتظارك» يجمع أربعةَ أنواعٍ لا نوعًا واحدًا**: صفقةٌ تنتظر
/// سدادَك أو بياناتك، وسومٌ وصلك، ومزادٌ تجاوزك فيه أحد، وصفقةُ بيعٍ تنتظر
/// نقلَك للملكية. فالسؤالُ الذي يفتح به المستخدمُ التطبيقَ واحد: **ماذا
/// عليّ الآن؟** — ولو فُرّقت على أربعة تاباتٍ لفتحها كلَّها ليعرف.
class ActivityScreen extends StatefulWidget {
  const ActivityScreen({
    super.key,
    required this.pending,
    required this.myBids,
    required this.myOffers,
    required this.watching,
    required this.serverTime,
    this.onOpenOrder,
  });

  final List<PendingItem> pending;
  final List<Listing> myBids;
  final List<Listing> myOffers;
  final List<Listing> watching;
  final DateTime serverTime;
  final VoidCallback? onOpenOrder;

  @override
  State<ActivityScreen> createState() => _ActivityScreenState();
}

class _ActivityScreenState extends State<ActivityScreen> {
  ActivityTab _tab = ActivityTab.pending;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 6, 18, 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('نشاطي', style: AppText.heading(28)),
              const SizedBox(height: 12),
              _tabs(),
            ],
          ),
        ),
        Expanded(child: _body()),
      ],
    );
  }

  Widget _tabs() {
    final counts = {
      ActivityTab.pending: widget.pending.length,
      ActivityTab.bids: widget.myBids.length,
      ActivityTab.offers: widget.myOffers.length,
      ActivityTab.watching: widget.watching.length,
    };
    const labels = {
      ActivityTab.pending: 'بانتظارك',
      ActivityTab.bids: 'مزايداتي',
      ActivityTab.offers: 'عروضي',
      ActivityTab.watching: 'أتابعها',
    };

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadii.card),
      ),
      child: Row(
        children: ActivityTab.values.map((t) {
          final active = _tab == t;
          return Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _tab = t),
              behavior: HitTestBehavior.opaque,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: active ? AppColors.text : Colors.transparent,
                  borderRadius: BorderRadius.circular(22),
                ),
                child: Column(
                  children: [
                    Text(
                      labels[t]!,
                      style: AppText.body(
                        12.5,
                        weight: FontWeight.w700,
                        color: active ? AppColors.bg : AppColors.text,
                      ),
                    ),
                    const SizedBox(height: 1),
                    Opacity(
                      opacity: 0.75,
                      child: Text(
                        '${counts[t]}',
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
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _body() {
    switch (_tab) {
      case ActivityTab.pending:
        if (widget.pending.isEmpty) {
          return const _Empty(
            icon: LucideIcons.check,
            title: 'ما عليك شيء الآن',
            sub: 'كل صفقاتك ماشية — وإن وصلك شيء ظهر هنا',
            tint: AppColors.accent2_200,
            ink: AppColors.accent2_800,
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.fromLTRB(18, 0, 18, 90),
          itemCount: widget.pending.length,
          separatorBuilder: (_, _) => const SizedBox(height: 10),
          itemBuilder: (context, i) => PendingCard(
            item: widget.pending[i],
            onAct: widget.onOpenOrder,
            onAccept: widget.onOpenOrder,
          ),
        );

      case ActivityTab.bids:
        return _list(widget.myBids, 'لا مزايدات لك بعد');
      case ActivityTab.offers:
        return _list(widget.myOffers, 'لم تُقدّم سومًا بعد');
      case ActivityTab.watching:
        return _list(widget.watching, 'لا لوحات تتابعها');
    }
  }

  Widget _list(List<Listing> rows, String emptyTitle) {
    if (rows.isEmpty) {
      return _Empty(
        icon: LucideIcons.gavel,
        title: emptyTitle,
        sub: 'تصفّح السوق وابدأ',
        tint: AppColors.surface,
        ink: AppColors.neutral700,
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(18, 0, 18, 90),
      itemCount: rows.length,
      separatorBuilder: (_, _) => const SizedBox(height: 10),
      itemBuilder: (context, i) =>
          MarketRowCard(listing: rows[i], serverTime: widget.serverTime),
    );
  }
}

/// **حالةٌ فارغةٌ تطمئن** — «ما عليك شيء الآن» لا شاشةٌ بيضاء.
class _Empty extends StatelessWidget {
  const _Empty({
    required this.icon,
    required this.title,
    required this.sub,
    required this.tint,
    required this.ink,
  });

  final IconData icon;
  final String title;
  final String sub;
  final Color tint;
  final Color ink;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 48),
    child: Column(
      children: [
        Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(color: tint, shape: BoxShape.circle),
          child: Icon(icon, size: 30, color: ink),
        ),
        const SizedBox(height: 8),
        Text(title, textAlign: TextAlign.center, style: AppText.heading(19)),
        const SizedBox(height: 4),
        Text(
          sub,
          textAlign: TextAlign.center,
          style: AppText.body(13, color: AppColors.neutral700),
        ),
      ],
    ),
  );
}
