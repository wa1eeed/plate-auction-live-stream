import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../design/tokens.dart';
import '../widgets/listing/bid_log.dart' show formatStamp;

/// نوعُ الإشعار — ولكلٍّ أيقونتُه ووجهتُه.
enum NotifKind { outbid, order, offer, won, wallet, system }

/// إشعارٌ واحد.
class AppNotification {
  const AppNotification({
    required this.kind,
    required this.title,
    required this.body,
    required this.at,
    this.unread = false,
  });

  final NotifKind kind;
  final String title;
  final String body;
  final DateTime at;
  final bool unread;
}

/// **شاشةُ الإشعارات** — §5.11.
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key, required this.items, this.onBack});

  final List<AppNotification> items;
  final VoidCallback? onBack;

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  late List<AppNotification> _items = widget.items;

  @override
  Widget build(BuildContext context) {
    final unread = _items.where((n) => n.unread).length;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 10),
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
              Expanded(child: Text('الإشعارات', style: AppText.heading(24))),
              if (unread > 0)
                GestureDetector(
                  onTap: () => setState(
                    () => _items = _items
                        .map(
                          (n) => AppNotification(
                            kind: n.kind,
                            title: n.title,
                            body: n.body,
                            at: n.at,
                          ),
                        )
                        .toList(),
                  ),
                  behavior: HitTestBehavior.opaque,
                  child: Text(
                    'علّمها مقروءة',
                    style: AppText.body(
                      12.5,
                      color: AppColors.accent700,
                      weight: FontWeight.w600,
                    ),
                  ),
                ),
            ],
          ),
        ),
        Expanded(
          child: _items.isEmpty
              ? _empty()
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(12, 0, 12, 90),
                  itemCount: _items.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 4),
                  itemBuilder: (context, i) => _Row(item: _items[i]),
                ),
        ),
      ],
    );
  }

  Widget _empty() => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 48),
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
            LucideIcons.bell,
            size: 26,
            color: AppColors.neutral500,
          ),
        ),
        const SizedBox(height: 10),
        Text(
          'لا إشعارات بعد',
          textAlign: TextAlign.center,
          style: AppText.heading(19),
        ),
      ],
    ),
  );
}

class _Row extends StatelessWidget {
  const _Row({required this.item});

  final AppNotification item;

  @override
  Widget build(BuildContext context) {
    final (icon, tint) = switch (item.kind) {
      NotifKind.outbid => (LucideIcons.gavel, AppColors.accent700),
      NotifKind.order => (LucideIcons.shield, AppColors.accent700),
      NotifKind.offer => (LucideIcons.messageCircle, AppColors.accent2_700),
      NotifKind.won => (LucideIcons.trophy, AppColors.accent700),
      NotifKind.wallet => (LucideIcons.wallet, AppColors.accent2_700),
      NotifKind.system => (LucideIcons.info, AppColors.neutral700),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
      decoration: BoxDecoration(
        /* **وغيرُ المقروء بخلفيةٍ خفيفة** — يُمسح بالعين لا بالقراءة */
        color: item.unread ? AppColors.accent100 : Colors.transparent,
        borderRadius: BorderRadius.circular(AppRadii.banner),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: const BoxDecoration(
              color: AppColors.surface,
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 18, color: tint),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.title,
                  style: AppText.body(13.5, weight: FontWeight.w700),
                ),
                const SizedBox(height: 2),
                Text(
                  item.body,
                  style: AppText.body(
                    12.5,
                    color: AppColors.neutral700,
                  ).copyWith(height: 1.5),
                ),
                const SizedBox(height: 4),
                Directionality(
                  textDirection: TextDirection.ltr,
                  child: Text(
                    formatStamp(item.at),
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
          if (item.unread) ...[
            const SizedBox(width: 8),
            Container(
              width: 9,
              height: 9,
              margin: const EdgeInsets.only(top: 6),
              decoration: const BoxDecoration(
                color: AppColors.accent,
                shape: BoxShape.circle,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
