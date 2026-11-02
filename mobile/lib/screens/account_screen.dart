import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../design/tokens.dart';
import '../models/listing.dart';
import '../widgets/account/bank_card.dart';
import '../widgets/plate.dart';

/// بندٌ في قائمة الحساب.
typedef AccountLink = (IconData, String, String?);

/// **شاشةُ حسابي** — §5.9.
class AccountScreen extends StatelessWidget {
  const AccountScreen({
    super.key,
    required this.name,
    required this.handle,
    required this.membershipNumber,
    required this.available,
    required this.balance,
    required this.held,
    required this.myPlates,
    this.onOpenWallet,
    this.onOpenSettings,
    this.onOpenNotifications,
    this.onOpenShowcase,
    this.onOpenHelp,
  });

  final String name;

  /// المعرّفُ العلنيُّ — يُقرأ يسارًا.
  final String handle;

  final String membershipNumber;
  final int available;
  final int balance;
  final int held;
  final List<Listing> myPlates;
  final VoidCallback? onOpenWallet;
  final VoidCallback? onOpenSettings;
  final VoidCallback? onOpenNotifications;
  final VoidCallback? onOpenShowcase;
  final VoidCallback? onOpenHelp;

  static const _links = <AccountLink>[
    (LucideIcons.shoppingCart, 'مشترياتي', 'كل ما اشتريته وتفاصيله وفواتيره'),
    (LucideIcons.tag, 'مبيعاتي', 'كل ما بعته وعائده وفواتيره'),
    (LucideIcons.store, 'معرض لوحاتي', 'souq-plates.sa/@waleed'),
    (LucideIcons.bell, 'الإشعارات', null),
    (LucideIcons.circleHelp, 'المساعدة', null),
    (LucideIcons.settings, 'الإعدادات', null),
  ];

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 6, 18, 90),
      children: [
        _header(),
        const SizedBox(height: 16),
        BankCard(
          membershipNumber: membershipNumber,
          holderName: name,
          available: available,
          balance: balance,
          held: held,
          onOpenWallet: onOpenWallet,
        ),
        const SizedBox(height: 16),
        _myPlates(),
        const SizedBox(height: 16),
        _menu(),
      ],
    );
  }

  Widget _header() => Row(
    children: [
      Container(
        width: 60,
        height: 60,
        decoration: const BoxDecoration(
          color: AppColors.accent2_300,
          shape: BoxShape.circle,
        ),
        alignment: Alignment.center,
        child: Text(name.substring(0, 1), style: AppText.heading(26)),
      ),
      const SizedBox(width: 14),
      Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(name, style: AppText.heading(24).copyWith(height: 1.2)),
          Directionality(
            textDirection: TextDirection.ltr,
            child: Text(
              handle,
              style: AppText.body(13, color: AppColors.neutral700),
            ),
          ),
        ],
      ),
    ],
  );

  Widget _myPlates() => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Row(
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        children: [
          Text('لوحاتي', style: AppText.heading(19)),
          const Spacer(),
          Text(
            '${myPlates.length} معروضة',
            style: AppText.body(12.5, color: AppColors.neutral700),
          ),
        ],
      ),
      const SizedBox(height: 8),
      SizedBox(
        height: 128,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: EdgeInsets.zero,
          itemCount: myPlates.length,
          separatorBuilder: (_, _) => const SizedBox(width: 10),
          itemBuilder: (context, i) => _PlateTile(listing: myPlates[i]),
        ),
      ),
    ],
  );

  Widget _menu() => Container(
    decoration: BoxDecoration(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(AppRadii.card),
    ),
    padding: const EdgeInsets.symmetric(horizontal: 14),
    child: Column(
      children: [
        for (var i = 0; i < _links.length; i++) ...[
          _MenuRow(
            link: _links[i],
            onTap: switch (_links[i].$2) {
              'الإعدادات' => onOpenSettings,
              'الإشعارات' => onOpenNotifications,
              'معرض لوحاتي' => onOpenShowcase,
              'المساعدة' => onOpenHelp,
              _ => null,
            },
          ),
          if (i != _links.length - 1)
            Container(height: 1, color: AppColors.divider),
        ],
      ],
    ),
  );
}

/// بطاقةٌ صغيرةٌ في كاروسيل «لوحاتي».
class _PlateTile extends StatelessWidget {
  const _PlateTile({required this.listing});

  final Listing listing;

  @override
  Widget build(BuildContext context) => Container(
    width: 172,
    padding: const EdgeInsets.all(10),
    decoration: BoxDecoration(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(AppRadii.card),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: Container(
            decoration: BoxDecoration(
              color: AppColors.neutral200,
              borderRadius: BorderRadius.circular(AppRadii.plateInset),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Center(
              child: SaudiPlate(
                letters: listing.letters,
                number: listing.number,
                kind: listing.kind,
                format: listing.format,
                emblem: listing.emblem,
              ),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(color: _dot, shape: BoxShape.circle),
            ),
            const SizedBox(width: 5),
            Text(_label, style: AppText.body(11, weight: FontWeight.w600)),
            const Spacer(),
            Text(_money, style: AppText.digits(12, weight: FontWeight.w700)),
          ],
        ),
      ],
    ),
  );

  Color get _dot => switch (listing.saleType) {
    SaleType.auction => AppColors.accent,
    SaleType.fixed => AppColors.accent2,
    SaleType.offers => AppColors.neutral700,
  };

  String get _label => switch (listing.saleType) {
    SaleType.auction => 'مزاد',
    SaleType.fixed => 'بيع مباشر',
    SaleType.offers => 'على السوم',
  };

  String get _money => (listing.price ~/ 100).toString().replaceAllMapped(
    RegExp(r'(\d)(?=(\d{3})+$)'),
    (m) => '${m[1]},',
  );
}

class _MenuRow extends StatelessWidget {
  const _MenuRow({required this.link, this.onTap});

  final AccountLink link;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final (icon, title, sub) = link;

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Row(
          children: [
            /* أيقونةٌ في مربّعٍ ‎٣٨‎ بخلفيةٍ `accent-100` */
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: AppColors.accent100,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, size: 17, color: AppColors.accent700),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: AppText.body(13.5, weight: FontWeight.w700),
                  ),
                  if (sub != null) ...[
                    const SizedBox(height: 2),
                    Directionality(
                      textDirection: sub.contains('/')
                          ? TextDirection.ltr
                          : TextDirection.rtl,
                      child: Text(
                        sub,
                        style: AppText.body(11.5, color: AppColors.neutral700),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const Icon(
              LucideIcons.chevronLeft,
              size: 18,
              color: AppColors.neutral600,
            ),
          ],
        ),
      ),
    );
  }
}
